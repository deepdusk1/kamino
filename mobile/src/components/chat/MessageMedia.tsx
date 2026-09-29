import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pressable, View } from "react-native";
import { authHeaders, messageMediaUrl } from "@/api/client";
import { Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

type Props = { roomId: number; messageId: number; kind: "image" | "audio" | "video" };

/**
 * A photo, voice note or clip inside a chat bubble. Attachments are protected, so every request
 * carries the signed-in person's token.
 */
export function MessageMedia({ roomId, messageId, kind }: Props) {
  const source = { uri: messageMediaUrl(roomId, messageId), headers: authHeaders() };
  if (kind === "image") {
    return <Image source={source} style={{ width: 220, height: 220, borderRadius: radius.md }} contentFit="cover" accessibilityLabel="Photo" transition={120} />;
  }
  if (kind === "video") return <ClipPlayer source={source} />;
  return <VoiceNote source={source} />;
}

type Source = { uri: string; headers: Record<string, string> };

function VoiceNote({ source }: { source: Source }) {
  const theme = useTheme();
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) return player.pause();
    // Start again from the beginning once a note has finished.
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.1)) void player.seekTo(0);
    player.play();
  };
  const shown = status.playing || status.currentTime > 0 ? status.currentTime : status.duration;

  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={status.playing ? "Pause voice message" : "Play voice message"} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minWidth: 150 }}>
      <Ionicons name={status.playing ? "pause-circle" : "play-circle"} size={36} color={theme.accent} />
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.border }}>
        <View style={{ width: `${status.duration ? Math.min(100, (status.currentTime / status.duration) * 100) : 0}%`, height: 4, borderRadius: 2, backgroundColor: theme.accent }} />
      </View>
      <Txt variant="caption" tone="muted">{formatSeconds(shown)}</Txt>
    </Pressable>
  );
}

function ClipPlayer({ source }: { source: Source }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={{ width: 240, height: 180, borderRadius: radius.md, backgroundColor: "#000" }} nativeControls contentFit="contain" accessibilityLabel="Video" />;
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
