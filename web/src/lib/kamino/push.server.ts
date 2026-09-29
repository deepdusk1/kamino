/**
 * Push notifications for the native apps (server-only).
 *
 * Phones register an Expo push token (see `registerPushToken` in `extras.ts`).
 * When Kamino creates an in-app notification we also send it to those devices
 * through Expo's free push service, which relays to Apple (APNs) and Google (FCM).
 *
 * Nothing here may ever throw into the caller: a push outage must not break
 * a like, a comment or a chat message.
 */
import type { Sql } from "@/lib/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH = 100;

export type PushPayload = { title: string; body: string; href: string };

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

/** Expo tokens look like ExponentPushToken[xxxx] (or the newer ExpoPushToken[xxxx]). */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

export async function sendPush(sql: Sql, userId: string, payload: PushPayload): Promise<void> {
  try {
    if (userId.startsWith("seed:")) return;
    const rows = await sql<{ token: string }>`select token from push_tokens where user_id = ${userId}`;
    const tokens = rows.map((r) => r.token).filter(isExpoPushToken);
    if (!tokens.length) return;

    for (let i = 0; i < tokens.length; i += MAX_BATCH) {
      const batch = tokens.slice(i, i + MAX_BATCH);
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            title: payload.title.slice(0, 80),
            body: payload.body.slice(0, 160),
            sound: "default",
            data: { href: payload.href },
          })),
        ),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { data?: ExpoTicket[] };
      // Drop tokens whose app was uninstalled so we stop sending to them.
      const dead = (json.data ?? [])
        .map((ticket, index) => (ticket.details?.error === "DeviceNotRegistered" ? batch[index] : null))
        .filter((token): token is string => Boolean(token));
      for (const token of dead) await sql`delete from push_tokens where token = ${token}`;
    }
  } catch (error) {
    console.warn("[push] delivery skipped:", error instanceof Error ? error.message : error);
  }
}
