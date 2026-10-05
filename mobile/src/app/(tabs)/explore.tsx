import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, RefreshControl, ScrollView, View } from "react-native";
import { api } from "@/api/endpoints";
import type { ExploreOverview } from "@/api/models";
import type { CommunityCardData } from "@/api/types";
import { FilterSheet, RecentSearches, SearchResults, TagChip } from "@/components/community/ExploreSearch";
import { DEFAULT_FILTERS, activeFilterCount, bannerAction, cleanTag, type SearchFilters } from "@/components/community/helpers";
import { serverImage } from "@/components/community/media";
import { notify } from "@/components/community/platform";
import {
  AppHeader, CATEGORIES, CategoryChip, CategoryChips, CommunityCard, EXPLORE_CATEGORIES, EmptyHint, HeroCarousel, SearchField, SectionHeader,
  categoryByKey, personFromChip, useColumnWidth,
} from "@/components/k";
import { ErrorState, PressableScale, Sheet, SkeletonList, Txt, useTabBarSpace } from "@/components/ui";
import { defaultCover, heroArt } from "@/lib/brandArt";
import { showError } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { useDebounced } from "@/lib/useDebounced";
import { font, shadow, typeScale, useTheme } from "@/theme";

/**
 * Explore = the "Communities" tab (mockup 04-explore).
 * Header, title, a search box with a filter button, category chips (they filter everything below), banners,
 * "Recommended Communities" (two rows of four, with Join), "Trending Tags" (tap = search that tag), then your
 * communities, new ones and fast-growing ones.
 * Typing in the search box (or tapping the header's search icon, which opens `/explore?search=1`) switches to
 * search: recent searches, then results in six tabs, with filters in a sheet.
 */
export default function Explore() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const tabSpace = useTabBarSpace();
  const scroller = useRef<ScrollView>(null);
  const col = useColumnWidth(4);
  const params = useLocalSearchParams<{ q?: string; search?: string }>();

  const [query, setQuery] = useState(params.q ?? "");
  const [searching, setSearching] = useState(!!params.q || params.search === "1");
  // Changing this key re-creates the search box with `autoFocus`, which puts the cursor in it.
  const [focusKey, setFocusKey] = useState(params.search === "1" ? 1 : 0);
  const [category, setCategory] = useState("forYou");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Links into this tab: `?q=#tag` (a hashtag tapped anywhere) or `?search=1` (the header's search icon).
  // Each new link is handled once here, then cleared (below) so the same link works again next time.
  const incoming = `${params.q ?? ""}|${params.search ?? ""}`;
  const [handled, setHandled] = useState(incoming);
  if (incoming !== handled) {
    setHandled(incoming);
    if (params.q) setQuery(params.q);
    if (params.q || params.search === "1") setSearching(true);
    if (params.search === "1") setFocusKey((k) => k + 1);
  }
  useEffect(() => {
    if (params.q || params.search) router.setParams({ q: undefined, search: undefined });
  }, [params.q, params.search]);

  const interest = category === "forYou" ? undefined : category;
  const overview = useQuery({
    queryKey: ["exploreOverview", interest ?? "forYou"],
    queryFn: () => api.exploreOverview(interest),
    placeholderData: keepPreviousData,
  });
  const data = overview.data;

  const term = useDebounced(query.trim(), 400);
  const filterCount = activeFilterCount(filters);
  const showResults = term.replace(/^#/, "").length >= 2 || (!term && filterCount > 0);

  const startSearch = () => {
    setSearching(true);
    setFocusKey((k) => k + 1);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };
  const stopSearch = () => {
    Keyboard.dismiss();
    setQuery("");
    setFilters(DEFAULT_FILTERS);
    setSearching(false);
  };
  const pickQuery = (q: string) => {
    setQuery(q);
    setSearching(true);
    Keyboard.dismiss();
  };
  /** "Browse All", "See All": list every community (sorted) using the search filters. */
  const browse = (sort: SearchFilters["sort"]) => {
    setQuery("");
    setFilters({ ...DEFAULT_FILTERS, category: interest ?? "", sort });
    setSearching(true);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  // Join / leave changes every cached copy of the explore cards at once, so all sections agree straight away.
  const patch = (slug: string, joined: boolean) =>
    queryClient.setQueriesData<ExploreOverview>({ queryKey: ["exploreOverview"] }, (o) => {
      if (!o) return o;
      const fix = (c: CommunityCardData) => (c.id === slug ? { ...c, joined, memberCount: Math.max(0, c.memberCount + (joined ? 1 : -1)) } : c);
      return { ...o, recommended: o.recommended.map(fix), newest: o.newest.map(fix), growing: o.growing.map(fix), joined: o.joined.map(fix) };
    });
  async function toggleJoin(c: CommunityCardData) {
    // Private communities ask questions first: their page has the join form.
    if (!c.joined && c.visibility === "private") return router.push(`/community/${c.id}`);
    setBusy(c.id);
    try {
      if (c.joined) {
        await api.leave(c.id);
        patch(c.id, false);
      } else {
        const result = await api.join({ slug: c.id });
        if (result.pending) notify("Request sent", "The leaders will review your request. You'll get a notification when you're in.");
        else {
          haptic.success();
          patch(c.id, true);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      void queryClient.invalidateQueries({ queryKey: ["exploreOverview"] });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }

  // The chips row: the mockup's six, plus the chosen one if it came from the "more" sheet.
  const chipItems = EXPLORE_CATEGORIES.some((c) => c.key === category) ? EXPLORE_CATEGORIES : [...EXPLORE_CATEGORIES, categoryByKey(category)];

  const card = (c: CommunityCardData, i: number, variant: "grid" | "vertical" | "compact") => (
    <CommunityCard
      key={c.id}
      variant={variant}
      name={c.name}
      description={c.tagline || c.description}
      image={c.cover ? serverImage(c.cover) : defaultCover(c.hue)}
      hue={c.hue}
      members={c.memberCount}
      faces={c.memberFaces.map(personFromChip)}
      joined={c.joined}
      index={i}
      joining={busy === c.id}
      onPress={() => router.push(`/community/${c.id}`)}
      onJoin={variant === "compact" ? undefined : () => void toggleJoin(c)}
    />
  );

  const row = (list: CommunityCardData[], variant: "vertical" | "compact") => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}>
      {list.map((c, i) => card(c, i, variant))}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroller}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabSpace + 8 }}
        refreshControl={<RefreshControl refreshing={overview.isRefetching && !overview.isPlaceholderData} onRefresh={() => void overview.refetch()} tintColor={theme.accent} colors={[theme.accent]} />}
      >
        <AppHeader onSearch={startSearch} />

        {searching ? null : (
          <View style={{ paddingHorizontal: 16, gap: 3, marginTop: 2 }}>
            <Txt accessibilityRole="header" style={[typeScale.screenTitle, { color: theme.ink }]}>Explore</Txt>
            <Txt style={{ fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, color: theme.muted }}>Discover communities, meet amazing people, and find your next favorite space.</Txt>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 12 }}>
          <SearchField
            key={focusKey}
            autoFocus={focusKey > 0}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t) setSearching(true);
            }}
            onFocus={() => setSearching(true)}
            onSubmit={() => Keyboard.dismiss()}
            onFilter={() => setFiltersOpen(true)}
            filterActive={filterCount > 0}
            style={{ flex: 1 }}
          />
          {searching ? (
            <PressableScale onPress={stopSearch} accessibilityLabel="Close search" hitSlop={8} scaleTo={0.94} style={{ minHeight: 44, justifyContent: "center" }}>
              <Txt style={{ fontFamily: font.bold, fontSize: 14, color: theme.accent }}>Cancel</Txt>
            </PressableScale>
          ) : null}
        </View>

        {searching ? (
          <View style={{ marginTop: 14 }}>
            {showResults ? (
              <>
                {!term ? <SectionHeader icon="compass" title="All communities" style={{ paddingHorizontal: 16, marginBottom: 8 }} /> : null}
                <SearchResults term={term} filters={filters} onPickQuery={pickQuery} />
              </>
            ) : (
              <RecentSearches tags={data?.trendingTags ?? []} onPick={pickQuery} />
            )}
          </View>
        ) : (
          <>
            <CategoryChips items={chipItems} value={category} onChange={setCategory} onMore={() => setCategoriesOpen(true)} style={{ marginTop: 8 }} />

            {overview.isPending ? (
              <View style={{ padding: 16 }}>
                <SkeletonList count={3} />
              </View>
            ) : overview.isError || !data ? (
              <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
            ) : (
              <View style={{ gap: 14, marginTop: 6 }}>
                {data.banners.length ? (
                  <HeroCarousel
                    style={{ marginHorizontal: 16 }}
                    height={138}
                    slides={data.banners.map((b, i) => ({
                      key: b.id,
                      image: heroArt[b.art] ?? heroArt[`explore-${(i % 3) + 1}`],
                      title: b.title,
                      text: b.text,
                      cta: b.cta,
                      hue: 262,
                      onPress: () => {
                        const action = bannerAction(b.href);
                        if (action.kind === "create") router.push("/new-community");
                        else if (action.kind === "go") router.push(action.href as never);
                        else browse(action.sort);
                      },
                    }))}
                  />
                ) : null}

                <View style={{ gap: 8 }}>
                  <SectionHeader emoji="⭐" title="Recommended Communities" onAction={() => browse("trending")} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
                  {data.recommended.length ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 }}>
                      {data.recommended.slice(0, 8).map((c, i) => (
                        <View key={c.id} style={{ width: col }}>
                          {card(c, i, "grid")}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <EmptyHint emoji="🌱" title="Nothing here yet" text="No communities in this category yet. Why not start one?" actionLabel="Create a community" onAction={() => router.push("/new-community")} style={{ marginHorizontal: 16 }} />
                  )}
                </View>

                {data.trendingTags.length ? (
                  <View style={{ gap: 8 }}>
                    <SectionHeader icon="trending-up" iconColor={theme.pink} title="Trending Tags" onAction={startSearch} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 2 }}>
                      {data.trendingTags.map((t, i) => (
                        <TagChip key={t.tag} tag={t.tag} index={i} onPress={() => pickQuery(`#${cleanTag(t.tag)}`)} />
                      ))}
                      <PressableScale onPress={startSearch} accessibilityLabel="More tags" hitSlop={8} scaleTo={0.9} style={[{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, shadow.card]}>
                        <Ionicons name="chevron-forward" size={16} color={theme.ink} />
                      </PressableScale>
                    </ScrollView>
                  </View>
                ) : null}

                {data.joined.length ? (
                  <View style={{ gap: 8 }}>
                    <SectionHeader emoji="🏡" title="Your communities" onAction={() => router.push("/me")} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
                    {row(data.joined, "compact")}
                  </View>
                ) : null}
                {data.newest.length ? (
                  <View style={{ gap: 8 }}>
                    <SectionHeader emoji="🌱" title="New communities" onAction={() => browse("new")} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
                    {row(data.newest, "vertical")}
                  </View>
                ) : null}
                {data.growing.length ? (
                  <View style={{ gap: 8 }}>
                    <SectionHeader emoji="🚀" title="Fast-growing" onAction={() => browse("growing")} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
                    {row(data.growing, "vertical")}
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <FilterSheet visible={filtersOpen} value={filters} onApply={(f) => { setFilters(f); setSearching(true); }} onClose={() => setFiltersOpen(false)} />
      <Sheet visible={categoriesOpen} title="All categories" onClose={() => setCategoriesOpen(false)}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.filter((c) => c.key !== "more").map((c) => (
            <CategoryChip
              key={c.key}
              category={c}
              size="lg"
              selected={category === c.key}
              onPress={() => {
                setCategory(c.key);
                setCategoriesOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}
