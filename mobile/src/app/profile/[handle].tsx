import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, View } from "react-native";
import { assetUrl } from "@/api/client";
import { api } from "@/api/endpoints";
import { AchievementBanner, AchievementTile } from "@/components/AchievementBanner";
import { LikeButton } from "@/components/LikeButton";
import { PostCard } from "@/components/PostCard";
import { ReportSheet, type ReportTarget } from "@/components/ReportSheet";
import { Appear, Avatar, Button, Card, Chip, ErrorState, Field, Loading, Screen, Sheet, Txt } from "@/components/ui";
import { showError, useAction } from "@/lib/errors";
import { compactCount, timeAgo } from "@/lib/format";
import { glowShadow, hueColor, hueGradient, radius, space, useTheme } from "@/theme";
import { tellIfHeld } from "@/lib/held";
import { byCategory, toggleShowcase } from "@/lib/achievements";
import { pickPhoto } from "@/lib/media";

/** Someone's public page: bio, stats, titles, achievements, wall and recent posts. */
export default function Profile() {
  const theme = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["profile", handle], queryFn: () => api.profile(handle!), enabled: !!handle });
  const [wall, setWall] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [allAchievements, setAllAchievements] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile", handle] });

  const [follow, following] = useAction(async () => {
    await api.followProfile(query.data!.profile.userId);
    await refresh();
  });
  const [message, messaging] = useAction(async () => {
    const { roomId } = await api.openDm(query.data!.profile.userId);
    router.push(`/chat/${roomId}`);
  });
  const [postWall, posting] = useAction(async () => {
    if (!wall.trim()) return;
    tellIfHeld(await api.addWallPost(query.data!.profile.handle, wall.trim()));
    setWall("");
    await refresh();
  });

  const [changeCover, changingCover] = useAction(async () => {
    const image = await pickPhoto("library", 1_400_000);
    if (!image) return;
    await api.setProfileCover(image);
    await refresh();
  }, { errorTitle: "Couldn't change the cover" });
  const coverMenu = () =>
    Alert.alert("Wall cover", "Show your own picture at the top of your profile.", [
      { text: "Choose a picture", onPress: () => void changeCover() },
      ...(query.data?.profile.cover
        ? [{ text: "Remove cover", style: "destructive" as const, onPress: () => void api.removeProfileCover().then(refresh, showError) }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  const [setShowcaseIds] = useAction(async (ids: string[]) => {
    await api.setShowcase(ids);
    await refresh();
  });

  const toggleBlock = () => {
    const data = query.data!;
    setMenuOpen(false);
    Alert.alert(data.blocked ? `Unblock @${data.profile.handle}?` : `Block @${data.profile.handle}?`, data.blocked ? undefined : "You won't see their posts or messages, and they can't message you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: data.blocked ? "Unblock" : "Block",
        style: data.blocked ? "default" : "destructive",
        onPress: () => {
          api.block(data.profile.userId).then(() => queryClient.invalidateQueries(), showError);
        },
      },
    ]);
  };

  if (query.isPending) return <Loading />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  const p = d.profile;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ title: `@${p.handle}` }} />
      {/* Colourful banner (their cover photo, or a gradient in their colour) with the avatar overlapping it. */}
      <Appear style={[{ borderRadius: radius.xl }, glowShadow(hueColor(p.avatarHue, theme.dark))]}>
        <View style={{ height: 150, borderRadius: radius.xl, overflow: "hidden" }}>
          <LinearGradient colors={hueGradient(p.avatarHue, theme.dark)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", inset: 0 }} />
          {p.cover ? <Image source={{ uri: assetUrl(p.cover) }} style={{ position: "absolute", inset: 0 }} contentFit="cover" transition={220} /> : null}
          <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }} style={{ position: "absolute", inset: 0 }} />
          {d.isSelf ? (
            <Pressable
              onPress={coverMenu}
              disabled={changingCover}
              accessibilityRole="button"
              accessibilityLabel="Change your wall cover"
              style={{ position: "absolute", top: space.sm, right: space.sm, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 }}
            >
              <Ionicons name="camera-outline" size={16} color="#fff" />
              <Txt variant="caption" style={{ color: "#fff" }}>{changingCover ? "Uploading…" : "Change cover"}</Txt>
            </Pressable>
          ) : null}
        </View>
      </Appear>
      <Card index={1} style={{ marginTop: -70, marginHorizontal: space.sm, alignItems: "center", paddingTop: 0 }}>
        <View style={{ marginTop: -46 }}>
          <Avatar name={p.displayName} hue={p.avatarHue} size={88} userId={p.userId} version={p.avatarVersion} ring frame={p.frame} />
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Txt variant="title" style={{ textAlign: "center" }}>{p.displayName}</Txt>
          <Txt tone="muted">@{p.handle}</Txt>
          {p.showOnline && p.lastSeenAt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.ok }} />
              <Txt variant="caption" tone="subtle">Active {timeAgo(p.lastSeenAt)}</Txt>
            </View>
          ) : null}
        </View>
        {d.featuredTitle ? <Chip label={d.featuredTitle.label} selected /> : null}
        {d.showcase.length ? (
          <View style={{ alignSelf: "stretch", gap: space.xs }}>
            {d.showcase.map((a) => <AchievementBanner key={a.id} achievement={a} />)}
          </View>
        ) : null}
        {p.status || p.mood ? <Txt variant="small" tone="accent" style={{ textAlign: "center" }}>{[p.mood, p.status].filter(Boolean).join(" · ")}</Txt> : null}
        {p.bio ? <Txt style={{ textAlign: "center" }}>{p.bio}</Txt> : null}
        <View style={{ flexDirection: "row", gap: space.sm, paddingTop: space.xs, alignSelf: "stretch" }}>
          <Stat value={compactCount(d.stats.reputation)} label="Reputation" />
          <Stat value={compactCount(d.stats.followers)} label="Followers" />
          <Stat value={compactCount(d.stats.following)} label="Following" />
        </View>
        {d.isSelf ? (
          <Button label="Edit profile" variant="secondary" onPress={() => router.push("/edit-profile")} style={{ alignSelf: "stretch" }} />
        ) : (
          <View style={{ flexDirection: "row", gap: space.sm, alignSelf: "stretch" }}>
            <Button label={d.viewerFollows ? "Following" : "Follow"} variant={d.viewerFollows ? "secondary" : "primary"} small style={{ flex: 1 }} onPress={() => void follow()} busy={following} />
            <Button label="Message" variant="secondary" small style={{ flex: 1 }} onPress={() => void message()} busy={messaging} />
            <Button label="•••" variant="ghost" small style={{ minWidth: 56 }} onPress={() => setMenuOpen(true)} accessibilityHint="Block or report this person" />
          </View>
        )}
      </Card>

      {d.titles.length ? (
        <Section title="Titles">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {d.titles.map((t) => <Chip key={t.id} label={`${t.label} · ${t.communityName}`} />)}
          </View>
        </Section>
      ) : null}

      <Section title={`Achievements · ${d.achievements.filter((a) => a.unlocked).length}/${d.achievements.length}`}>
        {d.isSelf ? <Txt variant="caption" tone="muted">Tap the star on up to three achievements to show them as banners on your profile.</Txt> : null}
        {byCategory(allAchievements ? d.achievements : d.achievements.filter((a) => a.unlocked)).map((group) => (
          <View key={group.category} style={{ gap: space.sm }}>
            <Txt variant="label" tone="subtle">{group.category}</Txt>
            {group.items.map((a) => (
              <AchievementTile
                key={a.id}
                achievement={a}
                showcased={d.showcase.some((x) => x.id === a.id)}
                onToggleShowcase={d.isSelf ? () => void setShowcaseIds(toggleShowcase(d.showcase.map((x) => x.id), a.id)) : undefined}
              />
            ))}
          </View>
        ))}
        {!d.achievements.some((a) => a.unlocked) && !allAchievements ? <Txt tone="muted">No achievements yet. Post, chat and play to unlock them.</Txt> : null}
        <Button label={allAchievements ? "Show unlocked only" : "Show all, with progress"} small variant="ghost" onPress={() => setAllAchievements((v) => !v)} />
      </Section>

      {d.characters.length ? (
        <Section title="Characters">
          {d.characters.map((c) => (
            <Card key={c.id} style={{ padding: space.md }}>
              <Txt variant="heading">{c.name}</Txt>
              {c.fandom ? <Txt variant="caption" tone="accent">{c.fandom}</Txt> : null}
              {c.bio ? <Txt variant="small" tone="muted">{c.bio}</Txt> : null}
            </Card>
          ))}
        </Section>
      ) : null}

      {d.joined.length ? (
        <Section title="Communities">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {d.joined.map((c) => <Chip key={c.id} label={c.name} onPress={() => router.push(`/community/${c.id}`)} />)}
          </View>
        </Section>
      ) : null}

      {d.pinnedWiki.length ? (
        <Section title="Pinned wiki pages">
          {d.pinnedWiki.map((w) => <PostCard key={w.id} post={w} />)}
        </Section>
      ) : null}

      <Section title="Wall">
        {d.blocked ? null : (
          <View style={{ gap: space.sm }}>
            <Field value={wall} onChangeText={setWall} placeholder={d.isSelf ? "Write on your own wall" : `Say something to ${p.displayName}`} maxLength={500} multiline />
            <Button label="Post" small onPress={() => void postWall()} busy={posting} style={{ alignSelf: "flex-end" }} />
          </View>
        )}
        {d.wall.map((w) => (
          <Card key={w.id} style={{ padding: space.md }}>
            <Txt variant="caption" tone="accent">{w.author.nickname} · {timeAgo(w.createdAt)}</Txt>
            <Txt>{w.body}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingTop: space.xs }}>
              <LikeButton liked={w.liked} count={w.likeCount} onPress={() => { api.likeWallPost(w.id).then(refresh, showError); }} size={20} />
              {d.isSelf ? <Button label="Delete" variant="ghost" small onPress={() => { api.deleteWallPost(w.id).then(refresh, showError); }} /> : null}
            </View>
          </Card>
        ))}
      </Section>

      {d.recent.length ? (
        <Section title="Recent posts">
          {d.recent.map((post) => <PostCard key={post.id} post={post} showCommunity />)}
        </Section>
      ) : null}

      <Sheet visible={menuOpen} title={`@${p.handle}`} onClose={() => setMenuOpen(false)}>
        <Button label={d.blocked ? "Unblock" : "Block"} variant="danger" onPress={toggleBlock} />
        <Button label="Report this person" variant="secondary" onPress={() => { setMenuOpen(false); setReport({ targetType: "user", targetId: p.userId, label: `@${p.handle}` }); }} />
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: theme.tint, borderRadius: 14, paddingVertical: space.sm }}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="muted">{label}</Txt>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt variant="label" tone="subtle">{title}</Txt>
      {children}
    </View>
  );
}
