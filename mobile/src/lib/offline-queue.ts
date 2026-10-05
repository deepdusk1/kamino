import NetInfo from "@react-native-community/netinfo";
import { readSecret, writeSecret } from "@/auth/storage";

/**
 * Offline message queue: when a chat message cannot reach the server, it waits here and is
 * replayed automatically on reconnect. Every queued message carries a random `clientTag`; the
 * server de-duplicates on it, so a replay after a flaky send can never post a second copy.
 */
const QUEUE_KEY = "kamino.offline-queue";
const MAX_QUEUE = 100;

export type QueuedMessage = {
  clientTag: string;
  input: { roomId: number; body: string; replyTo?: number | null; clientTag: string };
  queuedAt: number;
};

type Queue = QueuedMessage[];

let listeners: ((count: number) => void)[] = [];

function emit(count: number) {
  for (const listener of listeners) listener(count);
}

export function onQueueChange(listener: (count: number) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

async function load(): Promise<Queue> {
  try {
    const raw = await readSecret(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Queue) : [];
  } catch {
    return [];
  }
}

async function save(queue: Queue): Promise<void> {
  await writeSecret(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  emit(queue.length);
}

export async function queuedCount(): Promise<number> {
  return (await load()).length;
}

export async function enqueueMessage(input: {
  roomId: number;
  body: string;
  replyTo?: number | null;
}): Promise<QueuedMessage> {
  const queue = await load();
  const clientTag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const entry: QueuedMessage = { clientTag, input: { ...input, clientTag }, queuedAt: Date.now() };
  await save([...queue, entry]);
  return entry;
}

export type SendFn = (input: QueuedMessage["input"]) => Promise<unknown>;

/** Replays every queued message in order; drops only ones the server confirms or rejects. */
export async function flushQueue(send: SendFn): Promise<{ sent: number; remaining: number }> {
  const queue = await load();
  if (!queue.length) return { sent: 0, remaining: 0 };
  const remaining: Queue = [];
  let sent = 0;
  for (const entry of queue) {
    try {
      await send(entry.input);
      sent += 1;
    } catch {
      remaining.push(entry);
    }
  }
  await save(remaining);
  return { sent, remaining: remaining.length };
}

let wired = false;

/** Hooks the queue to connectivity: flushes when the device comes back online. Call once at launch. */
export function wireOfflineFlush(send: SendFn): void {
  if (wired) return;
  wired = true;
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) void flushQueue(send);
  });
}
