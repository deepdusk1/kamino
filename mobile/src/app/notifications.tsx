import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { FlatList, View } from "react-native";
import { api } from "@/api/endpoints";
import { Card, EmptyState, ErrorState, IconBubble, Loading, Txt } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { appHrefFromServerHref } from "@/lib/hrefs";
import { space, useTheme } from "@/theme";

export default function Notifications() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["notifications"], queryFn: api.notifications });

  // Opening the screen marks everything as read (the unread dots stay until the next refresh).
  useEffect(() => {
    if (!list.data?.some((n) => !n.read)) return;
    api.markNotificationsRead().then(() => queryClient.invalidateQueries({ queryKey: ["bootstrap"] })).catch(() => undefined);
  }, [list.data, queryClient]);

  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <FlatList
      data={list.data}
      keyExtractor={(n) => String(n.id)}
      contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      renderItem={({ item, index }) => (
        <Card
          index={index}
          onPress={() => item.href && router.push(appHrefFromServerHref(item.href) as never)}
          accessibilityLabel={`${item.title}. ${item.body}`}
          style={[{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }, !item.read && { backgroundColor: theme.tint, borderColor: theme.accent }]}
        >
          <IconBubble
            size={40}
            colors={item.kind === "like" ? theme.gradWarm : item.kind === "follow" ? theme.gradCool : theme.gradPrimary}
            icon={item.kind === "like" ? "heart" : item.kind === "comment" ? "chatbubble" : item.kind === "follow" ? "person-add" : "notifications"}
          />
          <View style={{ flex: 1 }}>
            <Txt>{item.title}</Txt>
            {item.body ? <Txt variant="small" tone="muted" numberOfLines={2}>{item.body}</Txt> : null}
          </View>
          <Txt variant="caption" tone="subtle">{timeAgo(item.createdAt)}</Txt>
        </Card>
      )}
      ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="All quiet" body="Kamino never sends nudges. You only hear about real activity on your things." />}
    />
  );
}
