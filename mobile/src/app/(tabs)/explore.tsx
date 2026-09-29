import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Keyboard, ScrollView, View } from "react-native";
import { api } from "@/api/endpoints";
import type { SearchResults } from "@/api/models";
import { CATEGORIES } from "@/api/types";
import { CommunityCard } from "@/components/CommunityCard";
import { PostCard } from "@/components/PostCard";
import { Avatar, Card, Chip, EmptyState, ErrorState, Field, Loading, SkeletonList, Txt, useTabBarSpace } from "@/components/ui";
import { useDebounced } from "@/lib/useDebounced";
import { font, space } from "@/theme";

export default function Explore() {
  // Tapping a #hashtag anywhere in the app opens Explore with that tag already searched.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? "");
  const [seenTag, setSeenTag] = useState(q);
  if (q !== seenTag) {
    // A different #hashtag was tapped while this tab was already open: search for it.
    setSeenTag(q);
    if (q) setQuery(q);
  }
  const [category, setCategory] = useState<string | null>(null);
  const discover = useQuery({ queryKey: ["discover"], queryFn: api.discover });
  const term = useDebounced(query.trim(), 300);
  const searching = term.replace(/^#/, "").length >= 2;
  const results = useQuery({ queryKey: ["search", term], queryFn: () => api.search(term), enabled: searching });

  const tabSpace = useTabBarSpace();
  const browse = useMemo(
    () => (discover.data?.communities ?? []).filter((c) => !category || c.category === category),
    [discover.data, category],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Field value={query} onChangeText={setQuery} placeholder="Search communities, posts, people, #tags" autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" onSubmitEditing={Keyboard.dismiss} />
        {searching ? null : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
            ))}
          </ScrollView>
        )}
      </View>

      {searching ? (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: tabSpace + space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
          {results.isPending ? <Loading /> : results.isError ? <ErrorState error={results.error} onRetry={() => void results.refetch()} /> : (
            <SearchBody results={results.data} />
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={browse}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: tabSpace + space.lg, gap: space.md }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => <CommunityCard community={item} index={index} />}
          refreshing={discover.isRefetching}
          onRefresh={() => void discover.refetch()}
          ListEmptyComponent={
            discover.isPending ? <SkeletonList count={2} /> : discover.isError ? <ErrorState error={discover.error} onRetry={() => void discover.refetch()} /> : (
              <EmptyState icon="compass-outline" title="Nothing here yet" body="Be the first to start a community in this category." action={{ label: "Create a community", onPress: () => router.push("/new-community") }} />
            )
          }
        />
      )}
    </View>
  );
}

function SearchBody({ results }: { results: SearchResults }) {
  const empty = !results.communities.length && !results.posts.length && !results.people.length;
  if (empty) return <EmptyState icon="search-outline" title="No results" body={`Nothing matches “${results.query}”. Check the spelling, or try a #hashtag.`} />;
  return (
    <>
      {results.communities.length ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="label" tone="subtle">Communities</Txt>
          {results.communities.map((c, i) => <CommunityCard key={c.id} community={c} index={i} />)}
        </View>
      ) : null}
      {results.people.length ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="label" tone="subtle">People</Txt>
          {results.people.map((p) => (
            <Card key={p.userId} onPress={() => router.push(`/profile/${p.handle}`)} accessibilityLabel={`Open ${p.displayName}`} style={{ padding: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Avatar name={p.displayName} hue={p.hue} size={42} userId={p.userId} version={p.avatarV} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: font.bold }}>{p.displayName}</Txt>
                  <Txt variant="caption" tone="subtle">@{p.handle} · {p.rep} rep</Txt>
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      {results.posts.length ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="label" tone="subtle">Posts</Txt>
          {results.posts.map((post, i) => <PostCard key={post.id} post={post} showCommunity index={i} />)}
        </View>
      ) : null}
    </>
  );
}
