import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  Smile,
  Send,
  ImagePlus,
  Mic,
  Square,
  Pin,
  BellOff,
  BellRing,
  History,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Face } from "@/components/face";
import { LiveStage } from "@/components/live-stage";
import { StickerMark } from "@/components/sticker";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bubbleLook } from "@/lib/kamino/cosmetics";
import { STICKER_PACKS, parseSticker, stickerToken } from "@/lib/kamino/stickers";
import {
  getRoom,
  getOlderMessages,
  getMessageMedia,
  searchRoomMessages,
  sendMessage,
  toggleMessageReaction,
  setRoomPreference,
  toggleVoice,
  editMessage,
  deleteMessage,
  setWatchMedia,
  endCall,
  inviteToRoom,
  setRoomInviteRule,
  toggleRoomCohost,
  transferRoomHost,
} from "@/lib/kamino/server";
import type { ChatMessage } from "@/lib/kamino/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chats/$roomId")({
  component: Room,
});

const QUICK_REACTIONS = ["❤️", "😂", "✨", "🔥", "👏", "😮"];

function MessageAttachment({
  roomId,
  messageId,
  kind,
  userId,
}: {
  roomId: number;
  messageId: number;
  kind: "image" | "audio" | "video";
  userId: string;
}) {
  const [load, setLoad] = useState(false);
  const q = useQuery({
    queryKey: ["message-media", roomId, messageId, userId],
    queryFn: () => getMessageMedia({ data: { roomId, messageId } }),
    enabled: load,
    staleTime: Infinity,
  });
  if (!load)
    return (
      <button
        type="button"
        onClick={() => setLoad(true)}
        className="my-1 rounded-xl border border-accent/25 bg-white/60 px-3 py-2 text-left text-xs font-bold text-accent"
      >
        {kind === "image" ? "View photo" : kind === "video" ? "Play video" : "Play voice note"}
      </button>
    );
  if (q.error)
    return (
      <button type="button" onClick={() => void q.refetch()} className="text-xs text-danger">
        Could not load media · retry
      </button>
    );
  if (!q.data) return <p className="text-xs text-muted">Loading media…</p>;
  return kind === "image" ? (
    <img
      src={q.data.dataUrl}
      alt="Chat attachment"
      className="my-1 max-h-80 max-w-full rounded-xl object-contain"
    />
  ) : kind === "video" ? (
    <video
      controls
      playsInline
      preload="metadata"
      src={q.data.dataUrl}
      className="my-1 max-h-80 max-w-full rounded-xl"
      aria-label="Chat video"
    />
  ) : (
    <audio
      controls
      preload="metadata"
      src={q.data.dataUrl}
      className="my-1 w-full max-w-64"
      aria-label="Voice note"
    />
  );
}

function Room() {
  const { roomId } = Route.useParams();
  const id = Number(roomId);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  const href = useRouterState({ select: (s) => s.location.href });
  const { user, isPending } = useCurrentUserState();
  const [autoCall, setAutoCall] = useState(false);
  const [text, setText] = useState("");
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [reactionPicker, setReactionPicker] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [roomToolsOpen, setRoomToolsOpen] = useState(false);
  const [inviteHandle, setInviteHandle] = useState("");
  const [roomAction, setRoomAction] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const cancelRecording = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const sending = useRef(false);
  const [stickersOn, setStickersOn] = useState(false);
  const [stickerPack, setStickerPack] = useState<string>(STICKER_PACKS[0]!.id);
  const [replyTo, setReplyTo] = useState<{ id: number; body: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ["room", id],
    queryFn: () => getRoom({ data: { roomId: id } }),
    enabled: !!user,
    refetchInterval: 2500,
  });
  const searchResults = useQuery({
    queryKey: ["room-search", id, searchTerm],
    queryFn: () => searchRoomMessages({ data: { roomId: id, query: searchTerm } }),
    enabled: searchOpen && searchTerm.length >= 2 && !!user,
  });

  useEffect(() => {
    const fromLink = /[?&]call=(1|true)\b/.test(searchStr) || /[?&]call=(1|true)\b/.test(href);
    let fromStore = false;
    try {
      fromStore = sessionStorage.getItem("kamino-call") === String(id);
      if (fromStore) sessionStorage.removeItem("kamino-call");
    } catch {
      /* */
    }
    if (fromLink || fromStore) setAutoCall(true);
  }, [id, searchStr, href]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [q.data?.messages.length]);

  useEffect(() => {
    setOlder([]);
    setHasMore(null);
    setReactionPicker(null);
    setSearchOpen(false);
    setRoomToolsOpen(false);
    setInviteHandle("");
    setSearchDraft("");
    setSearchTerm("");
    return () => {
      cancelRecording.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [id]);

  if (isPending)
    return (
      <AppShell title="Chat">
        <div className="h-40" />
      </AppShell>
    );
  if (!user) return <RedirectToSignIn />;
  if (q.error)
    return (
      <AppShell title="Chat">
        <p className="px-4 py-12 text-sm text-danger">{(q.error as Error).message}</p>
      </AppShell>
    );

  const room = q.data?.room;
  const liveKind =
    room?.kind === "voice" || room?.kind === "screening" || room?.kind === "dm" ? room.kind : null;
  const isHost = room?.createdBy === user.id;
  const isCohost = q.data?.participants.some((p) => p.userId === user.id && p.isCohost);
  const canInvite =
    room?.kind === "private" && (isHost || isCohost || room.inviteRule === "members");

  async function runRoomAction(action: () => Promise<unknown>, success: string) {
    setRoomAction(true);
    try {
      await action();
      await q.refetch();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update room.");
      return false;
    } finally {
      setRoomAction(false);
    }
  }

  async function send(
    body: string,
    media?: { kind: "image" | "audio" | "video"; dataUrl: string },
  ) {
    if ((!body.trim() && !media) || sending.current) return;
    sending.current = true;
    setIsSending(true);
    try {
      if (editingId && !media) {
        const mid = editingId;
        await editMessage({ data: { roomId: id, messageId: mid, body } });
        setEditingId(null);
        setText("");
        void q.refetch();
        return;
      }
      const reply = replyTo?.id;
      await sendMessage({ data: { roomId: id, body, replyTo: reply, media } });
      setText("");
      setReplyTo(null);
      setStickersOn(false);
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Message could not be sent. Try again.");
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  }

  async function attachMedia(file?: File) {
    if (!file) return;
    const kind = /^video\/(mp4|webm)$/.test(file.type) ? "video" : "image";
    if (
      (kind === "image" &&
        (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 2_000_000)) ||
      (kind === "video" && file.size > 6_000_000)
    ) {
      toast.error("Choose a PNG, JPEG, WebP or GIF under 2 MB, or MP4/WebM under 6 MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read photo."));
      reader.readAsDataURL(file);
    });
    await send(text, { kind, dataUrl });
    if (mediaInput.current) mediaInput.current.value = "";
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording needs a supported browser and microphone.");
      return;
    }
    try {
      cancelRecording.current = false;
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelRecording.current) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquired;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const instance = new MediaRecorder(acquired, mime ? { mimeType: mime } : undefined);
      recorder.current = instance;
      const chunks: BlobPart[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onstop = () => {
        acquired.getTracks().forEach((track) => track.stop());
        stream.current = null;
        setRecording(false);
        if (cancelRecording.current) return;
        const blob = new Blob(chunks, { type: instance.mimeType || "audio/webm" });
        if (!blob.size || blob.size > 1_500_000) {
          toast.error("Voice note must be under 1.5 MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (!cancelRecording.current)
            void send("", { kind: "audio", dataUrl: String(reader.result) });
        };
        reader.onerror = () => toast.error("Could not save recording.");
        reader.readAsDataURL(blob);
      };
      instance.start();
      setRecording(true);
      window.setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 45_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microphone unavailable.");
      stream.current?.getTracks().forEach((track) => track.stop());
    }
  }

  async function loadOlder() {
    const first = (older[0] ?? q.data?.messages[0])?.id;
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getOlderMessages({ data: { roomId: id, beforeId: first } });
      setOlder((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function react(messageId: number, emoji: string) {
    try {
      await toggleMessageReaction({ data: { roomId: id, messageId, emoji } });
      setReactionPicker(null);
      await q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not react.");
    }
  }

  const messages = Array.from(
    new Map([...older, ...(q.data?.messages ?? [])].map((m) => [m.id, m])).values(),
  ).sort((a, b) => a.id - b.id);

  return (
    <AppShell title={room?.name ?? "Chat"}>
      {liveKind && (
        <LiveStage
          roomId={id}
          userId={user.id}
          name={user.displayName ?? "You"}
          kind={liveKind}
          autoCall={Boolean(autoCall) && liveKind === "dm"}
          watchUrl={room?.watchUrl}
          watchTitle={room?.watchTitle}
          peerName={room?.peerName ?? room?.name}
          peerHue={room?.peerHue}
          onWatchSaved={(url, title) => {
            void setWatchMedia({ data: { roomId: id, url, title } }).then(() => q.refetch());
          }}
          onVoice={(on) => {
            void toggleVoice({ data: { roomId: id, on } })
              .then(() => q.refetch())
              .catch(() => undefined);
            if (!on) void endCall({ data: id }).catch(() => undefined);
          }}
        />
      )}
      <div className="flex items-center justify-end gap-2 border-b border-border/70 px-4 py-2 text-xs">
        {room?.kind === "private" && (
          <button
            type="button"
            onClick={() => setRoomToolsOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-white/65 px-3 py-1.5"
            aria-label={roomToolsOpen ? "Close room members" : "Room members"}
          >
            <UsersRound className="size-3.5" /> Members
          </button>
        )}
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex items-center gap-1 rounded-full bg-white/65 px-3 py-1.5"
          aria-label={searchOpen ? "Close chat search" : "Search chat"}
        >
          {searchOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}
          {searchOpen ? "Close" : "Search"}
        </button>
        <button
          type="button"
          onClick={() =>
            void setRoomPreference({ data: { roomId: id, pinned: !room?.pinned } })
              .then(() => q.refetch())
              .catch((e) => toast.error(e.message))
          }
          className="flex items-center gap-1 rounded-full bg-white/65 px-3 py-1.5"
          aria-label={room?.pinned ? "Unpin chat" : "Pin chat"}
        >
          <Pin className="size-3.5" />
          {room?.pinned ? "Pinned" : "Pin"}
        </button>
        <button
          type="button"
          onClick={() =>
            void setRoomPreference({ data: { roomId: id, muted: !room?.muted } })
              .then(() => q.refetch())
              .catch((e) => toast.error(e.message))
          }
          className="flex items-center gap-1 rounded-full bg-white/65 px-3 py-1.5"
          aria-label={room?.muted ? "Unmute chat" : "Mute chat"}
        >
          {room?.muted ? <BellOff className="size-3.5" /> : <BellRing className="size-3.5" />}
          {room?.muted ? "Muted" : "Mute"}
        </button>
      </div>
      {roomToolsOpen && room?.kind === "private" && (
        <section className="room-tools border-b border-border/70 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg font-bold">Your room, your circle</p>
              <p className="text-xs text-muted">Only invited community members can enter.</p>
            </div>
            {isHost && (
              <label className="text-xs font-semibold">
                Invites
                <select
                  className="ml-2 rounded-xl border border-border bg-white/80 px-2 py-1.5"
                  value={room.inviteRule}
                  disabled={roomAction}
                  onChange={(event) =>
                    void runRoomAction(
                      () =>
                        setRoomInviteRule({
                          data: { roomId: id, rule: event.target.value as "hosts" | "members" },
                        }),
                      "Invite rule updated",
                    )
                  }
                >
                  <option value="hosts">Hosts only</option>
                  <option value="members">All members</option>
                </select>
              </label>
            )}
          </div>
          {canInvite && (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runRoomAction(
                  () => inviteToRoom({ data: { roomId: id, handle: inviteHandle } }),
                  "Member invited",
                ).then((ok) => { if (ok) setInviteHandle(""); });
              }}
            >
              <input
                className="min-w-40 flex-1 rounded-xl border border-border bg-white/85 px-3 py-2 text-sm"
                value={inviteHandle}
                onChange={(event) => setInviteHandle(event.target.value)}
                placeholder="Member handle"
                aria-label="Member handle"
              />
              <Button size="sm" type="submit" disabled={roomAction || !inviteHandle.trim()}>
                Invite
              </Button>
            </form>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.data?.participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {participant.name} {participant.isHost ? "👑" : participant.isCohost ? "✦" : ""}
                  </p>
                  <p className="truncate text-xs text-muted">@{participant.handle}</p>
                </div>
                {isHost && !participant.isHost && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={roomAction}
                      className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent"
                      onClick={() =>
                        void runRoomAction(
                          () =>
                            toggleRoomCohost({
                              data: { roomId: id, targetUserId: participant.userId },
                            }),
                          participant.isCohost ? "Cohost removed" : "Cohost added",
                        )
                      }
                    >
                      {participant.isCohost ? "Remove cohost" : "Make cohost"}
                    </button>
                    <button
                      type="button"
                      disabled={roomAction}
                      className="rounded-lg bg-secondary/15 px-2 py-1 text-xs font-bold text-secondary"
                      onClick={() =>
                        void runRoomAction(
                          () =>
                            transferRoomHost({
                              data: { roomId: id, targetUserId: participant.userId },
                            }),
                          "Room handed over",
                        )
                      }
                    >
                      Make host
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {searchOpen && (
        <section className="border-b border-border/70 bg-white/50 px-4 py-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchTerm(searchDraft.trim());
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-xl border border-border bg-white/70 px-3 py-2 text-sm"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search this conversation…"
              aria-label="Search this conversation"
            />
            <Button type="submit" size="sm" disabled={searchDraft.trim().length < 2}>
              Find
            </Button>
          </form>
          {searchTerm && (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {searchResults.isLoading && <p className="text-xs text-muted">Searching…</p>}
              {searchResults.error && (
                <p className="text-xs text-danger">Could not search messages.</p>
              )}
              {searchResults.data?.length === 0 && (
                <p className="text-xs text-muted">No matches in this conversation.</p>
              )}
              {searchResults.data?.map((message) => (
                <div key={message.id} className="rounded-xl bg-white/75 p-2 text-sm">
                  <p className="text-xs font-bold text-accent">
                    {message.author.nickname} · {new Date(message.createdAt).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  {message.mediaKind && (
                    <MessageAttachment
                      roomId={id}
                      messageId={message.id}
                      kind={message.mediaKind}
                      userId={user.id}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-3 overflow-y-auto px-4 py-4 k-scroll">
        {(hasMore ?? (q.data?.messages.length ?? 0) >= 200) && (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
            className="mx-auto flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-accent"
          >
            <History className="size-4" />
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {messages.map((m) => {
          const mine = m.author.userId === user.id;
          const sticker = parseSticker(m.body);
          const look = bubbleLook(m.bubbleStyle, m.bubbleHue);
          const bubbleStyle: CSSProperties | undefined =
            mine || m.bubbleStyle !== "soft"
              ? {
                  background: look.background,
                  color: look.color ?? undefined,
                  border: look.border ?? undefined,
                  backdropFilter: look.blur ? "blur(10px)" : undefined,
                }
              : undefined;
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              <Face name={m.author.nickname} hue={m.author.hue} size="sm" />
              <div
                className={cn(
                  "max-w-[80%] px-3 py-2 text-sm",
                  sticker
                    ? "bg-transparent px-0 py-0"
                    : mine
                      ? "rounded-2xl rounded-tr-sm text-fg"
                      : "rounded-2xl rounded-tl-sm bg-elevated",
                )}
                style={sticker ? undefined : bubbleStyle}
                onDoubleClick={() => !m.deleted && setReplyTo({ id: m.id, body: m.body })}
              >
                {!mine && !sticker && (
                  <p className="text-[11px] font-bold opacity-70">{m.author.nickname}</p>
                )}
                {m.replyTo ? <p className="mb-1 text-[11px] opacity-60">Reply</p> : null}
                {m.deleted ? (
                  <p className="italic text-subtle">Message removed</p>
                ) : sticker ? (
                  <StickerMark id={sticker} />
                ) : (
                  <>
                    {m.mediaKind && (
                      <MessageAttachment
                        roomId={id}
                        messageId={m.id}
                        kind={m.mediaKind}
                        userId={user.id}
                      />
                    )}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  </>
                )}
                {m.editedAt && !m.deleted ? (
                  <p className="mt-0.5 text-[10px] opacity-60">edited</p>
                ) : null}
                {!m.deleted && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-bold">
                    {m.reactions.map((r) => (
                      <button
                        type="button"
                        key={r.emoji}
                        onClick={() => void react(m.id, r.emoji)}
                        aria-label={`${r.mine ? "Remove" : "Add"} ${r.emoji} reaction`}
                        className={cn(
                          "rounded-full border px-2 py-0.5",
                          r.mine ? "border-accent/50 bg-accent/15" : "border-border/70 bg-white/50",
                        )}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setReactionPicker(reactionPicker === m.id ? null : m.id)}
                      className="rounded-full px-1.5 text-accent"
                      aria-label={`React to message ${m.id}`}
                    >
                      + react
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReplyTo({ id: m.id, body: m.body || m.mediaKind || "Message" })
                      }
                      className="rounded-full px-1.5 text-accent"
                    >
                      Reply
                    </button>
                  </div>
                )}
                {reactionPicker === m.id && (
                  <div className="mt-1 flex flex-wrap gap-1" aria-label="Choose reaction">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => void react(m.id, emoji)}
                        className="rounded-full bg-white/80 px-1.5 py-1 text-base"
                        aria-label={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {mine && !m.deleted && !sticker && (
                  <div className="mt-1 flex gap-2 text-[11px] font-bold opacity-70">
                    {!m.mediaKind && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(m.id);
                          setText(m.body);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void deleteMessage({ data: { roomId: id, messageId: m.id } })
                          .then(() => q.refetch())
                          .catch((e) => toast.error(e.message))
                      }
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className="sticky bottom-20 border-t border-white/70 bg-surface/75 px-4 py-3 backdrop-blur-xl md:bottom-0"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-full bg-elevated px-3 py-1.5 text-xs text-muted">
            <span className="truncate">Replying: {replyTo.body}</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-2 font-bold text-fg"
            >
              Cancel
            </button>
          </div>
        )}
        {editingId && (
          <div className="mb-2 flex items-center justify-between rounded-full bg-elevated px-3 py-1.5 text-xs text-muted">
            <span>Editing</span>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setText("");
              }}
              className="ml-2 font-bold text-fg"
            >
              Cancel
            </button>
          </div>
        )}
        {stickersOn && (
          <div className="mb-2 rounded-2xl bg-surface p-3 shadow-border">
            <div role="tablist" aria-label="Sticker packs" className="mb-2 flex gap-2">
              {STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  role="tab"
                  type="button"
                  aria-selected={pack.id === stickerPack}
                  onClick={() => setStickerPack(pack.id)}
                  className={cn("h-8 rounded-full px-3 text-xs font-bold", pack.id === stickerPack ? "bg-accent text-accent-fg" : "bg-elevated text-muted")}
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {(STICKER_PACKS.find((pack) => pack.id === stickerPack) ?? STICKER_PACKS[0]!).stickers.map((s) => (
                <button key={s.id} type="button" onClick={() => void send(stickerToken(s.id))} className="grid place-items-center" aria-label={s.label}>
                  <StickerMark id={s.id} className="size-12" />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={mediaInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
            className="sr-only"
            aria-label="Choose chat photo or video"
            onChange={(e) =>
              void attachMedia(e.target.files?.[0]).catch((err) =>
                toast.error(err instanceof Error ? err.message : "Could not attach media."),
              )
            }
          />
          <button
            type="button"
            onClick={() => mediaInput.current?.click()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-elevated text-accent"
            aria-label="Attach photo or video"
            disabled={isSending}
          >
            <ImagePlus className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => void toggleRecording()}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full",
              recording ? "bg-danger text-white" : "bg-elevated text-accent",
            )}
            aria-label={recording ? "Stop recording" : "Record voice note"}
            disabled={isSending}
          >
            {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => setStickersOn((v) => !v)}
            className={cn(
              "grid size-11 place-items-center rounded-full",
              stickersOn ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
            )}
            aria-label="Stickers"
          >
            <Smile className="size-5" />
          </button>
          <input
            aria-label="Message"
            disabled={isSending}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? "Reply" : "Message"}
            className="h-11 min-w-0 flex-1 rounded-full bg-elevated px-4 text-sm"
          />
          <Button
            type="submit"
            aria-label="Send message"
            disabled={isSending || !text.trim()}
            className="size-11 shrink-0 rounded-full p-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
