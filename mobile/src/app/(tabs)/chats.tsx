import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { api } from "@/api/endpoints";
import type { ChatOverviewRoom, LiveRoomCard as LiveRoom } from "@/api/types";
import {
  AppHeader,
  EmptyHint,
  GradientButton,
  LiveRoomCard,
  MessageRow,
  Picture,
  PersonAvatar,
  SectionHeader,
  VerifiedTick,
  personFromChip,
  useColumnWidth,
  type FilterItem,
} from "@/components/k";
import { isLiveKind, roomPerson, roomPreview, roomTitle, topicIcon } from "@/components/chat/rooms";
import { OptionRow } from "@/components/create/parts";
import { StartRoomSheet } from "@/components/create/StartRoomSheet";
import { Button, ErrorState, Field, PressableScale, Sheet, SkeletonList, Txt, useTabBarSpace } from "@/components/ui";
import { heroArt } from "@/lib/brandArt";
import { errorMessage } from "@/lib/errors";
import { shortTimeAgo } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import { font, radius, shadow, useTheme } from "@/theme";

type Filter = "all" | "dm" | "groups" | "live" | "requests";

/**
 * Chats & Live Rooms (mockup 08-chats): a hero card with "Start a Room", filter pills, "Live Rooms Now" cards and
 * the Messages list. Long-press a chat to pin or mute it. Message requests (DMs from people you don't follow and
 * share no community with) wait under "Requests (n)" until you accept or decline them.
 */
export default function Chats() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const tabSpace = useTabBarSpace();
  const cardWidth = useColumnWidth(4, { inset: 12, gap: 8 });
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<null | "room" | "new">(null);
  const [menuFor, setMenuFor] = useState<ChatOverviewRoom | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const overview = useQuery({ queryKey: ["chatsOverview"], queryFn: api.chatsOverview, refetchInterval: 15_000 });
  const live = useQuery({ queryKey: ["liveRooms", "all"], queryFn: () => api.liveRooms("all"), refetchInterval: 30_000 });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["chatsOverview"] });
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  const rooms = overview.data?.rooms ?? [];
  const requests = rooms.filter((r) => r.isRequest);
  const requestCount = Math.max(overview.data?.requests ?? 0, requests.length);
  // Pinned first, then the most recent conversation; rooms without messages go last.
  const sorted = rooms
    .filter((r) => !r.isRequest)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  const shown =
    filter === "dm"
      ? sorted.filter((r) => r.kind === "dm")
      : filter === "groups"
        ? sorted.filter((r) => r.isGroup)
        : filter === "live"
          ? sorted.filter((r) => isLiveKind(r.kind))
          : filter === "requests"
            ? requests
            : sorted.filter((r) => !(isLiveKind(r.kind) && !r.lastAt));

  const filters: FilterItem[] = [
    { key: "all", label: "All Chats", icon: "chatbubble-ellipses" },
    { key: "dm", label: "Direct Messages", icon: "people-outline" },
    { key: "groups", label: "Groups", icon: "people" },
    { key: "live", label: "Live Rooms", icon: "pulse" },
    ...(requestCount > 0 ? [{ key: "requests", label: "Requests", icon: "mail-unread-outline" as const, count: requestCount }] : []),
  ];

  /** Opens a live room; joins its community first when needed. */
  const joinRoom = async (room: LiveRoom) => {
    setNotice(null);
    try {
      if (!room.joined) {
        const joined = await api.join({ slug: room.communityId });
        if (joined.pending) {
          setNotice(`You asked to join ${room.communityName}. You can hop in once a leader says yes.`);
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ["me"] });
        void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      }
      router.push(`/chat/${room.roomId}`);
    } catch {
      // Communities with join questions or rules: their page explains how to join.
      router.push(`/community/${room.communityId}`);
    }
  };

  const answerRequest = async (room: ChatOverviewRoom, accept: boolean) => {
    setBusyId(room.id);
    try {
      if (accept) await api.acceptMessageRequest(room.id);
      else await api.declineMessageRequest(room.id);
      refreshAll();
      if (accept) router.push(`/chat/${room.id}`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const setPref = async (room: ChatOverviewRoom, prefs: { pinned?: boolean; muted?: boolean }) => {
    setMenuFor(null);
    try {
      await api.roomPreference(room.id, prefs);
      refreshAll();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const liveRooms = live.data ?? [];
  const showLive = filter === "all" || filter === "live";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabSpace + 12 }}
        refreshControl={<RefreshControl refreshing={overview.isRefetching} onRefresh={() => { void overview.refetch(); void live.refetch(); }} tintColor={theme.accent} colors={[theme.accent]} />}
      >
        <AppHeader />
        <Button label="Create a group chat" variant="secondary" onPress={()=>router.push('/inbox-tools' as never)}/>

        {/* ── Hero ── */}
        <View style={[{ marginHorizontal: 10, height: 150, borderRadius: radius.hero, overflow: "hidden", backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }, shadow.card]}>
          <Picture source={heroArt.chats} radius={14} style={{ position: "absolute", right: 10, top: 9, bottom: 9, width: "46%" }} />
          <View style={{ flex: 1, justifyContent: "center", paddingLeft: 14, paddingRight: "50%", gap: 4 }}>
            <Txt accessibilityRole="header" style={{ fontFamily: font.heavy, fontSize: 29, lineHeight: 30, letterSpacing: -0.8, color: theme.ink }}>{"Chats &\nLive Rooms"}</Txt>
            <Txt style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 15, letterSpacing: -0.15, color: theme.muted, width: 200 }}>Message friends, join live rooms, and be part of the conversation.</Txt>
            <GradientButton label="Start a Room" iconRight="arrow-forward" onPress={() => setSheet("room")} style={{ marginTop: 6, height: 33 }} />
          </View>
        </View>

        <ChatFilters items={filters} value={filter} onChange={(k) => setFilter(k as Filter)} />

        {notice ? (
          <PressableScale onPress={() => setNotice(null)} accessibilityLabel={`${notice}. Dismiss`} scaleTo={0.98} style={{ marginHorizontal: 12, marginTop: 4, padding: 10, borderRadius: 12, backgroundColor: theme.tints.orange, flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons name="information-circle" size={18} color={theme.toneText.orange} />
            <Txt style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, lineHeight: 17, color: theme.toneText.orange }}>{notice}</Txt>
          </PressableScale>
        ) : null}

        {/* ── Live Rooms Now ── */}
        {showLive ? (
          <View style={{ marginTop: 6 }}>
            <SectionHeader icon="pulse" title="Live Rooms Now" onAction={filter === "all" && liveRooms.length > 4 ? () => setFilter("live") : undefined} actionIcon="chevron" style={{ paddingHorizontal: 12 }} />
            {live.isPending ? (
              <View style={{ paddingHorizontal: 12 }}><SkeletonList count={1} /></View>
            ) : liveRooms.length === 0 ? (
              <EmptyHint emoji="🎧" title="No live rooms right now" text="Start one and your community can hop in." actionLabel="Start a Room" onAction={() => setSheet("room")} style={{ marginHorizontal: 12, marginTop: 4 }} />
            ) : filter === "live" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, marginTop: 4 }}>
                {liveRooms.map((r, i) => <LiveCard key={r.roomId} room={r} index={i} width={cardWidth} onJoin={() => void joinRoom(r)} />)}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
                {liveRooms.map((r, i) => <LiveCard key={r.roomId} room={r} index={i} width={cardWidth} onJoin={() => void joinRoom(r)} />)}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* ── Messages ── */}
        <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.violet, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chatbubble" size={13} color="#fff" />
            </View>
            <Txt accessibilityRole="header" style={{ flex: 1, fontFamily: font.heavy, fontSize: 16.5, lineHeight: 22, letterSpacing: -0.2, color: theme.ink }}>
              {filter === "requests" ? "Message requests" : filter === "live" ? "Your live rooms" : "Messages"}
            </Txt>
            <PressableScale onPress={() => setSheet("new")} accessibilityLabel="New message" hitSlop={6} scaleTo={0.95} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 }}>
              <Txt style={{ fontFamily: font.semibold, fontSize: 13, lineHeight: 17, color: theme.accent }}>New Message</Txt>
              <View style={[{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.violet, alignItems: "center", justifyContent: "center" }, shadow.glow(theme.violet, 0.3)]}>
                <Ionicons name="add" size={19} color="#fff" />
              </View>
            </PressableScale>
          </View>

          {filter === "requests" ? (
            <Txt style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: theme.muted, marginBottom: 4 }}>
              People you don’t follow (and who share no community with you) land here. They won’t know you saw it until you reply.
            </Txt>
          ) : null}

          {overview.isPending ? (
            <SkeletonList count={4} />
          ) : overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
          ) : shown.length === 0 ? (
            <EmptyHint
              emoji={filter === "requests" ? "📭" : filter === "live" ? "🎙️" : "💬"}
              title={filter === "requests" ? "No requests" : filter === "live" ? "No live rooms of yours yet" : filter === "groups" ? "No group chats yet" : "No chats yet"}
              text={filter === "groups" ? "Join a community to chat in its rooms." : "Say hi to someone new, or join a community to chat in its rooms."}
              actionLabel={filter === "live" ? "Start a Room" : "New Message"}
              onAction={() => setSheet(filter === "live" ? "room" : "new")}
              style={{ marginTop: 4 }}
            />
          ) : (
            shown.map((r, i) => {
              const preview = roomPreview(r);
              const title = roomTitle(r);
              return (
                <View key={r.id}>
                  <MessageRow
                    person={roomPerson(r)}
                    title={title}
                    verified={r.kind === "dm" && r.peerVerified}
                    online={r.kind === "dm" ? r.peerOnline : isLiveKind(r.kind) ? undefined : false}
                    preview={preview.text}
                    previewAuthor={preview.author}
                    previewIcon={preview.icon}
                    time={shortTimeAgo(r.lastAt)}
                    unread={r.unread}
                    muted={r.muted}
                    pinned={r.pinned}
                    onPress={() => router.push(`/chat/${r.id}`)}
                    onLongPress={() => setMenuFor(r)}
                    divider={i < shown.length - 1 && !r.isRequest}
                  />
                  {r.isRequest ? (
                    <View style={{ flexDirection: "row", gap: 8, paddingLeft: 50, paddingTop: 4, paddingBottom: 10, borderBottomWidth: i < shown.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
                      <GradientButton label="Accept" icon="checkmark" size="sm" busy={busyId === r.id} onPress={() => void answerRequest(r, true)} accessibilityLabel={`Accept message request from ${title}`} />
                      <PressableScale onPress={() => void answerRequest(r, false)} disabled={busyId === r.id} accessibilityLabel={`Decline message request from ${title}`} hitSlop={8} scaleTo={0.95} style={{ height: 28, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.border, justifyContent: "center", backgroundColor: theme.surface }}>
                        <Txt style={{ fontFamily: font.bold, fontSize: 12.5, lineHeight: 16, color: theme.muted }}>Decline</Txt>
                      </PressableScale>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <StartRoomSheet visible={sheet === "room"} onClose={() => setSheet(null)} />
      <NewMessageSheet visible={sheet === "new"} onClose={() => setSheet(null)} />

      <Sheet visible={!!menuFor} title={menuFor ? roomTitle(menuFor) : "Chat"} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <>
            <OptionRow icon={menuFor.pinned ? "pin-outline" : "pin"} title={menuFor.pinned ? "Unpin" : "Pin to the top"} onPress={() => void setPref(menuFor, { pinned: !menuFor.pinned })} right={null} />
            <OptionRow icon={menuFor.muted ? "notifications-outline" : "notifications-off-outline"} title={menuFor.muted ? "Unmute" : "Mute notifications"} onPress={() => void setPref(menuFor, { muted: !menuFor.muted })} right={null} />
            <OptionRow icon="chatbubble-ellipses-outline" title="Open chat" onPress={() => { const id = menuFor.id; setMenuFor(null); router.push(`/chat/${id}`); }} right={null} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

/**
 * The filter pills, a little more compact than the kit's `FilterPills` so the four of the mockup fit across a phone
 * (with "Requests (n)" the row simply scrolls sideways).
 */
function ChatFilters({ items, value, onChange }: { items: FilterItem[]; value: string; onChange: (key: string) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 }}>
      {items.map((item) => {
        const on = item.key === value;
        const label = item.count ? `${item.label} (${item.count})` : item.label;
        return (
          <PressableScale
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            hitSlop={6}
            scaleTo={0.95}
            style={[
              { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 9, borderRadius: radius.pill, overflow: "hidden", backgroundColor: on ? "transparent" : theme.surface, borderWidth: 1, borderColor: on ? "transparent" : theme.border },
              on ? shadow.glow(theme.gradPrimary[0], 0.3) : null,
            ]}
          >
            {on ? <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} /> : null}
            {item.icon ? <Ionicons name={item.icon} size={15} color={on ? "#fff" : item.key === "requests" ? theme.pink : theme.toneText.violet} /> : null}
            <Txt numberOfLines={1} style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 11.5, lineHeight: 15, letterSpacing: -0.1, color: on ? "#fff" : theme.ink }}>{label}</Txt>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/** One "Live Rooms Now" card from the server's live room data. */
function LiveCard({ room, index, width, onJoin }: { room: LiveRoom; index: number; width: number; onJoin: () => void }) {
  const faces = room.faces.map(personFromChip);
  return (
    <LiveRoomCard
      title={room.title}
      subtitle={room.subtitle}
      topic={room.topic}
      cover={room.cover || null}
      hue={(index * 67 + 260) % 360}
      liveCount={room.liveCount}
      faces={faces}
      extra={Math.max(0, room.liveCount - faces.length) || undefined}
      index={index}
      color={room.color || undefined}
      icon={topicIcon(room.topic)}
      onJoin={onJoin}
      width={width}
    />
  );
}

/** Search people and open (or start) a direct message. */
function NewMessageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [q, setQ] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const query = useDebounced(q.trim(), 300);
  const people = useQuery({ queryKey: ["searchPeople", query], queryFn: () => api.searchEverything({ q: query, kind: "people" }), enabled: visible && query.length >= 2 });

  const open = async (userId: string) => {
    setOpening(userId);
    setProblem(null);
    try {
      const { roomId } = await api.openDm(userId);
      setQ("");
      onClose();
      router.push(`/chat/${roomId}`);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setOpening(null);
    }
  };

  return (
    <Sheet visible={visible} title="New Message" onClose={onClose}>
      <Field value={q} onChangeText={setQ} placeholder="Search people by name or @handle" autoCapitalize="none" autoCorrect={false} autoFocus />
      {problem ? <Txt variant="small" tone="danger">{problem}</Txt> : null}
      {query.length < 2 ? (
        <Txt variant="small" tone="muted">Type at least two letters to find someone.</Txt>
      ) : people.isPending ? (
        <SkeletonList count={2} />
      ) : people.data?.people.length ? (
        people.data.people.map((p) => (
          <PressableScale key={p.userId} onPress={() => void open(p.userId)} disabled={!!opening} accessibilityLabel={`Message ${p.displayName}`} scaleTo={0.98} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, opacity: opening && opening !== p.userId ? 0.5 : 1 }}>
            <PersonAvatar person={{ name: p.displayName, hue: p.avatarHue, userId: p.userId, avatarV: p.avatarV }} size={42} online={p.online} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Txt numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 14.5, lineHeight: 19, color: theme.ink, flexShrink: 1 }}>{p.displayName}</Txt>
                {p.verified ? <VerifiedTick size={13} /> : null}
              </View>
              <Txt numberOfLines={1} style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: theme.muted }}>@{p.handle}{p.headline ? ` · ${p.headline}` : ""}</Txt>
            </View>
            <Ionicons name={opening === p.userId ? "hourglass-outline" : "paper-plane-outline"} size={19} color={theme.accent} />
          </PressableScale>
        ))
      ) : (
        <Txt variant="small" tone="muted">No one found. Check the spelling, or try their @handle.</Txt>
      )}
    </Sheet>
  );
}
