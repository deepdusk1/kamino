import { ChevronDown, Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Face } from "@/components/face";
import { KAMINO_CALL_EVENT } from "@/components/incoming-call";
import { parseWatchInput, SHELF, youtubeId, type ShelfKind } from "@/lib/kamino/shelf";
import { rtcPeerId, rtcRoomKey, useLiveRoom } from "@/lib/multiplayer/use-live-room";
import { cn } from "@/lib/utils";
import { getLiveStage } from '@/lib/kamino/community-v9';

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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      );
    }
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-tile bg-surface-alt",
          compact ? "h-24 w-36" : "aspect-video w-full",
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="h-full w-full object-cover"
        />
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
  showIdleBar = true,
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
  /**
   * Show the "Call" / "Join voice" bar while not in a call (default). The chat room turns it off for DMs, where the
   * phone button in its header starts the call instead (it sends the same event as answering an incoming call).
   */
  showIdleBar?: boolean;
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
  const stage=useQuery({queryKey:['live-stage',roomId],queryFn:()=>getLiveStage({data:{roomId}}),enabled:kind!=='dm'&&canCall,refetchInterval:2500});
  const mine=stage.data?.participants.find(p=>p.userId===userId);
  const maySpeak=kind==='dm'||!!stage.data&&!!mine&&!mine.muted&&(!stage.data.enabled||mine.role==='host'||mine.role==='speaker');
  const speakingRef=useRef(maySpeak);speakingRef.current=maySpeak;

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
      const current=kind==='dm'?null:await getLiveStage({data:{roomId}});
      const self=current?.participants.find(p=>p.userId===userId);
      if(current?.scheduledAt&&new Date(current.scheduledAt)>new Date())throw new Error('This live room has not started yet.');
      if(current?.locked&&!current.host)throw new Error('This room is locked.');
      const allowed=kind==='dm'||!!current&&!!self&&!self.muted&&(!current.enabled||self.role==='host'||self.role==='speaker');
      const stream = allowed?await openMic(withCam):new MediaStream();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = stream;
      setCam(allowed&&withCam);
      setMuted(!allowed);
      setMinimized(false);
      startedAt.current = Date.now();
      setOnCall(true);
      onVoice?.(true);
      if (live.joined) live.setLocalStream(stream);
    } catch (error) {
      setErr(error instanceof Error?error.message:'Could not join the live room.');
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
    // Let the header's call button (or an answered call) start a new call later.
    autoStarted.current = false;
  }

  function toggleMute() {
    if(!speakingRef.current){setErr('You are listening. Ask the host for permission to speak.');return;}
    const next = !muted;
    setMuted(next);
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }

  async function toggleCam() {
    if(!speakingRef.current){setErr('Only speakers can turn on a camera in this room.');return;}
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
      if(!speakingRef.current||!localRef.current){extra.getTracks().forEach(t=>t.stop());return;}
      extra.getVideoTracks().forEach((t) => localRef.current?.addTrack(t));
      setCam(true);
      live.setLocalStream(localRef.current);
    } catch {
      setErr("Camera permission denied.");
    }
  }

  useEffect(() => {
    if(!onCall||kind==='dm')return;
    if(stage.error){hangUp();setErr('You no longer have access to this live room.');return;}
    if(!maySpeak){localRef.current?.getAudioTracks().forEach(t=>{t.enabled=false;});localRef.current?.getVideoTracks().forEach(t=>{t.enabled=false;});setMuted(true);return;}
    let cancelled=false;
    if(localRef.current&&!localRef.current.getAudioTracks().length){
      void openMic(false).then(stream=>{if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}localRef.current=stream;stream.getAudioTracks().forEach(t=>{t.enabled=false;});live.setLocalStream(stream);setMuted(true);}).catch(()=>setErr('Allow microphone access to speak.'));
    }
    return()=>{cancelled=true;};
    // Each change in the server's role state immediately disables this app's outgoing media.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[onCall,maySpeak,stage.error,kind]);

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
  const remoteEntries = Object.entries(live.streams).filter(([peerId])=>{
    if(kind==='dm')return true;
    const person=stage.data?.participants.find(p=>rtcPeerId(p.userId)===peerId);
    return !!person&&!person.muted&&(!stage.data?.enabled||person.role==='host'||person.role==='speaker');
  });
  const remoteVideo = remoteEntries.find(([, stream]) =>
    stream.getVideoTracks().some((t) => t.readyState !== "ended"),
  );
  const dmCall = kind === "dm" && onCall;
  // Nothing to show for a DM that isn't in a call when the header has the call button.
  if (kind === "dm" && !showIdleBar && !onCall && !err) return null;

  const pill =
    "k-focus k-hit inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-alt px-3.5 text-[13px] font-bold text-ink transition-colors hover:brightness-[0.97]";

  const controls = (
    <>
      <button
        type="button"
        onClick={toggleMute}
        className={cn(
          "grid size-14 place-items-center rounded-full",
          muted ? "bg-surface-alt text-ink" : "bg-surface text-ink shadow-card",
        )}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
      </button>
      {(kind === "dm" || screening) && (
        <button
          type="button"
          onClick={() => void toggleCam()}
          className="grid size-14 place-items-center rounded-full bg-surface text-ink shadow-card"
          aria-label={cam ? "Camera off" : "Camera"}
        >
          {cam ? <VideoOff className="size-6" /> : <Video className="size-6" />}
        </button>
      )}
      <button
        type="button"
        onClick={hangUp}
        className="grid size-16 place-items-center rounded-full bg-red-strong text-white shadow-lift"
        aria-label="Hang up"
      >
        <PhoneOff className="size-7" />
      </button>
    </>
  );

  return (
    <div className="space-y-3 px-3 pt-3 lg:px-4">
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
            <div className="relative h-24 w-36 overflow-hidden rounded-tile bg-surface-alt">
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <p className="absolute bottom-1 left-2 text-[11px] font-extrabold">You</p>
            </div>
          )}
        </div>
      )}

      {dmCall && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="k-focus flex w-full items-center gap-3 rounded-tile bg-tint-green px-3 py-2 text-left"
        >
          <span className="size-2 rounded-full bg-green" />
          <Face name={otherName} hue={otherHue} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{otherName}</span>
            <span className="text-xs text-muted tabular-nums">
              {connected ? formatElapsed(elapsed) : "Calling…"}
            </span>
          </span>
          <span className="rounded-full bg-green-strong px-3 py-1 text-xs font-bold text-white">
            Return
          </span>
        </button>
      )}

      {dmCall &&
        !minimized &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col bg-bg text-ink"
            role="dialog"
            aria-label="Call"
          >
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {remoteVideo ? (
                <RemoteMedia stream={remoteVideo[1]!} name={otherName} fill />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-tint-violet),var(--color-bg))]" />
              )}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="grid size-11 place-items-center rounded-full bg-surface/70 text-ink shadow-card"
                  aria-label="Hide call"
                >
                  <ChevronDown className="size-5" />
                </button>
                <div className="rounded-full bg-surface/70 px-4 py-1.5 text-center shadow-card">
                  <p className="text-sm font-extrabold text-ink">{otherName}</p>
                  <p className="text-xs font-bold text-green-ink tabular-nums">
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
                    <p className="text-2xl font-extrabold tracking-[-0.02em] text-ink">
                      {otherName}
                    </p>
                    <p className="text-sm font-bold text-muted">
                      {connected ? "Connected" : "Calling…"}
                    </p>
                  </div>
                </div>
              )}
              {cam && (
                <div className="absolute right-4 bottom-32 h-36 w-28 overflow-hidden rounded-tile bg-surface-alt shadow-lift">
                  <video
                    ref={previewRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
              {controls}
            </div>
          </div>,
          document.body,
        )}

      {!dmCall && (onCall || showIdleBar) && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-2.5 shadow-card">
          {onCall ? (
            <>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-tint-green px-3 text-xs font-extrabold text-green-ink">
                <span className="size-2 rounded-full bg-green" />
                Live · {connected}/{live.peers.length || 0} linked
              </span>
              <button type="button" onClick={toggleMute} className={pill}>
                {muted ? (
                  <MicOff className="size-4" aria-hidden />
                ) : (
                  <Mic className="size-4" aria-hidden />
                )}
                {muted ? "Unmute" : "Mute"}
              </button>
              {screening && (
                <button type="button" onClick={() => void toggleCam()} className={pill}>
                  {cam ? (
                    <VideoOff className="size-4" aria-hidden />
                  ) : (
                    <Video className="size-4" aria-hidden />
                  )}
                  {cam ? "Camera off" : "Camera"}
                </button>
              )}
              <button
                type="button"
                onClick={hangUp}
                className={cn(pill, "bg-red-strong text-white hover:bg-red-strong")}
              >
                <PhoneOff className="size-4" aria-hidden />
                Hang up
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void joinCall(false)}
              className={cn(pill, "bg-grad-primary text-white shadow-glow hover:brightness-105")}
            >
              {kind === "dm" ? (
                <Phone className="size-4" aria-hidden />
              ) : (
                <Mic className="size-4" aria-hidden />
              )}
              {kind === "dm" ? "Call" : "Join voice"}
            </button>
          )}
          {live.peers.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted"
            >
              <Face name={p.name} hue={210} size="sm" />
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  p.connectionState === "connected"
                    ? "bg-green"
                    : p.connectionState === "failed"
                      ? "bg-red"
                      : "bg-orange",
                )}
              />
              {p.name}
            </span>
          ))}
        </div>
      )}
      {failed.length > 0 && (
        <p className="text-xs text-muted">
          {failed.map((p) => p.name).join(", ")} couldn’t connect — strict networks block some peer
          paths.
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
      if (kind === "youtube" && yt.current)
        atRef.current = yt.current.getCurrentTime() ?? atRef.current;
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
    <section className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="relative aspect-video bg-surface-alt">
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
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-violet uppercase">
            Watch party
          </p>
          <p className="text-lg font-extrabold text-ink">{title}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted">
          Play, pause, and seek stay in lockstep. Netflix’s catalog can’t stream here — pick an open
          film or paste YouTube.
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
            aria-label="YouTube link"
            className="k-focus h-11 flex-1 rounded-full bg-surface-alt px-4 text-[16px] text-ink outline-none placeholder:text-[14px] placeholder:text-subtle lg:text-[15px]"
          />
          <button
            type="submit"
            className="k-focus h-11 rounded-full bg-grad-primary px-5 text-[14px] font-bold text-white shadow-glow"
          >
            Play
          </button>
        </form>
        {note ? <p className="text-sm text-warn">{note}</p> : null}
      </div>
    </section>
  );
}
