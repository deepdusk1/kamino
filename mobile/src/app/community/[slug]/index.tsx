import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { imageSource } from "@/api/client";
import { communityColors } from "@/lib/communityColors";
import { api } from "@/api/endpoints";
import type { CommunityModule } from "@/api/types";
import { JoinSheet } from "@/components/JoinSheet";
import { PostCard } from "@/components/PostCard";
import { Appear, Button, Card, Chip, EmptyState, ErrorState, IconBubble, Loading, PressableScale, Txt } from "@/components/ui";
import { compactCount, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { font, glowShadow, hueColor, hueGradient, radius, space, useTheme, type Gradient, type Theme } from "@/theme";
import { withCommunityTheme } from "@/components/CommunityTheme";

const SECTIONS: { module: CommunityModule; label: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { module: "chats", label: "Chats", path: "chats", icon: "chatbubbles-outline" },
  { module: "wiki", label: "Wiki", path: "wiki", icon: "book-outline" },
  { module: "files", label: "Files", path: "files", icon: "folder-open-outline" },
  { module: "events", label: "Events", path: "events", icon: "calendar-outline" },
  { module: "rank", label: "Rank", path: "rank", icon: "trophy-outline" },
  { module: "members", label: "Members", path: "members", icon: "people-outline" },
];

function CommunityHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const page = useQuery({ queryKey: ["community", slug], queryFn: () => api.community(slug!), enabled: !!slug });
  const feeds = useQuery({ queryKey: ["feeds", slug], queryFn: () => api.feeds(slug!), enabled: !!slug });
  const [joinOpen, setJoinOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [checkIn, checkingIn] = useAction(async () => {
    await api.checkInCommunity(slug!);
    haptic.success();
    await queryClient.invalidateQueries({ queryKey: ["community", slug] });
  });

  const [leave, leaving] = useAction(async () => {
    await api.leave(slug!);
    await queryClient.invalidateQueries();
  });

  if (page.isPending) return <Loading />;
  if (page.isError || !page.data) return <ErrorState error={page.error} onRetry={() => void page.refetch()} />;

  const { community, member, locked, posts, stories, announcements, broadcasts } = page.data;
  const active = member?.status === "active";
  const pending = member?.status === "pending";
  const banned = member?.status === "banned";
  const canModerate = active && ["leader", "agent", "curator"].includes(member!.role);
  const look = communityColors(community.hue, community.themeStyle, theme.dark);
  const visibleSections = SECTIONS.filter((s) => community.modules.includes(s.module));

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <Appear style={[{ borderRadius: radius.xl }, glowShadow(hueColor(community.hue, theme.dark), "strong")]}>
       <View style={{ borderRadius: radius.xl, overflow: "hidden" }}>
        <LinearGradient colors={hueGradient(community.hue, theme.dark)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", inset: 0 }} />
        {community.cover ? <Image source={imageSource(community.cover)} style={{ height: 200 }} contentFit="cover" transition={220} /> : <View style={{ height: 200 }} />}
        <LinearGradient colors={[look.from, look.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", inset: 0, opacity: look.tint }} />
        <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.5 }} style={{ position: "absolute", inset: 0 }} />
        <LinearGradient colors={["transparent", "rgba(12,6,32,0.85)"]} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", inset: 0 }} />
        <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, flexDirection: "row", alignItems: "center", gap: space.md }}>
          {community.icon ? <Image source={imageSource(community.icon)} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#fff" }} contentFit="cover" accessibilityLabel="Community icon" /> : null}
          <View style={{ flex: 1 }}>
            <Txt variant="title" style={{ color: "#fff" }}>{community.name}</Txt>
            <Txt variant="small" style={{ color: "#ffffffd9" }}>{community.tagline}</Txt>
          </View>
        </View>
       </View>
      </Appear>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Txt variant="small" tone="muted">{compactCount(community.memberCount)} members · {community.category}{community.ageGate > 13 ? ` · ${community.ageGate}+` : ""}</Txt>
        </View>
        {active ? <Button label="Leave" variant="secondary" small onPress={() => void leave()} busy={leaving} /> : pending ? <Chip label="Request pending" /> : banned ? <Chip label="Removed" tone="danger" /> : <Button label="Join" small onPress={() => setJoinOpen(true)} />}
      </View>

      {active && member ? (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{member.streak ? `${member.streak}-day streak` : "Check in"}</Txt>
            <Txt variant="small" tone="muted">{member.checkedInToday ? "Checked in today. See you tomorrow!" : "Check in daily to earn reputation here."}</Txt>
          </View>
          <Button label={member.checkedInToday ? "Done ✓" : "Check in"} small variant={member.checkedInToday ? "secondary" : "primary"} disabled={member.checkedInToday} busy={checkingIn} onPress={() => void checkIn()} />
        </Card>
      ) : null}

      <Card onPress={() => setRulesOpen(!rulesOpen)} accessibilityLabel="Show community description and rules">
          <Txt variant="small" tone="muted" numberOfLines={rulesOpen ? undefined : 2}>{community.description}</Txt>
          {rulesOpen ? (
            <>
              <Txt variant="label" tone="subtle" style={{ paddingTop: space.sm }}>Community rules</Txt>
              <Txt variant="small">{community.rules || "Be kind. Follow the house laws."}</Txt>
            </>
          ) : null}
      </Card>

      {locked ? (
        <EmptyState icon="lock-closed-outline" title="Private community" body="Ask to join to see posts, chats and members." />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {visibleSections.map((s, i) => (
              <SectionIcon key={s.module} index={i} icon={s.icon} label={s.label} onPress={() => router.push(`/community/${slug}/${s.path}`)} />
            ))}
            {feeds.data?.length ? <SectionIcon index={visibleSections.length} icon="newspaper-outline" label="News" onPress={() => router.push(`/community/${slug}/news`)} /> : null}
            {active ? <SectionIcon index={visibleSections.length + 1} icon="shield-half-outline" label="Standing" onPress={() => router.push(`/community/${slug}/standing`)} /> : null}
            {canModerate ? <SectionIcon index={visibleSections.length + 2} icon="shield-checkmark-outline" label="Mod" onPress={() => router.push(`/community/${slug}/mod`)} /> : null}
          </ScrollView>

          {broadcasts[0] ? (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <IconBubble icon="megaphone" colors={theme.gradWarm} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="label" tone="accent">Broadcast · {timeAgo(broadcasts[0].createdAt)}</Txt>
                <Txt>{broadcasts[0].body}</Txt>
              </View>
            </Card>
          ) : null}

          {stories.length ? (
            <View style={{ gap: space.sm }}>
              <Txt variant="label" tone="subtle">Stories · disappear after 24 hours</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                {stories.map((s) => (
                  <PressableScale key={s.id} onPress={() => router.push(`/community/${slug}/post/${s.id}`)} accessibilityLabel={`Story by ${s.author.nickname}`} scaleTo={0.94}>
                    {/* A gradient ring, like stories elsewhere, so they stand out as "new". */}
                    <LinearGradient colors={[theme.gradPrimary[0], theme.gradPrimary[1], theme.gradWarm[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 2.5, borderRadius: radius.md + 3 }}>
                      <View style={{ width: 92, height: 130, borderRadius: radius.md, overflow: "hidden", backgroundColor: hueColor(s.author.hue, theme.dark) }}>
                        {s.cover ? <Image source={imageSource(s.cover)} style={{ flex: 1 }} contentFit="cover" /> : null}
                        <LinearGradient colors={["transparent", "rgba(12,6,32,0.7)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 50 }} />
                        <Txt variant="caption" numberOfLines={1} style={{ position: "absolute", bottom: 6, left: 6, right: 6, color: "#fff" }}>{s.author.nickname}</Txt>
                      </View>
                    </LinearGradient>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {announcements.map((a) => (
            <PostCard key={a.id} post={a} />
          ))}
          <Txt variant="label" tone="subtle">Posts</Txt>
        </>
      )}
    </View>
  );

  const feed = locked ? [] : posts.filter((p) => !p.announcement);
  return (
    <>
      <Stack.Screen options={{ title: community.name }} />
      <FlatList
        data={feed}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 110 + insets.bottom }}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => <PostCard post={item} index={index} />}
        refreshing={page.isRefetching}
        onRefresh={() => void page.refetch()}
        ListEmptyComponent={locked ? null : <EmptyState icon="pencil-outline" title="No posts yet" body={active ? "Be the first to post here." : "Join to start posting."} />}
      />
      {active ? (
        <Appear index={3} style={{ position: "absolute", right: space.lg, bottom: space.xl + insets.bottom }}>
          <PressableScale onPress={() => router.push(`/community/${slug}/compose`)} accessibilityLabel="New post" scaleTo={0.92} style={[{ borderRadius: radius.pill }, glowShadow(theme.glow, "strong")]}>
            <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.pill, paddingHorizontal: space.xl, height: 54 }}>
              <Ionicons name="create" size={20} color="#fff" />
              <Txt style={{ color: "#fff", fontFamily: font.heavy }}>Post</Txt>
            </LinearGradient>
          </PressableScale>
        </Appear>
      ) : null}
      <JoinSheet community={community} questions={page.data.joinQuestions} visible={joinOpen} onClose={() => setJoinOpen(false)} onJoined={() => void page.refetch()} />
    </>
  );
}

/** Each shortcut gets its own bright colour so the row reads like a set of app icons. */
const SECTION_COLORS = (t: Theme): Gradient[] => [t.gradPrimary, t.gradCool, ["#059669", "#0e7490"], t.gradWarm, ["#d97706", "#b45309"], ["#db2777", "#7c3aed"]];

function SectionIcon({ icon, label, onPress, index }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; index: number }) {
  const theme = useTheme();
  const colors = SECTION_COLORS(theme);
  // Filled icons look better on a coloured bubble than outlines.
  const filled = icon.replace(/-outline$/, "") as keyof typeof Ionicons.glyphMap;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} scaleTo={0.88} style={{ alignItems: "center", gap: 6, width: 68 }}>
      <View style={[{ borderRadius: 18 }, glowShadow(colors[index % colors.length]![0])]}>
        <IconBubble icon={filled} colors={colors[index % colors.length]!} size={52} />
      </View>
      <Txt variant="caption" tone="muted">{label}</Txt>
    </PressableScale>
  );
}

export default withCommunityTheme(CommunityHome);
