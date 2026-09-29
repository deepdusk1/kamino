import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, usePathname } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/endpoints";
import { callsAvailable } from "@/lib/calls/webrtc";
import { useAction } from "@/lib/errors";
import { radius, space, useTheme } from "@/theme";
import { Button, Txt } from "./ui";

/** The room number in a call link such as "/chats/7?call=1", or null. */
export function callRoomFrom(href: string): number | null {
  const match = /^\/chats\/(\d+)\?call=1$/.exec(href);
  return match ? Number(match[1]) : null;
}

/**
 * Someone is calling a room you are in. The banner appears at the top of any screen for as long as the call rings
 * (45 seconds). It checks every few seconds while the app is open; when the app is closed, the push notification does the
 * same job and opens the call screen when tapped.
 */
export function IncomingCallBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const enabled = callsAvailable();
  const calls = useQuery({ queryKey: ["incomingCalls"], queryFn: api.incomingCalls, enabled, refetchInterval: 5000, staleTime: 0 });
  const [dismiss] = useAction(async (id: number) => {
    await api.dismissNotification(id);
    await queryClient.invalidateQueries({ queryKey: ["incomingCalls"] });
  });

  const call = calls.data?.find((c) => callRoomFrom(c.href) !== null);
  const roomId = call ? callRoomFrom(call.href) : null;
  // Already in a call screen: nothing to ring about.
  if (!enabled || !call || roomId === null || pathname.startsWith("/call/")) return null;

  return (
    <View
      accessibilityLiveRegion="assertive"
      style={{
        position: "absolute", left: space.md, right: space.md, top: insets.top + space.sm, zIndex: 50,
        backgroundColor: theme.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border,
        padding: space.md, gap: space.sm, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="call" size={22} color={theme.ok} />
        <View style={{ flex: 1 }}>
          <Txt>{call.name}</Txt>
          <Txt variant="caption" tone="muted">Incoming call</Txt>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button
          label="Join"
          small
          style={{ flex: 1 }}
          onPress={() => {
            void dismiss(call.id);
            router.push(`/call/${roomId}`);
          }}
        />
        <Button label="Not now" small variant="secondary" style={{ flex: 1 }} onPress={() => void dismiss(call.id)} />
      </View>
    </View>
  );
}
