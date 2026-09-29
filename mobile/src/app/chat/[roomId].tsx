import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/endpoints";
import type { ChatMessage } from "@/api/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RoomSettings } from "@/components/chat/RoomSettings";
import { StickerPicker } from "@/components/chat/StickerPicker";
import { formatSeconds } from "@/components/chat/MessageMedia";
import { ReportSheet, type ReportTarget } from "@/components/ReportSheet";
import { Button, EmptyState, ErrorState, Glass, Loading, PressableScale, Sheet, Txt } from "@/components/ui";
import { showError } from "@/lib/errors";
import { pickPhoto, pickVideo } from "@/lib/media";
import { stickerToken } from "@/lib/stickers";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";
import { font, glowShadow, radius, space, useTheme } from "@/theme";

const REACTIONS = ["❤️", "😂", "✨", "🔥", "👏", "😮"];
type Media = { kind: "image" | "audio" | "video"; dataUrl: string };

export default function ChatRoom() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { roomId: roomParam } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(roomParam);
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  // New messages arrive by asking the server again every few seconds while this screen is open.
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.room(roomId), enabled: Number.isFinite(roomId), refetchInterval: 4000 });

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const voice = useVoiceRecorder();

  const messages = room.data?.messages;
  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);
  const newestFirst = useMemo(() => [...(messages ?? [])].reverse(), [messages]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  const submit = async (media?: Media) => {
    const body = text.trim();
    if (sending || (!body && !media)) return;
    setSending(true);
    try {
      if (editing) await api.editMessage(roomId, editing.id, body);
      else await api.send({ roomId, body, replyTo: replyTo?.id ?? null, media });
      setText("");
      setReplyTo(null);
      setEditing(null);
      await refresh();
    } catch (error) {
      showError(error, "Message not sent");
    } finally {
      setSending(false);
    }
  };

  const sendSticker = async (id: string) => {
    setStickersOpen(false);
    if (sending) return;
    setSending(true);
    try {
      await api.send({ roomId, body: stickerToken(id), replyTo: replyTo?.id ?? null });
      setReplyTo(null);
      await refresh();
    } catch (error) {
      showError(error, "Sticker not sent");
    } finally {
      setSending(false);
    }
  };

  const attach = async (kind: "photo" | "camera" | "video") => {
    setAttachOpen(false);
    try {
      if (kind === "video") {
        const dataUrl = await pickVideo("library");
        if (dataUrl) await submit({ kind: "video", dataUrl });
      } else {
        const dataUrl = await pickPhoto(kind === "camera" ? "camera" : "library");
        if (dataUrl) await submit({ kind: "image", dataUrl });
      }
    } catch (error) {
      showError(error, "Couldn't attach that");
    }
  };

  const toggleRecording = async () => {
    try {
      if (voice.isRecording) {
        const dataUrl = await voice.stop();
        if (dataUrl) await submit({ kind: "audio", dataUrl });
      } else {
        await voice.start((dataUrl) => {
          if (dataUrl) void submit({ kind: "audio", dataUrl });
        });
      }
    } catch (error) {
      await voice.cancel();
      showError(error, "Voice message failed");
    }
  };

  const react = async (message: ChatMessage, emoji: string) => {
    setSelected(null);
    try {
      await api.react(roomId, message.id, emoji);
      await refresh();
    } catch (error) {
      showError(error);
    }
  };

  const remove = (message: ChatMessage) => {
    setSelected(null);
    Alert.alert("Delete this message?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          api.deleteMessage(roomId, message.id).then(refresh, showError);
        },
      },
    ]);
  };

  if (room.isPending) return <Loading />;
  if (room.isError || !room.data) return <ErrorState error={room.error} onRetry={() => void room.refetch()} />;

  const info = room.data.room;
  const title = info.kind === "dm" ? (info.peerName ?? "Direct message") : info.name;
  const myId = me.data?.profile.userId;
  const mineSelected = !!selected && selected.author.userId === myId;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
              <Pressable onPress={() => router.push(`/call/${roomId}`)} accessibilityRole="button" accessibilityLabel="Start or join a call" hitSlop={10}>
                <Ionicons name="call-outline" size={24} color={theme.fg} />
              </Pressable>
              <Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Room settings" hitSlop={10}>
                <Ionicons name="ellipsis-horizontal-circle-outline" size={26} color={theme.fg} />
              </Pressable>
            </View>
          ),
        }}
      />

      {room.data?.voices.length ? (
        <Pressable onPress={() => router.push(`/call/${roomId}`)} accessibilityRole="button" accessibilityLabel="Join the call" style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, backgroundColor: theme.tint }}>
          <Ionicons name="call" size={20} color={theme.accent} />
          <Txt variant="small" tone="accent" numberOfLines={1} style={{ flex: 1 }}>
            {room.data.voices.length} in a call · {room.data.voices.map((v) => v.nickname).join(", ")}
          </Txt>
          <Txt variant="small" tone="accent">Join</Txt>
        </Pressable>
      ) : null}

      {info.kind === "screening" && info.watchUrl ? (
        <Pressable onPress={() => void Linking.openURL(info.watchUrl)} accessibilityRole="link" accessibilityLabel={`Open ${info.watchTitle || "watch link"}`} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, backgroundColor: theme.tint }}>
          <Ionicons name="film-outline" size={20} color={theme.accent} />
          <Txt variant="small" tone="accent" numberOfLines={1} style={{ flex: 1 }}>Watching: {info.watchTitle || info.watchUrl}</Txt>
          <Ionicons name="open-outline" size={18} color={theme.accent} />
        </Pressable>
      ) : null}

      <FlatList
        inverted
        data={newestFirst}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={item.author.userId === myId}
            replyTo={item.replyTo ? byId.get(item.replyTo) : undefined}
            onLongPress={() => setSelected(item)}
            onOpenProfile={() => router.push(`/profile/${item.author.handle}`)}
            onReact={(emoji) => void react(item, emoji)}
          />
        )}
        contentContainerStyle={{ paddingVertical: space.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState icon="chatbubble-ellipses-outline" title="Say hello" body="No messages yet. Yours can be the first." />}
        keyboardShouldPersistTaps="handled"
      />

      {replyTo || editing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: theme.elevated }}>
          <Txt variant="small" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {editing ? "Editing your message" : `Replying to ${replyTo!.author.nickname}: ${replyTo!.body || "attachment"}`}
          </Txt>
          <Pressable onPress={() => { setReplyTo(null); setEditing(null); setText(""); }} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10}>
            <Ionicons name="close-circle" size={22} color={theme.subtle} />
          </Pressable>
        </View>
      ) : null}

      <Glass intensity={70} style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, padding: space.sm, paddingBottom: Math.max(insets.bottom, space.sm), borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
        {voice.isRecording ? (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, height: 44, paddingHorizontal: space.md }}>
            <Ionicons name="radio-button-on" size={18} color={theme.danger} />
            <Txt tone="danger">Recording {formatSeconds(voice.seconds)}</Txt>
            <Txt variant="caption" tone="muted">tap send to finish</Txt>
          </View>
        ) : (
          <>
            {editing ? null : (
              <Pressable onPress={() => setStickersOpen(true)} accessibilityRole="button" accessibilityLabel="Send a sticker" style={{ height: 44, width: 36, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="happy-outline" size={26} color={theme.accent} />
              </Pressable>
            )}
            {editing ? null : (
              <Pressable onPress={() => setAttachOpen(true)} accessibilityRole="button" accessibilityLabel="Attach a photo or video" style={{ height: 44, width: 40, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="add-circle-outline" size={28} color={theme.accent} />
              </Pressable>
            )}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message"
              accessibilityLabel="Message"
              placeholderTextColor={theme.subtle}
              multiline
              maxLength={2000}
              selectionColor={theme.accent}
              style={{ flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: theme.hairline, color: theme.fg, fontFamily: font.regular, fontSize: 16, outlineWidth: 0 }}
            />
          </>
        )}
        {text.trim() || editing ? (
          <RoundButton icon="arrow-up" label={editing ? "Save edit" : "Send message"} onPress={() => void submit()} busy={sending} />
        ) : (
          <RoundButton icon={voice.isRecording ? "stop" : "mic"} label={voice.isRecording ? "Finish and send voice message" : "Record a voice message"} onPress={() => void toggleRecording()} busy={sending || voice.busy} />
        )}
      </Glass>

      <Sheet visible={!!selected} title="Message" onClose={() => setSelected(null)}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {REACTIONS.map((emoji) => (
            <Pressable key={emoji} onPress={() => selected && void react(selected, emoji)} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} style={{ padding: space.sm }}>
              <Txt style={{ fontSize: 28, lineHeight: 34 }}>{emoji}</Txt>
            </Pressable>
          ))}
        </View>
        {selected && !selected.deleted ? (
          <>
            <Button label="Reply" variant="secondary" onPress={() => { setReplyTo(selected); setEditing(null); setSelected(null); }} />
            {mineSelected && !selected.mediaKind ? (
              <Button label="Edit" variant="secondary" onPress={() => { setEditing(selected); setReplyTo(null); setText(selected.body); setSelected(null); }} />
            ) : null}
            <Button label="Delete" variant="danger" onPress={() => remove(selected)} />
            {mineSelected ? null : (
              <Button
                label="Report"
                variant="ghost"
                onPress={() => {
                  setReport({ targetType: "message", targetId: String(selected.id), communityId: info.communityId ?? undefined, label: "message" });
                  setSelected(null);
                }}
              />
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={attachOpen} title="Attach" onClose={() => setAttachOpen(false)}>
        <Button label="Photo from library" variant="secondary" onPress={() => void attach("photo")} />
        <Button label="Take a photo" variant="secondary" onPress={() => void attach("camera")} />
        <Button label="Short video (up to 30 s)" variant="secondary" onPress={() => void attach("video")} />
      </Sheet>

      <StickerPicker visible={stickersOpen} onClose={() => setStickersOpen(false)} onPick={(id) => void sendSticker(id)} />

      <RoomSettings visible={settingsOpen} onClose={() => setSettingsOpen(false)} page={room.data} myId={myId} onChanged={() => void refresh()} />
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </KeyboardAvoidingView>
  );
}

/** The round gradient send / record button. It pops in when it changes from mic to send. */
function RoundButton({ icon, label, onPress, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={busy} accessibilityLabel={label} scaleTo={0.85} style={[{ height: 44, width: 44, borderRadius: 22, opacity: busy ? 0.5 : 1 }, glowShadow(theme.glow)]}>
      <Animated.View key={icon} entering={ZoomIn.springify().damping(14)} style={{ flex: 1 }}>
        <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={22} color="#ffffff" />
        </LinearGradient>
      </Animated.View>
    </PressableScale>
  );
}
