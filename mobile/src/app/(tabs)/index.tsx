import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/endpoints";
import { CommunityCard } from "@/components/CommunityCard";
import { PostCard } from "@/components/PostCard";
import { Appear, Avatar, EmptyState, ErrorState, Glass, PressableScale, SkeletonList, Txt, useTabBarSpace } from "@/components/ui";
import { showError } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { useFirstRunWelcome } from "@/lib/useWelcome";
import { font, glowShadow, radius, space, useTheme } from "@/theme";

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  useFirstRunWelcome();
  const feed = useQuery({ queryKey: ["home"], queryFn: api.homeFeed });
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });

  const checkIn = useMutation({
    mutationFn: api.checkIn,
    onSuccess: () => {
      haptic.success();
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (error) => showError(error),
  });

  const profile = boot.data?.profile;
  const unread = boot.data?.unread ?? 0;
  const checkedToday = checkIn.data?.already === true || (!!profile?.lastCheckinAt && new Date(profile.lastCheckinAt).toDateString() === new Date().toDateString());

  const posts = [...(feed.data?.featured ?? []), ...(feed.data?.latest ?? [])];
  const seen = new Set<number>();
  const unique = posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <Appear style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {profile ? (
          <PressableScale onPress={() => router.push(`/profile/${profile.handle}`)} accessibilityLabel="My profile" scaleTo={0.9}>
            <Avatar name={profile.displayName} hue={profile.avatarHue} size={46} userId={profile.userId} version={profile.avatarVersion} ring frame={profile.frame} />
          </PressableScale>
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt variant="small" tone="muted">{greeting()}</Txt>
          <Txt variant="title" numberOfLines={1}>{profile?.displayName.split(" ")[0] ?? "Welcome"} ✨</Txt>
        </View>
        <Bell unread={unread} />
      </Appear>

      <Appear index={1}>
        <StreakCard streak={profile?.streak ?? 0} checkedToday={checkedToday} busy={checkIn.isPending} onCheckIn={() => checkIn.mutate()} />
      </Appear>

      {feed.data?.joined.length ? (
        <Appear index={2} style={{ gap: space.sm }}>
          <Txt variant="label" tone="subtle">Your communities</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingVertical: space.sm, paddingHorizontal: 2 }} style={{ marginHorizontal: -2 }}>
            {feed.data.joined.map((c) => (
              <CommunityCard key={c.id} community={c} compact />
            ))}
          </ScrollView>
        </Appear>
      ) : null}

      <Txt variant="label" tone="subtle">For you</Txt>
    </View>
  );

  return (
    <FlatList
      data={unique}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, paddingBottom: tabSpace + space.lg, gap: space.md }}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => <PostCard post={item} showCommunity index={index} />}
      refreshing={feed.isRefetching}
      onRefresh={() => {
        void feed.refetch();
        void boot.refetch();
      }}
      ListEmptyComponent={
        feed.isPending ? <SkeletonList /> : feed.isError ? <ErrorState error={feed.error} onRetry={() => void feed.refetch()} /> : (
          <EmptyState icon="planet-outline" title="Your feed is quiet" body="Join a community to see posts here." action={{ label: "Find communities", onPress: () => router.push("/explore") }} />
        )
      }
    />
  );
}

/** Notification bell on glass. When something is unread it gently rings and shows a count. */
function Bell({ unread }: { unread: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const swing = useSharedValue(0);

  useEffect(() => {
    if (!unread || reduceMotion) return;
    // A little "ring ring" when there is news, repeated every few seconds.
    swing.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 90 }), withTiming(-1, { duration: 120 }), withTiming(0.6, { duration: 110 }), withTiming(-0.4, { duration: 100 }), withTiming(0, { duration: 90 }),
        withTiming(0, { duration: 3200 }),
      ),
      -1,
    ));
  }, [unread, reduceMotion, swing]);
  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value * 16}deg` }] }));

  return (
    <PressableScale onPress={() => router.push("/notifications")} accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"} scaleTo={0.88}>
      <Glass style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" }} interactive>
        <Animated.View style={bellStyle}>
          <Ionicons name={unread ? "notifications" : "notifications-outline"} size={22} color={theme.accent} />
        </Animated.View>
      </Glass>
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.bg }]}>
          <Txt style={{ color: "#fff", fontFamily: font.heavy, fontSize: 10, lineHeight: 13 }}>{unread > 99 ? "99+" : unread}</Txt>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** The daily check-in: a warm gradient card with a flickering flame. */
function StreakCard({ streak, checkedToday, busy, onCheckIn }: { streak: number; checkedToday: boolean; busy: boolean; onCheckIn: () => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const flicker = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) flicker.set(withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, flicker]);
  useEffect(() => {
    if (checkedToday && !reduceMotion) pop.set(withSequence(withSpring(1.35, { damping: 6, stiffness: 300 }), withSpring(1, { damping: 10, stiffness: 200 })));
  }, [checkedToday, reduceMotion, pop]);

  const flame = useAnimatedStyle(() => ({ transform: [{ scale: pop.value * (1 + flicker.value * 0.08) }, { rotate: `${-4 + flicker.value * 8}deg` }] }));

  return (
    <View style={[{ borderRadius: radius.lg }, glowShadow(theme.gradWarm[0])]}>
      <LinearGradient colors={theme.gradWarm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.streak}>
        <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]} style={[StyleSheet.absoluteFill, { height: 50 }]} />
        <Animated.View style={[styles.flame, flame]}>
          <Ionicons name="flame" size={30} color="#fff" />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading" style={{ color: "#fff" }}>{streak ? `${streak}-day streak` : "Start a streak"}</Txt>
          <Txt variant="small" style={{ color: "#fff", opacity: 0.92 }}>{checkedToday ? "See you tomorrow!" : "Check in daily to build your reputation."}</Txt>
        </View>
        <PressableScale
          onPress={onCheckIn}
          disabled={checkedToday || busy}
          accessibilityLabel={checkedToday ? "Checked in today" : "Check in"}
          accessibilityState={{ busy }}
          scaleTo={0.92}
          style={[styles.checkIn, { opacity: busy ? 0.7 : 1 }]}
        >
          <Txt variant="small" style={{ color: "#be123c", fontFamily: font.heavy }}>{checkedToday ? "Done ✓" : busy ? "…" : "Check in"}</Txt>
        </PressableScale>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: -2, right: -2, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  streak: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, overflow: "hidden" },
  checkIn: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: radius.pill, paddingHorizontal: space.lg, height: 40, justifyContent: "center" },
  flame: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
});
