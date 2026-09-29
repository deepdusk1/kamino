import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/api/client";
import { apiBaseUrl } from "@/api/config";
import { api } from "@/api/endpoints";
import { rtcPeerId, rtcRoomKey } from "./ids";
import { CallSession, DEFAULT_ICE, type PeerState, type StreamLike } from "./session";
import { loadWebRTC, rtcApiFrom, type NativeWebRTC } from "./webrtc";

type MediaStreamT = InstanceType<NativeWebRTC["MediaStream"]>;

export type CallStatus = "unavailable" | "joining" | "active" | "ended";

export type CallState = {
  status: CallStatus;
  /** A plain-English reason when the call could not start or ended. */
  message: string | null;
  peers: PeerState[];
  /** Video/audio from each other person, by their id. */
  remoteStreams: Record<string, MediaStreamT>;
  localStream: MediaStreamT | null;
  muted: boolean;
  cameraOn: boolean;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  hangUp: () => void;
};

/** Words for a problem starting the microphone. */
function micProblem(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Allow microphone access in Settings to join calls.";
  if (name === "NotFoundError") return "No microphone was found on this device.";
  return error instanceof Error && error.message ? error.message : "The microphone could not start.";
}

/**
 * Joins the live call of one chat room and keeps it going while the screen is open. Leaving the screen (or calling
 * `hangUp`) closes every connection, releases the microphone and camera, and marks you as no longer in the call.
 */
export function useCall(roomId: number, userId: string | undefined, displayName: string): CallState {
  const [status, setStatus] = useState<CallStatus>(() => (loadWebRTC() ? "joining" : "unavailable"));
  const [message, setMessage] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStreamT>>({});
  const [localStream, setLocalStream] = useState<MediaStreamT | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const sessionRef = useRef<CallSession | null>(null);
  const streamRef = useRef<MediaStreamT | null>(null);
  const hangUpRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const webrtc = loadWebRTC();
    if (!webrtc || !userId || !Number.isFinite(roomId)) return;
    let cancelled = false;
    let session: CallSession | null = null;
    let stream: MediaStreamT | null = null;
    let inVoice = false;

    const cleanup = () => {
      session?.close();
      session = null;
      sessionRef.current = null;
      for (const track of stream?.getTracks() ?? []) track.stop();
      stream = null;
      streamRef.current = null;
      if (inVoice) {
        inVoice = false;
        // Best effort: the person may already be offline.
        void api.setVoice(roomId, false).catch(() => undefined);
        void api.endCall(roomId).catch(() => undefined);
      }
    };
    hangUpRef.current = () => {
      cleanup();
      setPeers([]);
      setRemoteStreams({});
      setLocalStream(null);
      setStatus("ended");
      setMessage((current) => current ?? "You left the call.");
    };

    void (async () => {
      try {
        // Ask for the microphone first, so a refusal is explained before anyone is told you joined.
        stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) return cleanup();
        streamRef.current = stream;
        setLocalStream(stream);
        await api.setVoice(roomId, true);
        inVoice = true;
        const iceServers = await api.iceServers().catch(() => DEFAULT_ICE);
        if (cancelled) return cleanup();
        session = new CallSession({
          api: rtcApiFrom(webrtc),
          baseUrl: apiBaseUrl(),
          token: getAuthToken,
          fetch,
          roomKey: rtcRoomKey(roomId),
          selfId: rtcPeerId(userId),
          name: displayName,
          iceServers,
          localStream: stream as unknown as StreamLike,
          onConnected: () => setStatus("active"),
          onPeers: (list) => {
            setPeers(list);
            const alive = new Set(list.map((p) => p.id));
            setRemoteStreams((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => alive.has(id))));
          },
          onRemoteStream: (peerId, remote) => setRemoteStreams((previous) => ({ ...previous, [peerId]: remote as unknown as MediaStreamT })),
          onEnded: (reason) => {
            cleanup();
            setStatus("ended");
            setMessage(reason);
          },
        });
        sessionRef.current = session;
        await session.join();
      } catch (error) {
        cleanup();
        if (!cancelled) {
          setStatus("ended");
          setMessage(micProblem(error));
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [roomId, userId, displayName]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      // Muting switches the microphone track off; the connection stays up.
      for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = !next;
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    const webrtc = loadWebRTC();
    const session = sessionRef.current;
    const current = streamRef.current;
    if (!webrtc || !session || !current) return;
    try {
      let next: MediaStreamT;
      if (cameraOn) {
        for (const track of current.getVideoTracks()) track.stop();
        next = new webrtc.MediaStream(current.getAudioTracks());
      } else {
        const video = await webrtc.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user" } });
        next = new webrtc.MediaStream([...current.getAudioTracks(), ...video.getVideoTracks()]);
      }
      streamRef.current = next;
      setLocalStream(next);
      session.setLocalStream(next as unknown as StreamLike);
      setCameraOn(!cameraOn);
    } catch (error) {
      setMessage(error instanceof Error && /denied|permission|allowed/i.test(error.message) ? "Allow camera access in Settings to turn on video." : "The camera could not start.");
    }
  }, [cameraOn]);

  const hangUp = useCallback(() => hangUpRef.current(), []);

  return { status, message, peers, remoteStreams, localStream, muted, cameraOn, toggleMute, toggleCamera, hangUp };
}
