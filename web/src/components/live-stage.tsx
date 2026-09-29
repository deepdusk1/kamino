import { ChevronDown, Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Face } from "@/components/face";
import { KAMINO_CALL_EVENT } from "@/components/incoming-call";
import { parseWatchInput, SHELF, youtubeId, type ShelfKind } from "@/lib/kamino/shelf";
import { rtcPeerId, rtcRoomKey, useLiveRoom } from "@/lib/multiplayer/use-live-room";
import { cn } from "@/lib/utils";

type WatchWire = {
  t: "watch";
  url: string;
  title: string;
  kind: ShelfKind;
  paused: boolean;
  at: number;
  ts: number;
  by: string;
};

type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  loadVideoById: (id: string, start?: number) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
        },
      ) => YtPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYt(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector("script[src*='youtube.com/iframe_api']")) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

async function openMic(video: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" } : false,
  });
}

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function RemoteMedia({
  stream,
  name,
  compact,
  fill,
}: {
  stream: MediaStream;
  name: string;
  compact?: boolean;
  fill?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = stream.getVideoTracks().some((t) => t.readyState !== "ended");
  useEffect(() => {
    if (hasVideo && videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    } else if (audioRef.current) {
      audioRef.current.srcObject = stream;
      void audioRef.current.play().catch(() => undefined);
    }
  }, [stream, hasVideo]);
  if (hasVideo) {
    if (fill) {
      return (
        <video ref={videoRef} autoPlay playsInline muted={false} className="absolute inset-0 h-full w-full object-cover" />
      );
    }
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-elevated", compact ? "h-24 w-36" : "aspect-video w-full")}>
        <video ref={videoRef} autoPlay playsInline muted={false} className="h-full w-full object-cover" />
        <p className="absolute bottom-1 left-2 text-[11px] font-extrabold">{name}</p>
      </div>
    );
  }
  return <audio ref={audioRef} autoPlay playsInline />;
}

export function LiveStage({
  roomId,
  userId,
  name,
  kind,
  autoCall,
  watchUrl,
  watchTitle,
  peerName,
  peerHue,
  onWatchSaved,
  onVoice,
}: {
  roomId: number;
  userId: string;
  name: string;
  kind: "voice" | "screening" | "dm" | "public" | "private";
  autoCall?: boolean;
  watchUrl?: string;
  watchTitle?: string;
  peerName?: string;
  peerHue?: number;
  onWatchSaved?: (url: string, title: string) => void;
  onVoice?: (on: boolean) => void;
}) {
  const screening = kind === "screening";
  const canCall = kind === "voice" || kind === "screening" || kind === "dm";
  const [onCall, setOnCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const localRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef<number>(0);

  const enabled = screening || onCall;
  const live = useLiveRoom({
    roomKey: rtcRoomKey(roomId),
    selfId: rtcPeerId(userId),
    name,
    enabled,
  });

  useEffect(() => {
    if (live.joined && localRef.current) live.setLocalStream(localRef.current);
  }, [live.joined, live.setLocalStream, onCall]);

  useEffect(() => {
    if (previewRef.current && localRef.current && cam) {
      previewRef.current.srcObject = localRef.current;
    }
  }, [cam, onCall]);

  async function joinCall(withCam = false) {
    setErr(null);
    try {
      const stream = await openMic(withCam);
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = stream;
      setCam(withCam);
      setMuted(false);
      setMinimized(false);
      startedAt.current = Date.now();
      setOnCall(true);
      onVoice?.(true);
      if (live.joined) live.setLocalStream(stream);
    } catch {
      setErr("Mic permission is required for a live call.");
    }
  }

  function hangUp() {
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    live.setLocalStream(null);
    setOnCall(false);
    setCam(false);
    setMinimized(false);
    onVoice?.(false);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }

  async function toggleCam() {
    if (!onCall) {
      await joinCall(true);
      return;
    }
    if (cam) {
      localRef.current?.getVideoTracks().forEach((t) => {
        t.stop();
        localRef.current?.removeTrack(t);
      });
      setCam(false);
      live.setLocalStream(localRef.current);
      return;
    }
    try {
      const extra = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
      });
      extra.getVideoTracks().forEach((t) => localRef.current?.addTrack(t));
      setCam(true);
      live.setLocalStream(localRef.current);
    } catch {
      setErr("Camera permission denied.");
    }
  }

  useEffect(() => {
    return () => {
      localRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoCall || autoStarted.current) return;
    autoStarted.current = true;
    void joinCall(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCall]);

  useEffect(() => {
    function onAnswer(e: Event) {
      const id = Number((e as CustomEvent).detail);
      if (id !== roomId) return;
      if (onCall || autoStarted.current) return;
      autoStarted.current = true;
      void joinCall(false);
    }
    window.addEventListener(KAMINO_CALL_EVENT, onAnswer);
    return () => window.removeEventListener(KAMINO_CALL_EVENT, onAnswer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onCall]);

  useEffect(() => {
    if (!onCall) {
      setElapsed(0);
      return;
    }
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 1000);
    return () => window.clearInterval(id);
  }, [onCall]);

  if (!canCall && !screening) return null;

  const connected = live.peers.filter((p) => p.connectionState === "connected").length;
  const failed = live.peers.filter((p) => p.connectionState === "failed");
  const otherName = live.peers[0]?.name ?? peerName ?? "Member";
  const otherHue = peerHue ?? 265;
  const remoteEntries = Object.entries(live.streams);
  const remoteVideo = remoteEntries.find(([, stream]) => stream.getVideoTracks().some((t) => t.readyState !== "ended"));
  const dmCall = kind === "dm" && onCall;

  const controls = (
    <>
      <button
        type="button"
        onClick={toggleMute}
        className={cn(
          "grid size-14 place-items-center rounded-full",
          muted ? "bg-elevated text-fg" : "bg-surface text-fg",
        )}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
      </button>
      {(kind === "dm" || screening) && (
        <button
          type="button"
          onClick={() => void toggleCam()}
          className="grid size-14 place-items-center rounded-full bg-surface text-fg"
          aria-label={cam ? "Camera off" : "Camera"}
        >
          {cam ? <VideoOff className="size-6" /> : <Video className="size-6" />}
        </button>
      )}
      <button
        type="button"
        onClick={hangUp}
        className="grid size-16 place-items-center rounded-full bg-danger text-fg"
        aria-label="Hang up"
      >
        <PhoneOff className="size-7" />
      </button>
    </>
  );

  return (
    <div className="space-y-3 px-4 pt-4">
      {screening && (
        <WatchDeck
          live={live}
          selfId={live.selfId}
          initialUrl={watchUrl ?? ""}
          initialTitle={watchTitle ?? ""}
          onWatchSaved={onWatchSaved}
        />
      )}

      {onCall && kind !== "dm" && (
        <div className="flex flex-wrap gap-2">
          {remoteEntries.map(([id, stream]) => (
            <RemoteMedia
              key={id}
              stream={stream}
              name={live.peers.find((p) => p.id === id)?.name ?? "Member"}
              compact
            />
          ))}
          {cam && (
            <div className="relative h-24 w-36 overflow-hidden rounded-2xl bg-elevated">
              <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              <p className="absolute bottom-1 left-2 text-[11px] font-extrabold">You</p>
            </div>
          )}
        </div>
      )}

      {dmCall && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex w-full items-center gap-3 rounded-2xl bg-elevated px-3 py-2 text-left"
        >
          <span className="size-2 rounded-full bg-ok" />
          <Face name={otherName} hue={otherHue} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{otherName}</span>
            <span className="text-xs text-muted tabular-nums">
              {connected ? formatElapsed(elapsed) : "Calling…"}
            </span>
          </span>
          <span className="text-xs font-bold text-accent">Return</span>
        </button>
      )}

      {dmCall &&
        !minimized &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg" role="dialog" aria-label="Call">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {remoteVideo ? (
                <RemoteMedia stream={remoteVideo[1]!} name={otherName} fill />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-elevated),var(--color-bg))]" />
              )}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="grid size-11 place-items-center rounded-full bg-bg/50 text-fg"
                  aria-label="Hide call"
                >
                  <ChevronDown className="size-5" />
                </button>
                <div className="rounded-full bg-bg/50 px-4 py-1.5 text-center">
                  <p className="font-display text-sm font-extrabold">{otherName}</p>
                  <p className="text-xs font-bold text-ok tabular-nums">
                    {connected ? formatElapsed(elapsed) : "Calling…"}
                  </p>
                </div>
                <span className="size-11" />
              </div>
              {!remoteVideo && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-4">
                    <span className={cn(!connected && "k-ring relative")}>
                      <Face name={otherName} hue={otherHue} size="call" />
                    </span>
                    <p className="font-display text-2xl font-extrabold">{otherName}</p>
                    <p className="text-sm font-bold text-muted">{connected ? "Connected" : "Calling…"}</p>
                  </div>
                </div>
              )}
              {cam && (
                <div className="absolute right-4 bottom-32 h-36 w-28 overflow-hidden rounded-2xl bg-elevated shadow-border">
                  <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
              {controls}
            </div>
          </div>,
          document.body,
        )}

      {!dmCall && (
        <div className="flex flex-wrap items-center gap-2">
          {onCall ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-extrabold">
                <span className="size-2 rounded-full bg-ok" />
                Live · {connected}/{live.peers.length || 0} linked
              </span>
              <Button size="sm" variant="secondary" onClick={toggleMute}>
                {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {muted ? "Unmute" : "Mute"}
              </Button>
              {screening && (
                <Button size="sm" variant="secondary" onClick={() => void toggleCam()}>
                  {cam ? <VideoOff className="size-4" /> : <Video className="size-4" />}
                  {cam ? "Camera off" : "Camera"}
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={hangUp}>
                <PhoneOff className="size-4" />
                Hang up
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void joinCall(false)}>
              {kind === "dm" ? <Phone className="size-4" /> : <Mic className="size-4" />}
              {kind === "dm" ? "Call" : "Join voice"}
            </Button>
          )}
          {live.peers.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
              <Face name={p.name} hue={210} size="sm" />
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  p.connectionState === "connected" ? "bg-ok" : p.connectionState === "failed" ? "bg-danger" : "bg-warn",
                )}
              />
              {p.name}
            </span>
          ))}
        </div>
      )}
      {failed.length > 0 && (
        <p className="text-xs text-muted">
          {failed.map((p) => p.name).join(", ")} couldn’t connect — strict networks block some peer paths.
        </p>
      )}
      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </div>
  );
}

function WatchDeck({
  live,
  selfId,
  initialUrl,
  initialTitle,
  onWatchSaved,
}: {
  live: ReturnType<typeof useLiveRoom>;
  selfId: string;
  initialUrl: string;
  initialTitle: string;
  onWatchSaved?: (url: string, title: string) => void;
}) {
  const first = SHELF[0]!;
  const [url, setUrl] = useState(initialUrl || first.url);
  const [title, setTitle] = useState(initialTitle || first.title);
  const [kind, setKind] = useState<ShelfKind>(youtubeId(initialUrl) ? "youtube" : "mp4");
  const [paused, setPaused] = useState(true);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const controller = useRef(selfId);
  const applying = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const yt = useRef<YtPlayer | null>(null);
  const atRef = useRef(0);
  const emitRef = useRef<(next?: Partial<WatchWire>) => void>(() => undefined);
  const snapped = useRef(new Set<string>());

  const emit = useCallback(
    (next: Partial<WatchWire> = {}) => {
      const msg: WatchWire = {
        t: "watch",
        url,
        title,
        kind,
        paused,
        at: atRef.current,
        ts: Date.now(),
        by: selfId,
        ...next,
      };
      controller.current = selfId;
      live.send(msg);
    },
    [live, url, title, kind, paused, selfId],
  );
  emitRef.current = emit;

  useEffect(() => {
    return live.onMessage((_from, data) => {
      const raw = data as { t?: string } | undefined;
      if (!raw) return;
      if (raw.t === "watch-hello") {
        if (controller.current === selfId) emitRef.current({ at: atRef.current });
        return;
      }
      const msg = data as WatchWire | undefined;
      if (!msg || msg.t !== "watch") return;
      controller.current = msg.by;
      applying.current = true;
      if (msg.url !== url) {
        setUrl(msg.url);
        setTitle(msg.title);
        setKind(msg.kind);
      }
      setPaused(msg.paused);
      atRef.current = msg.at;
      const driftClock = msg.paused ? msg.at : msg.at + (Date.now() - msg.ts) / 1000;
      const vid = videoRef.current;
      if (msg.kind === "mp4" && vid) {
        if (Math.abs(vid.currentTime - driftClock) > 1.2) vid.currentTime = Math.max(0, driftClock);
        if (msg.paused) void vid.pause();
        else void vid.play().catch(() => undefined);
      }
      if (msg.kind === "youtube" && yt.current) {
        const now = yt.current.getCurrentTime?.() ?? 0;
        if (Math.abs(now - driftClock) > 1.2) yt.current.seekTo(Math.max(0, driftClock), true);
        if (msg.paused) yt.current.pauseVideo();
        else yt.current.playVideo();
      }
      window.setTimeout(() => {
        applying.current = false;
      }, 400);
    });
  }, [live, url, selfId]);

  useEffect(() => {
    if (!live.joined) return;
    live.send({ t: "watch-hello" });
  }, [live.joined, live.send]);

  useEffect(() => {
    if (controller.current !== selfId) return;
    for (const p of live.peers) {
      if (p.connectionState !== "connected" || snapped.current.has(p.id)) continue;
      snapped.current.add(p.id);
      live.send(
        {
          t: "watch",
          url,
          title,
          kind,
          paused,
          at: atRef.current,
          ts: Date.now(),
          by: selfId,
        } satisfies WatchWire,
        p.id,
      );
    }
  }, [live.peers, live.send, url, title, kind, paused, selfId]);

  useEffect(() => {
    if (kind !== "youtube") {
      yt.current?.destroy();
      yt.current = null;
      return;
    }
    const id = youtubeId(url);
    if (!id || !ytHost.current) return;
    let cancelled = false;
    void loadYt().then(() => {
      if (cancelled || !window.YT?.Player || !ytHost.current) return;
      yt.current?.destroy();
      yt.current = new window.YT.Player(ytHost.current, {
        videoId: id,
        playerVars: { rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onStateChange: (e) => {
            if (applying.current) return;
            const playing = e.data === window.YT?.PlayerState?.PLAYING;
            const pausedNow = e.data === window.YT?.PlayerState?.PAUSED;
            if (playing || pausedNow) {
              atRef.current = yt.current?.getCurrentTime() ?? 0;
              setPaused(!playing);
              emitRef.current({ paused: !playing, at: atRef.current });
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, url]);

  useEffect(() => {
    if (!live.joined) return;
    const id = window.setInterval(() => {
      if (controller.current !== selfId) return;
      if (kind === "mp4" && videoRef.current) atRef.current = videoRef.current.currentTime;
      if (kind === "youtube" && yt.current) atRef.current = yt.current.getCurrentTime() ?? atRef.current;
      emitRef.current({ at: atRef.current, paused });
    }, 2000);
    return () => window.clearInterval(id);
  }, [live.joined, paused, kind, selfId]);

  function loadFilm(next: { url: string; title: string; kind: ShelfKind }) {
    setUrl(next.url);
    setTitle(next.title);
    setKind(next.kind);
    setPaused(false);
    atRef.current = 0;
    onWatchSaved?.(next.url, next.title);
    emit({ ...next, paused: false, at: 0, ts: Date.now(), by: selfId });
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-surface shadow-border">
      <div className="relative aspect-video bg-elevated">
        {kind === "mp4" ? (
          <video
            ref={videoRef}
            key={url}
            src={url}
            className="h-full w-full object-contain"
            controls
            playsInline
            onPlay={() => {
              if (applying.current) return;
              setPaused(false);
              atRef.current = videoRef.current?.currentTime ?? 0;
              emit({ paused: false, at: atRef.current });
            }}
            onPause={() => {
              if (applying.current) return;
              setPaused(true);
              atRef.current = videoRef.current?.currentTime ?? 0;
              emit({ paused: true, at: atRef.current });
            }}
            onSeeked={() => {
              if (applying.current) return;
              atRef.current = videoRef.current?.currentTime ?? 0;
              emit({ at: atRef.current });
            }}
          />
        ) : (
          <div ref={ytHost} className="h-full w-full" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-bg/80 to-transparent px-4 py-3">
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-accent uppercase">Watch party</p>
          <p className="font-display text-lg font-extrabold">{title}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted">
          Play, pause, and seek stay in lockstep. Netflix’s catalog can’t stream here — pick an open film or paste
          YouTube.
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1 k-scroll">
          {SHELF.map((film) => (
            <button
              key={film.id}
              type="button"
              onClick={() => loadFilm(film)}
              className={cn(
                "w-32 shrink-0 overflow-hidden rounded-2xl text-left shadow-border",
                url === film.url && "outline outline-2 outline-accent",
              )}
            >
              <img src={film.poster} alt="" className="h-20 w-full object-cover" />
              <span className="block px-2 py-1.5">
                <span className="block truncate text-xs font-extrabold">{film.title}</span>
                <span className="block text-[10px] text-subtle">
                  {film.year} · {film.tagline}
                </span>
              </span>
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = parseWatchInput(paste);
            if ("error" in parsed) {
              setNote(parsed.error);
              return;
            }
            setNote(null);
            loadFilm({ url: parsed.url, title: parsed.title, kind: parsed.kind });
            setPaste("");
          }}
        >
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste a YouTube link"
            className="h-11 flex-1 rounded-full bg-elevated px-4 text-sm"
          />
          <Button type="submit" variant="secondary">
            Play
          </Button>
        </form>
        {note ? <p className="text-sm text-warn">{note}</p> : null}
      </div>
    </section>
  );
}
