/**
 * Kamino Bot API — lets automated accounts (e.g. the French teacher) read and
 * post messages through long-lived bearer tokens, without a user session.
 *
 * A bot is just a regular user account; the token maps to that account and the
 * bot can only act where its account is a member, under the same guards as a
 * human (rate limits, content review, mutes).
 */
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { randomBytes, createHash } from "node:crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import { guard } from "./guard";
import { scanText } from "./safety";
import { parseSticker } from "./stickers";
import { publishEvent } from "./events.server";
import { internals } from "./server";

const { db } = internals;
type Sql = Awaited<ReturnType<typeof internals.db>>;
type Authed = { userId: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Bot bearer auth: `Authorization: Bearer kamino_bot_<64 hex chars>`. */
export const botMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const ctx = context as unknown as { request?: Request };
    const header = ctx.request?.headers.get("authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token.startsWith("kamino_bot_") || token.length !== 11 + 64) {
      throw new Error("Unauthorized: bot token required.");
    }
    const sql = await db();
    const rows = await sql<{ user_id: string; id: number }>`
      select user_id, id from bot_tokens
      where token_hash = ${hashToken(token)} and revoked_at is null
    `;
    const row = rows[0];
    if (!row) throw new Error("Unauthorized: invalid bot token.");
    await sql`update bot_tokens set last_used_at = now() where id = ${row.id}`;
    return next({ context: { userId: String(row.user_id), botTokenId: row.id } });
  },
);

type BotAuthed = Authed & { botTokenId: number };

async function requireBotRoomAccess(sql: Sql, userId: string, roomId: number) {
  const rows = await sql<{ id: number }>`
    select r.id from chat_rooms r
    join chat_members m on m.room_id = r.id
    where r.id = ${roomId} and m.user_id = ${userId}
  `;
  if (!rows.length) throw new Error("Bot is not a member of this room.");
  return rows[0]!;
}

// ── Token management (regular user auth) ─────────────────────────────

export const createBotToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const name = String(data.name ?? "").trim().slice(0, 60) || "Unnamed bot";
    const token = `kamino_bot_${randomBytes(32).toString("hex")}`;
    const rows = await sql<{ id: number }>`
      insert into bot_tokens (user_id, name, token_hash)
      values (${userId}, ${name}, ${hashToken(token)})
      returning id
    `;
    // The plaintext token is shown exactly once — it is never stored.
    return { id: Number(rows[0]!.id), name, token };
  });

export const listBotTokens = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const rows = await sql<{
      id: number; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null;
    }>`select id, name, created_at, last_used_at, revoked_at from bot_tokens
       where user_id = ${userId} order by id desc`;
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
      revoked: !!r.revoked_at,
    }));
  });

export const revokeBotToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await sql`update bot_tokens set revoked_at = now()
      where id = ${id} and user_id = ${userId} and revoked_at is null`;
    return { ok: true };
  });

// ── Bot message API (bot bearer auth) ─────────────────────────────────

export const botGetRooms = createServerFn({ method: "GET" })
  .middleware([botMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as unknown as BotAuthed;
    const rows = await sql<{ id: number; name: string; kind: string }>`
      select r.id, r.name, r.kind from chat_rooms r
      join chat_members m on m.room_id = r.id
      where m.user_id = ${userId}
      order by r.id desc limit 100
    `;
    return rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? ""), kind: String(r.kind ?? "") }));
  });

export const botGetMessages = createServerFn({ method: "GET" })
  .middleware([botMiddleware])
  .validator((d: { roomId: number; sinceId?: number; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as unknown as BotAuthed;
    await requireBotRoomAccess(sql, userId, data.roomId);
    const sinceId = Number(data.sinceId ?? 0);
    const limit = Math.max(1, Math.min(100, Number(data.limit ?? 50)));
    const rows = await sql<{
      id: number; author_user_id: string; body: string; created_at: string; reply_to: number | null;
    }>`select m.id, m.author_user_id, m.body, m.created_at, m.reply_to
       from messages m
       where m.room_id = ${data.roomId} and m.id > ${sinceId} and m.held = false
       order by m.id asc limit ${limit}`;
    return rows.map((m) => ({
      id: Number(m.id),
      authorUserId: String(m.author_user_id),
      body: String(m.body ?? ""),
      createdAt: String(m.created_at),
      replyTo: m.reply_to == null ? null : Number(m.reply_to),
      fromBot: String(m.author_user_id) === userId,
    }));
  });

const loadServerInternals = createServerOnlyFn(() => import("./server"));
const loadSafety = createServerOnlyFn(() => import("./safety.server"));

export const botSendMessage = createServerFn({ method: "POST" })
  .middleware([botMiddleware])
  .validator((d: { roomId: number; body: string; replyTo?: number | null }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as unknown as BotAuthed;
    const server = await loadServerInternals();
    const safety = await loadSafety();
    const { requireMinAge, requireRoomAccess, assertNotMuted, notify } = server.internals;
    const { reviewContent } = safety;
    await guard(userId, "message");
    await requireMinAge(sql, userId);
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (room.community_id) await assertNotMuted(sql, userId, String(room.community_id));
    const body = String(data.body ?? "").trim().slice(0, 2000);
    if (!body) throw new Error("Write a message first.");
    if (!parseSticker(body)) {
      const err = scanText(body);
      if (err) throw new Error(err);
    }
    if (data.replyTo) {
      const ok = (await sql`select 1 from messages where id = ${data.replyTo} and room_id = ${data.roomId}`).length;
      if (!ok) throw new Error("Reply not found in this conversation.");
    }
    const rows = await sql<{ id: number }>`
      insert into messages (room_id, author_user_id, body, reply_to, held)
      values (${data.roomId}, ${userId}, ${body}, ${data.replyTo ?? null}, true)
      returning id
    `;
    const messageId = Number(rows[0]!.id);
    const { held } = await reviewContent(
      sql,
      {
        targetType: "message",
        targetId: messageId,
        authorId: userId,
        communityId: room.community_id ? String(room.community_id) : null,
        text: parseSticker(body) ? "" : body,
        images: [],
        href: `/chats/${data.roomId}`,
      },
      notify,
    );
    if (held) return { id: messageId, held };
    await sql`update messages set held = false where id = ${messageId}`;
    publishEvent({ type: "message", roomId: data.roomId, messageId });
    // Notify other members (no push to the bot itself).
    const others = await sql<{ user_id: string }>`
      select cm.user_id from chat_members cm
      where cm.room_id = ${data.roomId} and cm.user_id <> ${userId} and cm.muted = false`;
    const me = (await sql<{ display_name: string }>`select display_name from profiles where user_id = ${userId}`)[0];
    for (const o of others) {
      await notify(
        sql,
        String(o.user_id),
        "message",
        me?.display_name ?? "Bot",
        body.slice(0, 120),
        `/chats/${data.roomId}`,
        { actorId: userId, targetType: "room", targetId: data.roomId },
      );
    }
    return { id: messageId, held: false };
  });
