import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { api } from "@/api/endpoints";
import { CommunityCard } from "@/components/CommunityCard";
import { Avatar, Card, ErrorState, IconBubble, Loading, Screen, Txt } from "@/components/ui";
import { compactCount } from "@/lib/format";
import { space, useTheme, type Theme } from "@/theme";

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; href: string; colors: (t: Theme) => Theme["gradPrimary"] };

const ROWS: Row[] = [
  { icon: "create", label: "Edit profile", href: "/edit-profile", colors: (t) => t.gradPrimary },
  { icon: "bookmark", label: "Saved posts", href: "/saved", colors: (t) => t.gradCool },
  { icon: "notifications", label: "Notifications", href: "/notifications", colors: (t) => t.gradWarm },
  { icon: "settings", label: "Settings, privacy & account", href: "/settings", colors: () => ["#64748b", "#475569"] },
];

export default function Me() {
  const theme = useTheme();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const profile = me.data?.profile;

  return (
    <Screen inTabs refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      {me.isPending ? <Loading /> : me.isError || !profile ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : (
        <>
          <Card index={0} onPress={() => router.push(`/profile/${profile.handle}`)} accessibilityLabel="View my public profile">
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
                <Avatar name={profile.displayName} hue={profile.avatarHue} size={64} userId={profile.userId} version={profile.avatarVersion} ring frame={profile.frame} />
                <View style={{ flex: 1 }}>
                  <Txt variant="title">{profile.displayName}</Txt>
                  <Txt tone="muted">@{profile.handle}</Txt>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.subtle} />
              </View>
              {profile.bio ? <Txt tone="muted">{profile.bio}</Txt> : null}
              <View style={{ flexDirection: "row", gap: space.sm, paddingTop: space.xs }}>
                <Stat value={compactCount(profile.rep)} label="Reputation" icon="sparkles" />
                <Stat value={String(profile.streak)} label="Day streak" icon="flame" />
                <Stat value={String(me.data?.joined.length ?? 0)} label="Communities" icon="planet" />
              </View>
          </Card>

          <View style={{ gap: space.sm }}>
            {ROWS.map((row, i) => (
              <Card key={row.href} index={i + 1} onPress={() => router.push(row.href)} accessibilityLabel={row.label} style={{ paddingVertical: space.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <IconBubble icon={row.icon} colors={row.colors(theme)} />
                  <Txt style={{ flex: 1 }}>{row.label}</Txt>
                  <Ionicons name="chevron-forward" size={18} color={theme.subtle} />
                </View>
              </Card>
            ))}
          </View>

          {me.data?.joined.length ? (
            <View style={{ gap: space.sm }}>
              <Txt variant="label" tone="subtle">My communities</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingVertical: space.sm, paddingHorizontal: 2 }} style={{ marginHorizontal: -2 }}>
                {me.data.joined.map((j) => (
                  <View key={j.community.id} style={{ gap: 4 }}>
                    <CommunityCard community={j.community} compact />
                    <Txt variant="caption" tone="muted" numberOfLines={1} style={{ width: 176, paddingHorizontal: 4 }}>
                      as {j.nickname}{j.role !== "member" ? ` · ${j.role}` : ""}
                    </Txt>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.tint, borderRadius: 14, paddingVertical: space.sm, paddingHorizontal: space.md, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={14} color={theme.accent} />
        <Txt variant="heading">{value}</Txt>
      </View>
      <Txt variant="caption" tone="muted" numberOfLines={1}>{label}</Txt>
    </View>
  );
}
