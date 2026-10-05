import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { platform } from '@/api/platform-v9';
import { RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/endpoints";
import type { HallEvent, Post } from "@/api/types";
import { withCommunityTheme } from "@/components/CommunityTheme";
import { JoinSheet } from "@/components/JoinSheet";
import { ReportSheet, type ReportTarget } from "@/components/ReportSheet";
import { ActionMenu, type MenuItem } from "@/components/community/ActionMenu";
import { EventsPanel, MediaGrid, ModeratorsRow, RecentPostRow, RoomsPanel, TopicChips } from "@/components/community/CommunityParts";
import { parseTopics } from "@/components/community/helpers";
import { serverImage } from "@/components/community/media";
import { confirmAction, notify, shareLink } from "@/components/community/platform";
import {
  AppHeader, EmptyHint, GradientButton, JoinButton, Picture, Pill, PostTile, RankCard, SectionHeader, StatCard, TabsUnderline, VerifiedTick,
  personFromChip,
} from "@/components/k";
import { ErrorState, Field, Loading, PressableScale, Sheet, SkeletonList, Txt } from "@/components/ui";
import { defaultCover } from "@/lib/brandArt";
import { showError, useAction } from "@/lib/errors";
import { compactNumber, timeAgo } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { font, radius, shadow, useTheme } from "@/theme";

type Tab = "posts" | "rooms" | "events" | "media";
const TABS = [
  { key: "posts", label: "Posts", icon: "document-text-outline" },
  { key: "rooms", label: "Rooms", icon: "pulse-outline" },
  { key: "events", label: "Events", icon: "calendar-outline" },
  { key: "media", label: "Media", icon: "image-outline" },
] as const;

/**
 * A community's home page (mockup 05-community): cover, square icon, name, members / online, Join, description,
 * topic chips, three stat cards, moderators, then tabs Posts / Rooms / Events / Media.
 * Everything else a community has (chats, wiki, files, leaderboard, members, stories, news, standing, moderation,
 * look, rules, check-in, leave) is in the ⋯ menu at the top. Members get a "new post" button bottom-right.
 */
function CommunityHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  useEffect(()=>{if(slug)void platform.visit(slug).catch(()=>{});},[slug]);
  const queryClient = useQueryClient();
  const page = useQuery({ queryKey: ["community", slug], queryFn: () => api.community(slug!), enabled: !!slug });
  const overview = useQuery({ queryKey: ["communityOverview", slug], queryFn: () => api.communityOverview(slug!), enabled: !!slug });
  const feeds = useQuery({ queryKey: ["feeds", slug], queryFn: () => api.feeds(slug!), enabled: !!slug });

  const [tab, setTab] = useState<Tab>("posts");
  const [showAll, setShowAll] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [topicsText, setTopicsText] = useState("");
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [postMenu, setPostMenu] = useState<Post | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState<number | null>(null);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["community", slug] }),
      queryClient.invalidateQueries({ queryKey: ["communityOverview", slug] }),
    ]);
  };

  const [checkIn, checkingIn] = useAction(async () => {
    const result = await api.checkInCommunity(slug!);
    haptic.success();
    if (!result.already) notify(`${result.streak}-day streak! 🔥`, "Checked in. See you tomorrow!");
    await refreshAll();
  });
  const [join, joining] = useAction(async () => {
    const result = await api.join({ slug: slug! });
    if (result.pending) notify("Request sent", "The leaders will review your request. You'll get a notification when you're in.");
    else haptic.success();
    await refreshAll();
    void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    void queryClient.invalidateQueries({ queryKey: ["exploreOverview"] });
  });
  const [leave] = useAction(async () => {
    if (!(await confirmAction("Leave this community?", "You can join again any time.", "Leave", true))) return;
    await api.leave(slug!);
    await refreshAll();
    void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    void queryClient.invalidateQueries({ queryKey: ["exploreOverview"] });
  });
  const [saveTopics, savingTopics] = useAction(async () => {
    await api.setCommunityTopics(slug!, parseTopics(topicsText));
    setTopicsOpen(false);
    await refreshAll();
  });
  const [startRoom, startingRoom] = useAction(async () => {
    const name = roomName.trim();
    if (!name) return notify("Name your room", "Give the room a short name first.");
    const result = await api.startLiveRoom(slug!, name);
    setRoomOpen(false);
    setRoomName("");
    void refreshAll();
    router.push(`/chat/${result.roomId}`);
  });

  async function rsvp(e: HallEvent) {
    setRsvpBusy(e.id);
    try {
      await api.rsvp(slug!, e.id);
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: ["communityOverview", slug] });
    } catch (error) {
      showError(error);
    } finally {
      setRsvpBusy(null);
    }
  }

  if (page.isPending) return <Loading />;
  if (page.isError || !page.data) return <ErrorState error={page.error} onRetry={() => void page.refetch()} />;

  const { community, member, locked, stories, announcements, broadcasts } = page.data;
  const ov = overview.data;
  const active = member?.status === "active";
  const pending = member?.status === "pending";
  const banned = member?.status === "banned";
  const role = member?.role ?? "member";
  const canModerate = active && ["leader", "agent", "curator"].includes(role);
  const isLeader = active && ["leader", "agent"].includes(role);
  const has = (m: string) => community.modules.includes(m as never);
  const go = (path: string) => router.push(`/community/${slug}/${path}` as never);
  const memberCount = ov?.community.memberCount ?? community.memberCount;
  const onlineCount = ov?.onlineCount ?? 0;

  const onJoinPress = () => {
    // Private communities (questions, invite codes) use the join form; public ones join straight away.
    if (community.visibility === "private" || page.data.joinQuestions.length) setJoinOpen(true);
    else void join();
  };

  const menu: MenuItem[] = [
    {key:'tools',label:'Community tools, boards & FAQs',icon:'grid-outline',onPress:()=>go('tools')},
    ...(active && !member!.checkedInToday ? [{ key: "checkin", label: "Check in today", icon: "flame" as const, tone: "orange" as const, hint: "Earn reputation and keep your streak", onPress: () => void checkIn() }] : []),
    ...(active ? [{ key: "post", label: "New post", icon: "create-outline" as const, onPress: () => go("compose") }] : []),
    ...(has("chats") ? [{ key: "chats", label: "Chat rooms", icon: "chatbubbles-outline" as const, tone: "blue" as const, onPress: () => go("chats") }] : []),
    ...(has("wiki") ? [{ key: "wiki", label: "Wiki", icon: "book-outline" as const, tone: "green" as const, onPress: () => go("wiki") }] : []),
    ...(has("files") ? [{ key: "files", label: "Shared files", icon: "folder-open-outline" as const, tone: "orange" as const, onPress: () => go("files") }] : []),
    ...(has("events") ? [{ key: "events", label: "Events & challenges", icon: "calendar-outline" as const, tone: "pink" as const, onPress: () => go("events") }] : []),
    ...(has("rank") ? [{ key: "rank", label: "Leaderboard", icon: "trophy-outline" as const, tone: "yellow" as const, onPress: () => go("rank") }] : []),
    ...(has("members") ? [{ key: "members", label: "Members", icon: "people-outline" as const, onPress: () => go("members") }] : []),
    ...(has("roleplay") ? [{ key: "stories", label: "Stories & role-play", icon: "color-wand-outline" as const, tone: "pink" as const, onPress: () => go("roleplay") }] : []),
    ...(feeds.data?.length || isLeader ? [{ key: "news", label: "News feed", icon: "newspaper-outline" as const, tone: "blue" as const, onPress: () => go("news") }] : []),
    { key: "info", label: "About & rules", icon: "information-circle-outline", tone: "violet", onPress: () => setInfoOpen(true) },
    { key: "share", label: "Share community", icon: "share-outline", tone: "blue", onPress: () => void shareLink(community.name, `/c/${slug}`) },
    ...(active ? [{ key: "standing", label: "My standing", icon: "shield-half-outline" as const, tone: "green" as const, hint: member!.streak ? `${member!.streak}-day check-in streak` : undefined, onPress: () => go("standing") }] : []),
    ...(isLeader ? [{ key: "topics", label: "Edit topics", icon: "pricetags-outline" as const, onPress: () => openTopics() }] : []),
    ...(isLeader ? [{ key: "look", label: "Community look", icon: "color-palette-outline" as const, tone: "pink" as const, onPress: () => go("look") }] : []),
    ...(canModerate ? [{ key: "mod", label: "Moderation", icon: "shield-checkmark-outline" as const, tone: "violet" as const, onPress: () => go("mod") }] : []),
    ...(active && community.createdBy !== member!.userId ? [{ key: "leave", label: "Leave community", icon: "exit-outline" as const, destructive: true, onPress: () => void leave() }] : []),
  ];

  function openTopics() {
    setTopicsText((ov?.community.topics ?? community.topics).join(", "));
    setTopicsOpen(true);
  }

  const postMenuItems: MenuItem[] = postMenu
    ? [
        { key: "open", label: "Open post", icon: "open-outline", onPress: () => go(`post/${postMenu.id}`) },
        { key: "share", label: "Share", icon: "share-outline", tone: "blue", onPress: () => void shareLink(postMenu.title, `/c/${slug}/p/${postMenu.id}`) },
        { key: "save", label: postMenu.saved ? "Remove from saved" : "Save", icon: postMenu.saved ? "bookmark" : "bookmark-outline", tone: "orange", onPress: () => void api.save(postMenu.id).then(() => refreshAll()).catch(showError) },
        { key: "profile", label: `View ${postMenu.author.nickname}'s profile`, icon: "person-outline", tone: "green", onPress: () => router.push(`/profile/${postMenu.author.handle}`) },
        ...(postMenu.author.userId !== member?.userId ? [{ key: "report", label: "Report", icon: "flag-outline" as const, destructive: true, onPress: () => setReport({ targetType: "post", targetId: String(postMenu.id), communityId: slug, label: "post" }) }] : []),
      ]
    : [];

  const recent = showAll ? page.data.posts.filter((p) => !p.announcement) : (ov?.recent ?? page.data.posts.slice(0, 6));
  const featured = ov?.featured ?? [];
  const topics = ov?.community.topics ?? community.topics;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={page.isRefetching || overview.isRefetching} onRefresh={() => void refreshAll()} tintColor={theme.accent} colors={[theme.accent]} />}
      >
        <AppHeader back actions={["search", "share", "more"]} onShare={() => void shareLink(community.name, `/c/${slug}`)} onMore={() => setMenuOpen(true)} />

        {/* Cover (rounded bottom corners), then the square icon overlapping it. */}
        <Picture
          source={community.cover ? serverImage(community.cover) : defaultCover(community.hue)}
          hue={community.hue}
          style={{ height: 138, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}
        />
        <View style={{ flexDirection: "row", paddingHorizontal: 12, gap: 12 }}>
          <View style={[{ marginTop: -42, width: 104, height: 104, borderRadius: 24, borderWidth: 4, borderColor: theme.surface, backgroundColor: theme.surface }, shadow.card]}>
            <Picture source={community.icon ? serverImage(community.icon) : null} hue={community.hue} label={community.name} radius={20} style={{ flex: 1 }} />
          </View>
          <View style={{ flex: 1, paddingTop: 8, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Txt accessibilityRole="header" numberOfLines={2} style={{ fontFamily: font.heavy, fontSize: 21, lineHeight: 25, letterSpacing: -0.4, color: theme.ink, flexShrink: 1 }}>{community.name}</Txt>
                  {community.verified ? <VerifiedTick size={16} /> : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="people" size={14} color={theme.toneText.violet} />
                    <Txt style={{ fontFamily: font.semibold, fontSize: 12, lineHeight: 16, color: theme.text }}>{compactNumber(memberCount)} Members</Txt>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.green }} />
                    <Txt style={{ fontFamily: font.semibold, fontSize: 12, lineHeight: 16, color: theme.text }}>{compactNumber(onlineCount)} Online</Txt>
                  </View>
                </View>
              </View>
              {active ? (
                <JoinButton joined color={theme.violet} joinedLabel="Joined" size="md" onPress={() => setMenuOpen(true)} accessibilityLabel="Joined. Open community menu" style={{ marginTop: 2, height: 34, paddingHorizontal: 16 }} />
              ) : pending ? (
                <Pill label="Requested" icon="time-outline" tone="orange" size="md" style={{ marginTop: 6 }} />
              ) : banned ? (
                <Pill label="Removed" tone="red" size="md" style={{ marginTop: 6 }} />
              ) : (
                <GradientButton label="Join" onPress={onJoinPress} busy={joining} style={{ marginTop: 2, height: 36, minWidth: 92 }} accessibilityLabel={`Join ${community.name}`} />
              )}
            </View>
            <PressableScale onPress={() => setDescOpen(!descOpen)} haptics={false} scaleTo={1} accessibilityLabel={descOpen ? "Show less" : "Show the whole description"} style={{ marginTop: 2 }}>
              <Txt numberOfLines={descOpen ? undefined : 3} style={{ fontFamily: font.regular, fontSize: 12.5, lineHeight: 17, color: theme.muted }}>{community.description || community.tagline}</Txt>
            </PressableScale>
          </View>
        </View>

        <View style={{ marginTop: 12, gap: 12 }}>
          <TopicChips topics={topics} onPress={(t) => router.push({ pathname: "/explore", params: { q: t } })} onEdit={isLeader ? openTopics : undefined} />

          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16 }}>
            <StatCard value={memberCount} label="Members" icon="people" tone="violet" faces={(ov?.memberFaces ?? []).map(personFromChip)} />
            <StatCard value={onlineCount} label="Online Now" dot tone="pink" faces={(ov?.onlineFaces ?? []).map(personFromChip)} onPress={has("members") ? () => go("members") : undefined} />
            <RankCard percent={ov?.rankPercent ?? 100} category={`${community.category} Community`} onPress={has("rank") ? () => go("rank") : undefined} style={{ flex: 1.25 }} />
          </View>

          {active && !member!.checkedInToday ? (
            <LinearGradient colors={theme.gradStreak} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginHorizontal: 16, borderRadius: radius.tile, borderWidth: 1, borderColor: theme.border, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Txt style={{ fontSize: 22, lineHeight: 28 }}>🔥</Txt>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: font.heavy, fontSize: 13.5, color: theme.toneText.orange }}>{member!.streak ? `${member!.streak}-day streak` : "Daily check-in"}</Txt>
                <Txt style={{ fontFamily: font.regular, fontSize: 12, color: theme.text }}>Check in daily to earn reputation here.</Txt>
              </View>
              <GradientButton label="Check in" size="sm" busy={checkingIn} onPress={() => void checkIn()} />
            </LinearGradient>
          ) : null}

          {ov?.moderators.length ? (
            <View style={{ gap: 8 }}>
              <SectionHeader icon="shield" iconColor={theme.violet} title="Moderators" small onAction={has("members") ? () => go("members") : undefined} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
              <ModeratorsRow moderators={ov.moderators} />
            </View>
          ) : null}

          {locked ? (
            <EmptyHint icon="lock-closed-outline" title="Private community" text="Ask to join to see posts, chats and members." actionLabel={!active && !pending ? "Ask to join" : undefined} onAction={() => setJoinOpen(true)} style={{ marginHorizontal: 16 }} />
          ) : (
            <>
              <View style={[{ marginHorizontal: 12, backgroundColor: theme.surface, borderRadius: radius.tile, paddingTop: 4 }, shadow.card]}>
                <TabsUnderline tabs={TABS} value={tab} onChange={(k) => setTab(k as Tab)} />
              </View>

              {tab === "posts" ? (
                <View style={{ gap: 12 }}>
                  {broadcasts[0] ? (
                    <View style={{ marginHorizontal: 16, flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: radius.tile, backgroundColor: theme.tints.blue }}>
                      <Ionicons name="megaphone" size={20} color={theme.toneText.blue} />
                      <View style={{ flex: 1 }}>
                        <Txt style={{ fontFamily: font.bold, fontSize: 12, color: theme.toneText.blue }}>Broadcast · {timeAgo(broadcasts[0].createdAt)}</Txt>
                        <Txt style={{ fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, color: theme.text }}>{broadcasts[0].body}</Txt>
                      </View>
                    </View>
                  ) : null}

                  {stories.length ? (
                    <View style={{ gap: 8 }}>
                      <SectionHeader emoji="⏳" title="Stories" small style={{ paddingHorizontal: 16 }} />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                        {stories.map((s) => (
                          <PressableScale key={s.id} onPress={() => go(`post/${s.id}`)} accessibilityLabel={`Story by ${s.author.nickname}`} scaleTo={0.94} style={{ alignItems: "center", gap: 4, width: 66 }}>
                            <LinearGradient colors={[theme.pink, theme.violet, theme.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 2.5, borderRadius: 33 }}>
                              <View style={{ padding: 2, borderRadius: 31, backgroundColor: theme.bg }}>
                                <Picture source={s.cover ? serverImage(s.cover) : null} hue={s.author.hue} label={s.author.nickname} radius={27} style={{ width: 54, height: 54 }} />
                              </View>
                            </LinearGradient>
                            <Txt numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 11, color: theme.text }}>{s.author.nickname}</Txt>
                          </PressableScale>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {announcements.length ? (
                    <View style={{ gap: 8, paddingHorizontal: 16 }}>
                      <SectionHeader emoji="📣" title="Announcements" small />
                      {announcements.map((a) => <RecentPostRow key={a.id} post={a} slug={slug!} onMore={() => setPostMenu(a)} />)}
                    </View>
                  ) : null}

                  {featured.length ? (
                    <View style={{ gap: 8 }}>
                      <SectionHeader emoji="⭐" title="Featured Posts" onAction={() => setShowAll(true)} actionIcon="chevron" style={{ paddingHorizontal: 16 }} />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 2 }}>
                        {featured.map((p) => (
                          <PostTile
                            key={p.id}
                            title={p.title}
                            image={p.cover ? serverImage(p.cover) : null}
                            hue={p.author.hue}
                            likes={p.likeCount}
                            comments={p.commentCount}
                            author={personFromChip(p.author)}
                            verified={p.authorVerified}
                            time={timeAgo(p.createdAt)}
                            pinned={p.pinned}
                            width={Math.min(150, Math.floor((width - 48) / 2.9))}
                            onPress={() => go(`post/${p.id}`)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View style={{ gap: 8, paddingHorizontal: 16 }}>
                    <SectionHeader icon="document-text" iconColor={theme.violet} title="Recent Posts" onAction={showAll ? undefined : () => setShowAll(true)} actionIcon="chevron" />
                    {overview.isPending && !showAll ? (
                      <SkeletonList count={2} />
                    ) : recent.length ? (
                      recent.map((p) => <RecentPostRow key={p.id} post={p} slug={slug!} onMore={() => setPostMenu(p)} />)
                    ) : (
                      <EmptyHint emoji="✏️" title="No posts yet" text={active ? "Be the first to post here." : "Join to start posting."} actionLabel={active ? "Write a post" : undefined} onAction={() => go("compose")} />
                    )}
                  </View>
                </View>
              ) : tab === "rooms" ? (
                <RoomsPanel slug={slug!} rooms={ov?.rooms ?? []} canStart={active} onStart={() => setRoomOpen(true)} />
              ) : tab === "events" ? (
                <EventsPanel slug={slug!} events={ov?.events ?? page.data.events} canRsvp={active} busyId={rsvpBusy} onRsvp={(e) => void rsvp(e)} />
              ) : (
                <MediaGrid slug={slug!} media={ov?.media ?? []} width={width} />
              )}
            </>
          )}
        </View>
      </ScrollView>

      {active ? (
        <PressableScale onPress={() => go("compose")} accessibilityLabel="New post" scaleTo={0.9} style={[{ position: "absolute", right: 18, bottom: insets.bottom + 22, width: 56, height: 56, borderRadius: 28 }, shadow.glow(theme.gradFab[1], 0.4)]}>
          <LinearGradient colors={theme.gradFab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 28, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="create" size={24} color="#fff" />
          </LinearGradient>
        </PressableScale>
      ) : null}

      <ActionMenu visible={menuOpen} title={community.name} items={menu} onClose={() => setMenuOpen(false)} />
      <ActionMenu visible={!!postMenu} title="Post options" items={postMenuItems} onClose={() => setPostMenu(null)} />
      <ReportSheet target={report} onClose={() => setReport(null)} />
      <JoinSheet community={community} questions={page.data.joinQuestions} visible={joinOpen} onClose={() => setJoinOpen(false)} onJoined={() => void refreshAll()} />

      <Sheet visible={infoOpen} title={`About ${community.name}`} onClose={() => setInfoOpen(false)}>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill label={community.category} tone="violet" />
          <Pill label={community.visibility === "public" ? "Public" : community.visibility === "private" ? "Private" : "Unlisted"} tone="blue" />
          {community.ageGate > 13 ? <Pill label={`${community.ageGate}+`} tone="pink" /> : null}
          <Pill label={`Since ${new Date(community.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`} tone="neutral" />
        </View>
        <Txt style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.text }}>{community.description}</Txt>
        <Txt style={{ fontFamily: font.heavy, fontSize: 15, color: theme.ink }}>Community rules</Txt>
        <Txt style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.text }}>{community.rules || "Be kind. Follow the house laws."}</Txt>
      </Sheet>

      <Sheet visible={topicsOpen} title="Topics" onClose={() => setTopicsOpen(false)}>
        <Txt style={{ fontFamily: font.regular, fontSize: 14, color: theme.muted }}>Up to 8 short topics, separated by commas. They show as chips under the description.</Txt>
        <Field label="Topics" value={topicsText} onChangeText={setTopicsText} placeholder="Anime, Manga, Fan Art" maxLength={240} />
        <TopicChips topics={parseTopics(topicsText)} onPress={() => undefined} />
        <GradientButton label="Save topics" size="lg" full busy={savingTopics} onPress={() => void saveTopics()} />
      </Sheet>

      <Sheet visible={roomOpen} title="Start a live room" onClose={() => setRoomOpen(false)}>
        <Txt style={{ fontFamily: font.regular, fontSize: 14, color: theme.muted }}>A voice room everyone in {community.name} can join. Your followers here get a heads-up.</Txt>
        <Field label="Room name" value={roomName} onChangeText={setRoomName} placeholder="Late Night Vibes" maxLength={60} />
        <GradientButton label="Go live" icon="mic" size="lg" full busy={startingRoom} onPress={() => void startRoom()} />
      </Sheet>
    </View>
  );
}

export default withCommunityTheme(CommunityHome);
