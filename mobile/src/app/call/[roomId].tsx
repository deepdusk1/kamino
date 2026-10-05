import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { api } from "@/api/endpoints";
import { GradientButton, Pill, PersonAvatar } from "@/components/k";
import { Button, Card, Screen, Txt } from "@/components/ui";
import { useAction } from "@/lib/errors";
import { loadWebRTC } from "@/lib/calls/webrtc";
import { useCall } from "@/lib/calls/useCall";
import { font, radius, shadow, space, useTheme } from "@/theme";

/** Words for the state of one connection. */
const STATE_LABEL: Record<string, string> = {
  new: "Connecting…",
  connecting: "Connecting…",
  connected: "In the call",
  disconnected: "Reconnecting…",
  failed: "Could not connect",
  closed: "Left",
};

/** The live call of one chat room: audio for everyone, video if people turn it on. */
export default function CallScreen() {
  const theme = useTheme();
  const { roomId: roomParam } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(roomParam);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.room(roomId), enabled: Number.isFinite(roomId) });
  const call = useCall(roomId, me.data?.profile.userId, me.data?.profile.displayName ?? "Me");
  const [ring, ringing] = useAction(async () => {
    await api.ringCall(roomId);
  });
  const RTCView = loadWebRTC()?.RTCView;

  const leave = () => {
    call.hangUp();
    router.back();
  };

  if (call.status === "unavailable") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Call" }} />
        <Card>
          <Txt variant="heading">Calls aren’t in this build</Txt>
          <Txt tone="muted">
            Live calls need the full Kamino app from the App Store or Google Play (or a development build). They can’t run inside Expo Go or the web preview.
          </Txt>
          <Button label="Back to the chat" variant="secondary" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  const title = room.data?.room.name ? `Call · ${room.data.room.name}` : "Call";
  const ended = call.status === "ended";
  const withVideo = call.peers.filter((p) => (call.remoteStreams[p.id]?.getVideoTracks().length ?? 0) > 0);

  return (
    <Screen>
      <Stack.Screen options={{ title, gestureEnabled: false, headerBackVisible: false }} />

      {call.message ? (
        <Card>
          <Txt tone={ended ? "danger" : "muted"}>{call.message}</Txt>
        </Card>
      ) : null}

      {call.status === "joining" ? <Txt tone="muted">Joining the call…</Txt> : null}
      {call.status === "active" && call.peers.length === 0 ? <Txt tone="muted">You’re in the call. Waiting for others to join. You can ring them below.</Txt> : null}

      {RTCView && withVideo.length > 0 ? (
        <View style={{ gap: space.sm }}>
          {withVideo.map((p) => (
            <View key={p.id} style={{ height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" }} accessibilityLabel={`Video from ${p.name || "a participant"}`}>
              <RTCView streamURL={call.remoteStreams[p.id]!.toURL()} style={{ flex: 1 }} objectFit="cover" />
              <View style={{ position: "absolute", left: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Txt variant="caption" style={{ color: "#fff" }}>{p.name || "Member"}</Txt>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {RTCView && call.cameraOn && call.localStream ? (
        <View style={{ height: 140, width: 105, alignSelf: "flex-end", borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" }} accessibilityLabel="Your camera">
          <RTCView streamURL={call.localStream.toURL()} style={{ flex: 1 }} objectFit="cover" mirror />
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Txt style={{ fontFamily: font.heavy, fontSize: 17, lineHeight: 22, color: theme.ink }}>In this call</Txt>
        <Card>
          <Person name={me.data?.profile.displayName ?? "You"} hue={me.data?.profile.avatarHue ?? 260} detail={call.muted ? "You (muted)" : "You"} />
        </Card>
        {call.peers.map((p) => {
          const known = room.data?.participants.find((x) => x.name === p.name);
          return (
            <Card key={p.id}>
              <Person name={p.name || "Member"} hue={hueFor(p.id)} userId={known?.userId} detail={STATE_LABEL[p.state] ?? p.state} good={p.state === "connected"} />
            </Card>
          );
        })}
      </View>

      {!ended ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: space.lg, paddingVertical: space.md }}>
          <ControlButton icon={call.muted ? "mic-off" : "mic"} label={call.muted ? "Unmute microphone" : "Mute microphone"} active={call.muted} onPress={call.toggleMute} />
          <ControlButton icon={call.cameraOn ? "videocam" : "videocam-off"} label={call.cameraOn ? "Turn camera off" : "Turn camera on"} active={call.cameraOn} onPress={() => void call.toggleCamera()} />
          <ControlButton icon="call" label="Leave the call" danger onPress={leave} />
        </View>
      ) : (
        <GradientButton label="Back to the chat" icon="chatbubble-ellipses" size="lg" full onPress={() => router.back()} />
      )}
      {!ended ? <GradientButton label="Ring everyone in this room" icon="notifications" full busy={ringing} onPress={() => void ring()} /> : null}
      {!ended ? <Pill label="Tip: use headphones to avoid echo" emoji="🎧" size="md" tone="blue" /> : null}
      <Txt variant="caption" tone="subtle" style={{ color: theme.subtle }}>
        Calls go directly between phones and browsers. On strict networks a relay server may be needed; the person running Kamino sets that up.
      </Txt>
    </Screen>
  );
}

/** A stable colour for someone without a known profile. */
function hueFor(id: string): number {
  let sum = 0;
  for (const char of id) sum = (sum * 31 + char.charCodeAt(0)) % 360;
  return sum;
}

function Person({ name, hue, userId, detail, good }: { name: string; hue: number; userId?: string; detail: string; good?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <PersonAvatar person={{ name, hue, userId }} size={44} online={good} />
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 20, color: theme.ink }}>{name}</Txt>
        <Txt variant="caption" style={{ color: good ? theme.ok : theme.muted }}>{detail}</Txt>
      </View>
    </View>
  );
}

function ControlButton({ icon, label, onPress, active, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: danger ? theme.red : active ? theme.violet : theme.surface, borderWidth: danger || active ? 0 : 1, borderColor: theme.border }, shadow.glow(danger ? theme.red : theme.violet, danger || active ? 0.35 : 0.12)]}
    >
      <Ionicons name={icon} size={28} color={danger || active ? "#fff" : theme.ink} style={danger ? { transform: [{ rotate: "135deg" }] } : undefined} />
    </Pressable>
  );
}
