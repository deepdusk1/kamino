import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { FlatList, View } from "react-native";
import { api } from "@/api/endpoints";
import type { ChatRoom } from "@/api/types";
import { Avatar, Card, EmptyState, ErrorState, IconBubble, SkeletonList, Txt, useTabBarSpace } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { font, radius, space, useTheme, type Gradient } from "@/theme";
import { previewText } from "@/lib/stickers";

const roomTitle = (r: ChatRoom) => (r.kind === "dm" ? (r.peerName ?? "Direct message") : r.name);

export default function Chats() {
  const theme = useTheme();
  const tabSpace = useTabBarSpace();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: api.rooms, refetchInterval: 30_000 });
  // Pinned first, then most recent activity.
  const sorted = [...(rooms.data ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  return (
    <FlatList
      data={sorted}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: space.lg, paddingBottom: tabSpace + space.lg, gap: space.sm, flexGrow: 1 }}
      refreshing={rooms.isRefetching}
      onRefresh={() => void rooms.refetch()}
      renderItem={({ item, index }) => {
        const bubble: Gradient = item.kind === "voice" ? theme.gradWarm : item.kind === "screening" ? theme.gradCool : theme.gradPrimary;
        return (
          <Card
            index={index}
            onPress={() => router.push(`/chat/${item.id}`)}
            accessibilityLabel={`${roomTitle(item)}${item.unread ? `, ${item.unread} unread` : ""}`}
            style={{ padding: space.md, flexDirection: "row", alignItems: "center", gap: space.md }}
          >
            {item.kind === "dm" ? (
              <Avatar name={roomTitle(item)} hue={item.peerHue} size={48} userId={item.peerUserId ?? undefined} version={item.peerAvatarV} />
            ) : (
              <IconBubble size={48} colors={bubble} icon={item.kind === "voice" ? "mic" : item.kind === "screening" ? "film" : item.kind === "private" ? "lock-closed" : "chatbubbles"} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt variant="body" numberOfLines={1} style={{ flexShrink: 1, fontFamily: item.unread ? font.heavy : font.bold }}>{roomTitle(item)}</Txt>
                {item.pinned ? <Ionicons name="pin" size={12} color={theme.subtle} /> : null}
                {item.muted ? <Ionicons name="volume-mute" size={12} color={theme.subtle} /> : null}
              </View>
              <Txt variant="small" tone={item.unread ? "default" : "muted"} numberOfLines={1}>{previewText(item.lastMessage ?? "") || "No messages yet"}</Txt>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Txt variant="caption" tone={item.unread ? "accent" : "subtle"}>{timeAgo(item.lastAt)}</Txt>
              {item.unread > 0 ? (
                <View style={{ minWidth: 22, height: 22, borderRadius: radius.pill, overflow: "hidden", alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: theme.subtle }}>
                  {item.muted ? null : <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />}
                  <Txt variant="caption" tone="onAccent" style={{ fontSize: 11 }}>{item.unread > 99 ? "99+" : item.unread}</Txt>
                </View>
              ) : null}
            </View>
          </Card>
        );
      }}
      ListEmptyComponent={
        rooms.isPending ? <SkeletonList count={4} /> : rooms.isError ? <ErrorState error={rooms.error} onRetry={() => void rooms.refetch()} /> : (
          <EmptyState icon="chatbubbles-outline" title="No chats yet" body="Join a community to chat in its rooms, or message someone from their profile." action={{ label: "Explore communities", onPress: () => router.push("/explore") }} />
        )
      }
    />
  );
}
