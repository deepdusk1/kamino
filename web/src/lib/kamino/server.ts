import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { hashHue, levelFromRep, slugify } from "@/lib/utils";
import { optionalAuth, type Viewer } from "./optional-auth";
import { ensureSeeded } from "./seed";
import { guard } from "./guard";
import { scanText, scanTitle, canLead, canModerate } from "./safety";
import { parseSticker } from "./stickers";
import { isAllowedCover, isAllowedTitleColor } from "./titles";
import {
  MAX_SHOWCASE,
  achievementStates,
  cleanShowcase,
  earnedIds,
  emptyMetrics,
  unlockMessage,
  type AchievementMetrics,
} from "./achievements";
import { parseWatchInput } from "./shelf";
import { extractHashtags } from "./hashtags";
import { saveDraftSchema, type CreatorDraft } from "./writing";
import { QUIZ_IMAGE_BASE, checkAlbum, checkQuestionImages, checkTimeLimit, isQuizLate, normalizeFolder } from "./albums";
import { deleteMedia, isMediaRef, loadMedia, storeMedia } from "./media-store.server";
import { BUBBLE_STYLES, COMMUNITY_MODULES, PROFILE_FRAME_IDS, THEME_STYLES, type CommunityModule } from "./types";
import { clampHue } from "./theme";
import { reviewContent } from "./safety.server";
import {
  mapCommunity,
  mapMembership,
  mapNote,
  mapPost,
  mapProfile,
  mapRoom,
  mapMessage,
  mapReport,
  mapCharacter,
  mapHallEvent,
  asBool,
  parseJson,
  iso,
} from "./map";
import type {
  Achievement,
  Broadcast,
  Character,
  ChatMessage,
  Community,
  HallEvent,
  InviteCode,
  JoinQuestion,
  MemberTitle,
  Membership,
  Post,
  PostPayload,
  PostType,
  RankRow,
  Role,
  RoomKind,
  SharedItem,
  ThemeStyle,
  Strike,
  TitleDef,
  WallPost,
} from "./types";

type Authed = { userId: string };

async function db(): Promise<Sql> {
  const sql = await getSql();
  await ensureSeeded(sql);
  return sql;
}

async function ensureProfile(
  sql: Sql,
  v: { userId: string; email: string | null; name: string | null },
) {
  const existing = await sql`select user_id from profiles where user_id = ${v.userId}`;
  if (existing.length) return;
  const base = slugify(v.name || v.email?.split("@")[0] || "member");
  let handle = base;
  let n = 0;
  while ((await sql`select 1 from profiles where handle = ${handle}`).length) {
    n += 1;
    handle = `${base.slice(0, 16)}${n}`;
  }
  await sql`
    insert into profiles (user_id, handle, display_name, avatar_hue)
    values (${v.userId}, ${handle}, ${v.name || handle}, ${hashHue(v.userId)})
    on conflict (user_id) do nothing
  `;
}

async function blockedSet(sql: Sql, userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await sql<{ blocked_id: string }>`
    select blocked_id from blocks where blocker_id = ${userId}
    union
    select blocker_id from blocks where blocked_id = ${userId}
  `;
  return new Set(
    rows
      .map((r) => r.blocked_id || (r as { blocker_id?: string }).blocker_id)
      .filter(Boolean) as string[],
  );
}

async function membershipOf(
  sql: Sql,
  userId: string | null,
  communityId: string,
): Promise<Membership | null> {
  if (!userId) return null;
  const rows =
    await sql`select * from memberships where user_id = ${userId} and community_id = ${communityId}`;
  return rows[0] ? mapMembership(rows[0]) : null;
}

/** New accounts must pass the 18+ birthday check (see `confirmMinimumAge`) before they take part. */
async function requireMinAge(sql: Sql, userId: string) {
  const row = (await sql`select min_age_confirmed_at from profiles where user_id = ${userId}`)[0];
  if (!row?.min_age_confirmed_at) throw new Error("Please confirm your age first (Kamino is for adults aged 18 and over).");
}

/**
 * The extra columns every events query needs (how many said yes, how many entries, the viewer's entry).
 * The query must pass the viewer's id (or "") as its SECOND parameter, `$2`.
 */
const EVENT_COUNTS = `(select count(*)::int from event_rsvps r where r.event_id = e.id) as rsvp_count,
          (select count(*)::int from challenge_entries ce where ce.event_id = e.id) as entry_count,
          (select ce.post_id from challenge_entries ce where ce.event_id = e.id and ce.user_id = $2) as my_entry_post_id`;

async function requireCommunity(sql: Sql, id: string) {
  const rows = await sql`select * from communities where id = ${id}`;
  if (!rows[0]) throw new Error("Community not found");
  return mapCommunity(rows[0]);
}

function canRead(community: Community, member: Membership | null): boolean {
  if (community.visibility === "public" || community.visibility === "unlisted") {
    if (member?.status === "banned") return false;
    return true;
  }
  return member?.status === "active";
}

const POST_SELECT = `
  p.*, m.nickname, m.persona_hue, pr.handle, pr.display_name, pr.avatar_hue, pr.avatar_version
`;
const POST_JOIN = `
  from posts p
  left join memberships m on m.user_id = p.author_user_id and m.community_id = p.community_id
  left join profiles pr on pr.user_id = p.author_user_id
`;

async function likedSet(sql: Sql, userId: string | null, ids: number[]): Promise<Set<number>> {
  if (!userId || !ids.length) return new Set();
  const rows = await sql<{ post_id: number }>`select post_id from likes where user_id = ${userId}`;
  const want = new Set(ids);
  return new Set(rows.map((r) => Number(r.post_id)).filter((id) => want.has(id)));
}

async function savedSet(sql: Sql, userId: string | null, ids: number[]): Promise<Set<number>> {
  if (!userId || !ids.length) return new Set();
  try {
    const rows = await sql<{
      post_id: number;
    }>`select post_id from favorites where user_id = ${userId}`;
    const want = new Set(ids);
    return new Set(rows.map((r) => Number(r.post_id)).filter((id) => want.has(id)));
  } catch {
    return new Set();
  }
}

async function addToOpenRooms(sql: Sql, userId: string, communityId: string) {
  const rooms = await sql<{ id: number }>`
    select id from chat_rooms where community_id = ${communityId} and kind in ('public','voice','screening')
  `;
  for (const r of rooms) {
    await sql`insert into chat_members (room_id, user_id) values (${r.id}, ${userId}) on conflict do nothing`;
  }
}

async function requirePostAccess(sql: Sql, userId: string | null, postId: number) {
  const row = (await sql`select * from posts where id = ${postId}`)[0];
  if (!row) throw new Error("Post not found.");
  const community = await requireCommunity(sql, String(row.community_id));
  const m = await membershipOf(sql, userId, community.id);
  if (
    !canRead(community, m) ||
    (row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()) ||
    (asBool(row.hidden) &&
      row.author_user_id !== userId &&
      !(m?.status === "active" && canModerate(m.role)))
  )
    throw new Error("This post is unavailable.");
  if ((await blockedSet(sql, userId)).has(String(row.author_user_id)))
    throw new Error("This post is unavailable.");
  return row;
}

async function requireRoomAccess(sql: Sql, userId: string, roomId: number) {
  const roomRow = (await sql`select * from chat_rooms where id = ${roomId}`)[0];
  if (!roomRow) throw new Error("Room not found");
  const inRoom =
    await sql`select 1 from chat_members where room_id = ${roomId} and user_id = ${userId}`;
  if (roomRow.community_id) await requireActiveMember(sql, userId, String(roomRow.community_id));
  if (String(roomRow.kind) === "dm") {
    const blocked = await blockedSet(sql, userId);
    const peers = await sql`select user_id from chat_members where room_id = ${roomId}`;
    if (peers.some((p) => blocked.has(String(p.user_id))))
      throw new Error("This conversation is unavailable.");
  }
  if (inRoom.length) return roomRow;
  const communityId = roomRow.community_id ? String(roomRow.community_id) : null;
  const kind = String(roomRow.kind);
  if (!communityId || kind === "dm" || kind === "private") {
    throw new Error("You are not in this room.");
  }
  const m = await membershipOf(sql, userId, communityId);
  if (m?.status !== "active") throw new Error("Join this community to chat.");
  await sql`insert into chat_members (room_id, user_id) values (${roomId}, ${userId}) on conflict do nothing`;
  return roomRow;
}

const REACTION_EMOJI = new Set(["❤️", "😂", "✨", "🔥", "👏", "😮"]);

async function withMessageReactions(
  sql: Sql,
  roomId: number,
  userId: string,
  messages: ChatMessage[],
) {
  if (!messages.length) return messages;
  const ids = new Set(messages.map((m) => m.id));
  const first = Math.min(...ids);
  const last = Math.max(...ids);
  const rows = await sql<{ message_id: number; user_id: string; emoji: string }>`
    select message_id, user_id, emoji from message_reactions
    where room_id = ${roomId} and message_id between ${first} and ${last}
  `;
  const grouped = new Map<number, Map<string, { emoji: string; count: number; mine: boolean }>>();
  for (const row of rows) {
    const id = Number(row.message_id);
    if (!ids.has(id)) continue;
    const reactions = grouped.get(id) ?? new Map();
    const reaction = reactions.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    reaction.count++;
    if (row.user_id === userId) reaction.mine = true;
    reactions.set(row.emoji, reaction);
    grouped.set(id, reactions);
  }
  return messages.map((m) => ({ ...m, reactions: [...(grouped.get(m.id)?.values() ?? [])] }));
}

function checkedChatMedia(media?: { kind: "image" | "audio" | "video"; dataUrl: string }) {
  if (!media) return null;
  if (media.dataUrl.length > 17_000_000) throw new Error("Attachment is too large.");
  const match =
    /^data:(image\/(?:png|jpeg|webp|gif)|audio\/(?:webm|ogg|mp4|mpeg)|video\/(?:webm|mp4|quicktime|3gpp))(?:;codecs=[a-z0-9.,-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
      media.dataUrl,
    );
  if (
    !match ||
    !(
      (media.kind === "image" && match[1]!.startsWith("image/")) ||
      (media.kind === "audio" && match[1]!.startsWith("audio/")) ||
      (media.kind === "video" && match[1]!.startsWith("video/"))
    )
  )
    throw new Error("Choose a supported photo, video or voice recording.");
  const bytes = Buffer.from(match[2]!, "base64").length;
  if (
    !bytes ||
    bytes > (media.kind === "image" ? 2_000_000 : media.kind === "video" ? 12_000_000 : 1_500_000)
  )
    throw new Error(
      media.kind === "image"
        ? "Photos must be under 2 MB."
        : media.kind === "video"
          ? "Videos must be under 12 MB."
          : "Voice notes must be under 1.5 MB.",
    );
  return media;
}

async function attachPeer(sql: Sql, row: Record<string, unknown>, userId: string) {
  if (String(row.kind) !== "dm") return mapRoom(row);
  const peer = (
    await sql<{ user_id: string; display_name: string; handle: string; avatar_hue: number; avatar_version: number }>`
      select p.user_id, p.display_name, p.handle, p.avatar_hue, p.avatar_version
      from chat_members cm
      join profiles p on p.user_id = cm.user_id
      where cm.room_id = ${Number(row.id)} and cm.user_id <> ${userId}
      limit 1
    `
  )[0];
  if (!peer) return mapRoom(row);
  return mapRoom({
    ...row,
    peer_name: peer.display_name,
    peer_handle: peer.handle,
    peer_hue: peer.avatar_hue,
    peer_avatar_v: peer.avatar_version,
    peer_user_id: peer.user_id,
  });
}

async function requireActiveMember(sql: Sql, userId: string, communityId: string) {
  const m = await membershipOf(sql, userId, communityId);
  if (m?.status !== "active") throw new Error("Join this community first.");
  return m;
}

const emptyLocked = {
  locked: true as const,
  posts: [] as Post[],
  stories: [] as Post[],
  rooms: [] as ReturnType<typeof mapRoom>[],
  members: [] as Membership[],
  followingIds: [] as string[],
  titleDefs: [] as TitleDef[],
  grantedTitles: [] as { userId: string; titles: MemberTitle[] }[],
  announcements: [] as Post[],
  events: [] as HallEvent[],
  broadcasts: [] as Broadcast[],
  joinQuestions: [] as JoinQuestion[],
};

async function notify(
  sql: Sql,
  userId: string,
  kind: string,
  title: string,
  body: string,
  href: string,
) {
  if (userId.startsWith("seed:")) return;
  try {
    const pref = (
      await sql`select notify_likes, notify_comments, notify_follows, notify_chat, notify_wall from profiles where user_id = ${userId}`
    )[0];
    if (pref) {
      const allow =
        (kind === "like" && asBool(pref.notify_likes)) ||
        (kind === "comment" && asBool(pref.notify_comments)) ||
        (kind === "follow" && asBool(pref.notify_follows)) ||
        (kind === "chat" && asBool(pref.notify_chat)) ||
        (kind === "wall" && asBool(pref.notify_wall)) ||
        !["like", "comment", "follow", "chat", "wall"].includes(kind);
      if (!allow) return;
    }
  } catch {
    // prefs columns may not exist yet
  }
  await sql`
    insert into notifications (user_id, kind, title, body, href)
    values (${userId}, ${kind}, ${title}, ${body}, ${href})
  `;
  // Phones get a push as well. Failures are swallowed inside: a broken push
  // service must never make a like, comment or message fail.
  const { sendPush } = await import("./push.server");
  void sendPush(sql, userId, { title, body, href });
}

/** Members serving a timed mute may read and react, but not write. */
async function assertNotMuted(sql: Sql, userId: string, communityId: string) {
  const rows = await sql<{ until: string }>`
    select until from member_mutes
    where community_id = ${communityId} and user_id = ${userId}
      and cleared = false and until > now()
    order by until desc limit 1
  `;
  if (rows[0]) {
    const until = new Date(String(rows[0].until)).toLocaleString("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    throw new Error(`You are muted in this community until ${until}. You can appeal from its page.`);
  }
}

async function loadMemberTitles(sql: Sql, userId: string): Promise<MemberTitle[]> {
  try {
    const rows = await sql`
      select mt.id, mt.title_id, mt.community_id, mt.pinned, mt.hidden,
             td.label, td.color, td.featured, coalesce(c.name, mt.community_id) as community_name
      from member_titles mt
      join title_defs td on td.id = mt.title_id
      left join communities c on c.id = mt.community_id
      where mt.user_id = ${userId}
      order by mt.pinned desc, td.featured desc, mt.id
    `;
    return rows.map((r) => ({
      id: Number(r.id),
      titleId: Number(r.title_id),
      label: String(r.label),
      color: String(r.color),
      communityId: String(r.community_id),
      communityName: String(r.community_name),
      featured: asBool(r.featured),
      pinned: asBool(r.pinned),
      hidden: asBool(r.hidden),
    }));
  } catch {
    return [];
  }
}

/** Everything the achievements count, for one person, in one round trip. */
async function achievementMetrics(sql: Sql, userId: string): Promise<AchievementMetrics> {
  const metrics = emptyMetrics();
  try {
    const row = (
      await sql.query(
        `select
          (select count(*)::int from posts where author_user_id = $1) as posts,
          (select count(*)::int from posts where author_user_id = $1 and type = 'image') as images,
          (select count(*)::int from posts where author_user_id = $1 and type = 'story') as stories,
          (select count(*)::int from posts where author_user_id = $1 and type = 'wiki' and wiki_status = 'approved') as wiki_approved,
          (select count(*)::int from posts where author_user_id = $1 and type = 'quiz') as quizzes_made,
          (select count(*)::int from posts where author_user_id = $1 and type = 'poll') as polls_made,
          (select count(*)::int from comments where author_user_id = $1 and held = false) as comments,
          (select count(*)::int from likes l join posts p on p.id = l.post_id where p.author_user_id = $1 and l.user_id <> $1) as likes_received,
          (select count(*)::int from profile_follows where followee_id = $1) as followers,
          greatest(
            coalesce((select streak from profiles where user_id = $1), 0),
            coalesce((select max(greatest(streak, best_streak)) from memberships where user_id = $1), 0)
          ) as streak,
          coalesce((select rep from profiles where user_id = $1), 0) as rep,
          (select count(*)::int from messages where author_user_id = $1 and deleted = false and held = false) as messages,
          (select count(*)::int from messages where author_user_id = $1 and deleted = false and body like '::sticker:%') as stickers,
          (select count(*)::int from message_reactions where user_id = $1) as reactions,
          (select count(*)::int from memberships where user_id = $1 and status = 'active') as communities,
          (select count(*)::int from memberships where user_id = $1 and status = 'active' and role in ('agent', 'leader')) as leading,
          (select count(*)::int from memberships where user_id = $1 and status = 'active' and role = 'curator') as curating,
          (select count(*)::int from quiz_attempts where user_id = $1) as quizzes_taken,
          (select count(*)::int from quiz_attempts where user_id = $1 and total > 0 and score = total) as perfect_quizzes,
          (select count(*)::int from poll_votes where user_id = $1) as poll_votes,
          (select count(*)::int from roleplay_turns where author_user_id = $1 and kind = 'turn' and held = false) as roleplay_turns,
          (select count(*)::int from roleplay_scenes where creator_id = $1 and held = false) as scenes_created,
          (select count(*)::int from event_rsvps where user_id = $1) as events,
          (select count(*)::int from challenge_entries where user_id = $1 and placement is not null) as challenge_wins,
          (select count(*)::int from wall_posts where author_user_id = $1 and held = false) as wall_notes,
          (select count(*)::int from favorites where user_id = $1) as saved,
          (select case when avatar_version > 0 and cover <> '' and length(trim(bio)) > 0 then 1 else 0 end from profiles where user_id = $1) as profile_complete,
          (select floor(extract(epoch from (now() - created_at)) / 86400)::int from profiles where user_id = $1) as account_days`,
        [userId],
      )
    )[0];
    if (row) {
      const n = (k: string) => Number(row[k] ?? 0) || 0;
      Object.assign(metrics, {
        posts: n("posts"), images: n("images"), stories: n("stories"), wikiApproved: n("wiki_approved"),
        quizzesMade: n("quizzes_made"), pollsMade: n("polls_made"), comments: n("comments"), likesReceived: n("likes_received"),
        followers: n("followers"), streak: n("streak"), rep: n("rep"), messages: n("messages"), stickers: n("stickers"),
        reactions: n("reactions"), communities: n("communities"), leading: n("leading"), curating: n("curating"),
        quizzesTaken: n("quizzes_taken"), perfectQuizzes: n("perfect_quizzes"), pollVotes: n("poll_votes"),
        roleplayTurns: n("roleplay_turns"), scenesCreated: n("scenes_created"), events: n("events"),
        challengeWins: n("challenge_wins"), wallNotes: n("wall_notes"), saved: n("saved"),
        profileComplete: n("profile_complete"), accountDays: n("account_days"),
      } satisfies AchievementMetrics);
    }
  } catch (error) {
    console.warn("[achievements] could not count:", error instanceof Error ? error.message : error);
  }
  return metrics;
}

/** A marker row: this person's achievements were recorded at least once (later unlocks are announced). */
const ACHIEVEMENTS_STARTED = "__started__";

/** When each person's achievements were last brought up to date (so busy screens do not recount every time). */
const lastAchievementSync = new Map<string, number>();

/**
 * Records newly earned achievements and tells the person once. The very first time (someone who used Kamino before
 * achievements existed) they are recorded quietly, so nobody gets a pile of notifications at once.
 */
async function syncAchievements(sql: Sql, userId: string, options: { force?: boolean } = {}) {
  const now = Date.now();
  if (!options.force && now - (lastAchievementSync.get(userId) ?? 0) < 60_000) return;
  lastAchievementSync.set(userId, now);
  try {
    const earned = earnedIds(await achievementMetrics(sql, userId));
    const known = new Set(
      (await sql<{ achievement_id: string }>`select achievement_id from user_achievements where user_id = ${userId}`).map((r) => r.achievement_id),
    );
    const fresh = earned.filter((id) => !known.has(id));
    // The first sync only records the "started" marker and what was already earned, without a notification.
    const firstTime = !known.has(ACHIEVEMENTS_STARTED);
    for (const id of firstTime ? [ACHIEVEMENTS_STARTED, ...fresh] : fresh)
      await sql`insert into user_achievements (user_id, achievement_id) values (${userId}, ${id}) on conflict do nothing`;
    const message = firstTime ? null : unlockMessage(fresh);
    if (message) {
      const handle = (await sql<{ handle: string }>`select handle from profiles where user_id = ${userId}`)[0]?.handle;
      await notify(sql, userId, "achievement", message.title, message.body, handle ? `/u/${handle}` : "/");
    }
  } catch (error) {
    console.warn("[achievements] could not sync:", error instanceof Error ? error.message : error);
  }
}

/** A person's achievements with progress, plus the ones they chose to show as banners. */
async function achievementsFor(sql: Sql, userId: string): Promise<{ achievements: Achievement[]; showcase: Achievement[] }> {
  const remembered = new Map(
    (await sql<{ achievement_id: string; unlocked_at: string }>`select achievement_id, unlocked_at from user_achievements where user_id = ${userId}`)
      .map((r) => [r.achievement_id, iso(r.unlocked_at)] as const),
  );
  const achievements = achievementStates(await achievementMetrics(sql, userId), remembered);
  const unlocked = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
  const chosen = cleanShowcase(
    parseJson<string[]>((await sql<{ showcase: string }>`select showcase from profiles where user_id = ${userId}`)[0]?.showcase, []),
    unlocked,
  );
  // Nothing chosen yet: show the three highest-tier achievements earned, so every profile has banners to show.
  const tierRank = { legend: 3, gold: 2, silver: 1, bronze: 0 } as const;
  const showcaseIds = chosen.length
    ? chosen
    : achievements
        .filter((a) => a.unlocked)
        .sort((x, y) => tierRank[y.tier] - tierRank[x.tier])
        .slice(0, MAX_SHOWCASE)
        .map((a) => a.id);
  const byId = new Map(achievements.map((a) => [a.id, a]));
  return { achievements, showcase: showcaseIds.map((id) => byId.get(id)!).filter(Boolean) };
}

export const bootstrap = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async ({ context }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    if (v.userId) {
      await ensureProfile(sql, { userId: v.userId, email: v.email, name: v.name });
      await syncAchievements(sql, v.userId);
      try {
        await sql`update profiles set last_seen_at = now() where user_id = ${v.userId}`;
      } catch {
        /* last_seen_at arrives with 0006 */
      }
    }
    const profile = v.userId
      ? (await sql`select * from profiles where user_id = ${v.userId}`)[0]
      : null;
    const unread = v.userId
      ? Number(
          (
            await sql<{
              n: number;
            }>`select count(*)::int as n from notifications where user_id = ${v.userId} and read = false`
          )[0]?.n ?? 0,
        )
      : 0;
    const joined = v.userId
      ? (
          await sql`
          select c.* from communities c
          join memberships m on m.community_id = c.id
          where m.user_id = ${v.userId} and m.status = 'active'
          order by m.joined_at desc
        `
        ).map(mapCommunity)
      : [];
    return {
      profile: profile ? mapProfile(profile) : null,
      unread,
      joined,
    };
  });

export const listDiscover = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async ({ context }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const rows = await sql`
      select * from communities
      where visibility = 'public'
      order by member_count desc, name
    `;
    let communities = rows.map(mapCommunity);
    if (v.userId) {
      const mine = await sql<{ community_id: string }>`
        select community_id from memberships where user_id = ${v.userId} and status in ('active','pending')
      `;
      const ids = new Set(mine.map((r) => r.community_id));
      const extra = await sql`
        select c.* from communities c
        join memberships m on m.community_id = c.id
        where m.user_id = ${v.userId} and m.status = 'active' and c.visibility <> 'public'
      `;
      communities = [...communities, ...extra.map(mapCommunity)];
      return { communities, joinedIds: [...ids] };
    }
    return { communities, joinedIds: [] as string[] };
  });

export const getCommunityPage = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((d: { slug: string; tab?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const community = await requireCommunity(sql, data.slug);
    const member = await membershipOf(sql, v.userId, community.id);
    if (!canRead(community, member)) {
      let joinQuestions: JoinQuestion[] = [];
      try {
        joinQuestions = (
          await sql`select * from join_questions where community_id = ${community.id} order by sort_order, id`
        ).map((r) => ({
          id: Number(r.id),
          communityId: String(r.community_id),
          prompt: String(r.prompt),
          sortOrder: Number(r.sort_order) || 0,
        }));
      } catch {
        joinQuestions = [];
      }
      return { community, member, ...emptyLocked, joinQuestions };
    }
    const blocked = await blockedSet(sql, v.userId);
    const followingRows = v.userId
      ? await sql<{ followee_id: string }>`
          select followee_id from follows where follower_id = ${v.userId} and community_id = ${community.id}
        `
      : [];
    const followIds = followingRows.map((r) => r.followee_id);
    const isMod = canModerate(member?.role);
    let raw: Record<string, unknown>[];
    try {
      raw = await sql.query(
        `select ${POST_SELECT} ${POST_JOIN}
         where p.community_id = $1
           and (p.expires_at is null or p.expires_at > now())
           and (coalesce(p.hidden, false) = false or p.author_user_id = $2 or $3)
         order by coalesce(p.announcement, false) desc, coalesce(p.pinned, false) desc, p.featured desc, p.created_at desc
         limit 80`,
        [community.id, v.userId ?? "", isMod],
      );
    } catch {
      raw = await sql.query(
        `select ${POST_SELECT} ${POST_JOIN}
         where p.community_id = $1
           and (p.expires_at is null or p.expires_at > now())
         order by p.featured desc, p.created_at desc
         limit 80`,
        [community.id],
      );
    }
    const ids = raw.map((r) => Number(r.id));
    const liked = await likedSet(sql, v.userId, ids);
    const saved = await savedSet(sql, v.userId, ids);
    let posts = raw
      .map((r) => mapPost(r, liked.has(Number(r.id)), saved.has(Number(r.id))))
      .filter((p) => !blocked.has(p.author.userId));
    if (data.tab === "featured") posts = posts.filter((p) => p.featured);
    if (data.tab === "following" && followIds.length) {
      posts = posts.filter((p) => followIds.includes(p.author.userId));
    } else if (data.tab === "following") {
      posts = [];
    }
    if (data.tab && data.tab.startsWith("#")) {
      const tag = data.tab.slice(1).toLowerCase();
      posts = posts.filter((p) => p.hashtags.includes(tag));
    }
    const stories = posts.filter((p) => p.type === "story");
    const announcements = posts.filter((p) => p.announcement && p.type !== "story");
    const feed = posts.filter((p) => p.type !== "story" && p.type !== "wiki" && !p.announcement);
    const rooms = (
      await sql.query(
        `select r.*,
            (select body from messages m where m.room_id = r.id and m.held = false order by m.id desc limit 1) as last_message,
            (select created_at from messages m where m.room_id = r.id and m.held = false order by m.id desc limit 1) as last_at,
            (select count(*)::int from chat_members cm where cm.room_id = r.id and cm.in_voice = true) as voice_count
         from chat_rooms r
         where r.community_id = $1
           and (r.kind <> 'private' or exists (
             select 1 from chat_members cm where cm.room_id = r.id and cm.user_id = $2
           ))
         order by r.id`,
        [community.id, v.userId ?? ""],
      )
    ).map(mapRoom);
    const members = (
      await sql`
        select m.*, pr.handle, pr.avatar_version from memberships m
        left join profiles pr on pr.user_id = m.user_id
        where m.community_id = ${community.id} and m.status = 'active'
        order by m.rep desc, case m.role when 'agent' then 0 when 'leader' then 1 when 'curator' then 2 else 3 end, m.joined_at
        limit 80
      `
    ).map(mapMembership);
    let titleDefs: TitleDef[] = [];
    let grantedTitles: { userId: string; titles: MemberTitle[] }[] = [];
    try {
      titleDefs = (
        await sql`select * from title_defs where community_id = ${community.id} order by featured desc, id`
      ).map((r) => ({
        id: Number(r.id),
        communityId: String(r.community_id),
        label: String(r.label),
        color: String(r.color),
        featured: asBool(r.featured),
      }));
      const granted = await sql`
        select mt.user_id, mt.id, mt.title_id, mt.community_id, mt.pinned, mt.hidden, td.label, td.color, td.featured
        from member_titles mt join title_defs td on td.id = mt.title_id
        where mt.community_id = ${community.id}
      `;
      const byUser = new Map<string, MemberTitle[]>();
      for (const r of granted) {
        const uid = String(r.user_id);
        const list = byUser.get(uid) ?? [];
        list.push({
          id: Number(r.id),
          titleId: Number(r.title_id),
          label: String(r.label),
          color: String(r.color),
          communityId: String(r.community_id),
          communityName: community.name,
          featured: asBool(r.featured),
          pinned: asBool(r.pinned),
          hidden: asBool(r.hidden),
        });
        byUser.set(uid, list);
      }
      grantedTitles = [...byUser.entries()].map(([userId, titles]) => ({ userId, titles }));
    } catch {
      titleDefs = [];
    }
    let events: HallEvent[] = [];
    let broadcasts: Broadcast[] = [];
    let joinQuestions: JoinQuestion[] = [];
    try {
      const eventRows = await sql.query(
        `select e.*, ${EVENT_COUNTS}
         from events e
         where e.community_id = $1 and (e.ends_at is null or e.ends_at > now())
         order by e.starts_at
         limit 12`,
        [community.id, v.userId ?? ""],
      );
      const goingIds = new Set<number>();
      if (v.userId && eventRows.length) {
        const mine = await sql<{ event_id: number }>`
          select event_id from event_rsvps where user_id = ${v.userId}
        `;
        for (const r of mine) goingIds.add(Number(r.event_id));
      }
      events = eventRows.map((r) => mapHallEvent(r, goingIds.has(Number(r.id))));
      broadcasts = (
        await sql`select id, community_id, body, created_at from broadcasts where community_id = ${community.id} order by id desc limit 5`
      ).map((r) => ({
        id: Number(r.id),
        communityId: String(r.community_id),
        body: String(r.body),
        createdAt: iso(r.created_at),
      }));
      joinQuestions = (
        await sql`select * from join_questions where community_id = ${community.id} order by sort_order, id`
      ).map((r) => ({
        id: Number(r.id),
        communityId: String(r.community_id),
        prompt: String(r.prompt),
        sortOrder: Number(r.sort_order) || 0,
      }));
    } catch {
      events = [];
      broadcasts = [];
      joinQuestions = [];
    }
    return {
      community,
      member,
      locked: false as const,
      posts: feed,
      stories,
      rooms,
      members,
      followingIds: followIds,
      titleDefs,
      grantedTitles,
      announcements,
      events,
      broadcasts,
      joinQuestions,
    };
  });

export const getWiki = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((slug: string) => slug)
  .handler(async ({ context, data: slug }) => {
    const sql = await db();
    const community = await requireCommunity(sql, slug);
    const member = await membershipOf(sql, (context as unknown as Viewer).userId, slug);
    if (!canRead(community, member))
      return { community, member, locked: true, entries: [] as Post[] };
    const userId = (context as unknown as Viewer).userId;
    const blocked = await blockedSet(sql, userId);
    const raw = await sql.query(
      `select ${POST_SELECT} ${POST_JOIN}
       where p.community_id = $1 and p.type = 'wiki' and p.hidden = false
         and (p.expires_at is null or p.expires_at > now())
       order by p.featured desc, p.title`,
      [slug],
    );
    const visible = raw.filter((r) => !blocked.has(String(r.author_user_id)));
    return { community, member, locked: false, entries: visible.map((r) => mapPost(r, false)) };
  });

export const submitWiki = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "post");
    const p = await requirePostAccess(sql, userId, data);
    if (p.type !== "wiki" || p.author_user_id !== userId)
      throw new Error("Submit one of your own wiki pages.");
    const m = await membershipOf(sql, userId, String(p.community_id));
    if (m?.status !== "active") throw new Error("Join the community to submit your wiki.");
    if (p.wiki_status === "approved") return { ok: true };
    await sql`update posts set wiki_status = 'pending', wiki_review_note = '' where id = ${data}`;
    return { ok: true };
  });

export const reviewWiki = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { postId: number; decision: "approved" | "rejected"; note?: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const p = await requirePostAccess(sql, userId, data.postId);
    const m = await membershipOf(sql, userId, String(p.community_id));
    if (m?.status !== "active" || !canModerate(m.role))
      throw new Error("Only community moderators can review wiki submissions.");
    if (p.type !== "wiki" || !["approved", "rejected"].includes(data.decision))
      throw new Error("Invalid wiki review.");
    const rows =
      await sql`update posts set wiki_status = ${data.decision}, wiki_review_note = ${(data.note ?? "").slice(0, 500)}
      where id = ${data.postId} and wiki_status = 'pending' returning id`;
    if (!rows.length)
      throw new Error("This wiki is no longer waiting for review. Refresh the library.");
    return { ok: true };
  });

export const copyWikiTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const source = await requirePostAccess(sql, userId, postId);
    if (source.type !== "wiki" || source.wiki_status !== "approved" || source.hidden)
      throw new Error("Only approved library pages can be used as templates.");
    await requireActiveMember(sql, userId, String(source.community_id));
    const title = `${String(source.title).slice(0, 105)} (copy)`;
    const payload = {
      ...(typeof source.payload === "string" ? JSON.parse(source.payload) : source.payload),
      templateSourceId: postId,
    };
    // A copy gets its own stored file, so deleting one page never removes the other's picture.
    const copyCover = isMediaRef(String(source.cover)) ? await storeMedia("post", await loadMedia(String(source.cover))) : source.cover;
    const rows = await sql<{ id: number }>`insert into posts
      (community_id, author_user_id, type, title, body, cover, payload, wiki_status, hashtags)
      values (${source.community_id}, ${userId}, 'wiki', ${title}, ${source.body}, ${copyCover},
        ${JSON.stringify(payload)}, 'draft', ${source.hashtags}) returning id`;
    return { id: Number(rows[0]!.id), slug: String(source.community_id) };
  });

export const toggleWikiProfilePin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const post = await requirePostAccess(sql, userId, postId);
    const community = await requireCommunity(sql, String(post.community_id));
    if (
      post.type !== "wiki" ||
      post.wiki_status !== "approved" ||
      community.visibility !== "public"
    )
      throw new Error("Only approved pages from public communities can appear on profiles.");
    const removed =
      await sql`delete from wiki_profile_pins where user_id = ${userId} and post_id = ${postId} returning post_id`;
    if (removed.length) return { pinned: false };
    const count = await sql<{
      n: number;
    }>`select count(*)::int as n from wiki_profile_pins where user_id = ${userId}`;
    if (Number(count[0]?.n ?? 0) >= 6) throw new Error("You can pin up to six wiki pages.");
    await sql`insert into wiki_profile_pins (user_id, post_id) values (${userId}, ${postId})`;
    return { pinned: true };
  });

export const listWikiRevisions = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => {
    const sql = await db();
    const post = await requirePostAccess(sql, (context as unknown as Viewer).userId, postId);
    if (post.type !== "wiki") throw new Error("This is not a wiki page.");
    const rows = await sql<{
      id: number;
      title: string;
      body: string;
      created_at: string;
      display_name: string | null;
    }>`select wr.id, wr.title, wr.body, wr.created_at, pr.display_name
       from wiki_revisions wr left join profiles pr on pr.user_id = wr.editor_user_id
       where wr.post_id = ${postId} order by wr.id desc limit 30`;
    return rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      body: r.body,
      createdAt: String(r.created_at),
      editor: r.display_name ?? "Member",
    }));
  });

export const restoreWikiRevision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { postId: number; revisionId: number }) => data)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const post = await requirePostAccess(sql, userId, data.postId);
    if (post.type !== "wiki" || post.author_user_id !== userId)
      throw new Error("Only this page's author can restore a revision.");
    await requireActiveMember(sql, userId, String(post.community_id));
    const revision = (
      await sql<{ title: string; body: string }>`select title, body from wiki_revisions
      where id = ${data.revisionId} and post_id = ${data.postId}`
    )[0];
    if (!revision) throw new Error("Revision not found.");
    await sql`insert into wiki_revisions (post_id, editor_user_id, title, body)
      values (${data.postId}, ${userId}, ${post.title}, ${post.body})`;
    await sql`update posts set title = ${revision.title}, body = ${revision.body}, edited_at = now(),
      wiki_status = case when wiki_status = 'approved' then 'pending' else wiki_status end
      where id = ${data.postId}`;
    return { ok: true };
  });

export const getPostPage = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((d: { slug: string; postId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const community = await requireCommunity(sql, data.slug);
    const member = await membershipOf(sql, v.userId, data.slug);
    if (!canRead(community, member)) throw new Error("This community is private.");
    const raw = await sql.query(
      `select ${POST_SELECT} ${POST_JOIN} where p.id = $1 and p.community_id = $2`,
      [data.postId, data.slug],
    );
    if (!raw[0]) throw new Error("Post not found");
    await requirePostAccess(sql, v.userId, data.postId);
    const liked = await likedSet(sql, v.userId, [data.postId]);
    const saved = await savedSet(sql, v.userId, [data.postId]);
    const post = mapPost(raw[0], liked.has(data.postId), saved.has(data.postId));
    const commentsRaw = await sql.query(
      `select c.*, m.nickname, m.persona_hue, pr.handle, pr.display_name, pr.avatar_hue, pr.avatar_version, c.author_user_id,
              (select count(*)::int from comment_likes cl where cl.comment_id = c.id) as like_count
       from comments c
       left join memberships m on m.user_id = c.author_user_id and m.community_id = $2
       left join profiles pr on pr.user_id = c.author_user_id
       where c.post_id = $1 and c.held = false
       order by c.id`,
      [data.postId, data.slug],
    );
    const wantComments = new Set(commentsRaw.map((r) => Number(r.id)));
    const likedCommentIds = new Set<number>();
    if (v.userId && wantComments.size) {
      const likedRows = await sql<{ comment_id: number }>`
        select comment_id from comment_likes where user_id = ${v.userId}
      `;
      for (const r of likedRows) {
        const id = Number(r.comment_id);
        if (wantComments.has(id)) likedCommentIds.add(id);
      }
    }
    const comments = commentsRaw.map((row) => ({
      id: Number(row.id),
      postId: Number(row.post_id),
      author: {
        userId: String(row.author_user_id),
        nickname: String(row.nickname || row.display_name || "Member"),
        handle: String(row.handle || "member"),
        hue: Number(row.persona_hue ?? row.avatar_hue) || 220,
        avatarV: Number(row.avatar_version) || 0,
      },
      body: String(row.body),
      likeCount: Number(row.like_count) || 0,
      liked: likedCommentIds.has(Number(row.id)),
      createdAt: String(row.created_at),
    }));
    let poll: { options: string[]; counts: number[]; mine: number | null } | null = null;
    if (post.type === "poll") {
      const options = (post.payload.options as string[]) ?? [];
      const votes = await sql<{ option_index: number; n: number }>`
        select option_index, count(*)::int as n from poll_votes where post_id = ${post.id} group by option_index
      `;
      const counts = options.map((_, i) => votes.find((x) => Number(x.option_index) === i)?.n ?? 0);
      const mine = v.userId
        ? ((
            await sql<{
              option_index: number;
            }>`select option_index from poll_votes where post_id = ${post.id} and user_id = ${v.userId}`
          )[0]?.option_index ?? null)
        : null;
      poll = { options, counts, mine: mine == null ? null : Number(mine) };
    }
    let quizBoard: { nickname: string; score: number; total: number; timeMs: number }[] = [];
    let myQuiz: { score: number; total: number } | null = null;
    let quizRun: { startedAt: string; serverNow: string } | null = null;
    if (post.type === "quiz") {
      quizBoard = (
        await sql.query(
          `select a.score, a.total, a.time_ms, coalesce(m.nickname, pr.display_name, 'Member') as nickname
           from quiz_attempts a
           left join memberships m on m.user_id = a.user_id and m.community_id = $2
           left join profiles pr on pr.user_id = a.user_id
           where a.post_id = $1
           order by a.score desc, a.time_ms asc
           limit 20`,
          [post.id, data.slug],
        )
      ).map((r) => ({
        nickname: String(r.nickname),
        score: Number(r.score),
        total: Number(r.total),
        timeMs: Number(r.time_ms),
      }));
      if (v.userId) {
        const mine =
          await sql`select score, total from quiz_attempts where post_id = ${post.id} and user_id = ${v.userId}`;
        if (mine[0]) myQuiz = { score: Number(mine[0].score), total: Number(mine[0].total) };
        else {
          // A quiz already started but not handed in (the page was closed, say): the clock keeps running.
          const run = await sql<{ started_at: string; server_now: string }>`
            select started_at, now() as server_now from quiz_starts where user_id = ${v.userId} and post_id = ${post.id}
          `;
          if (run[0])
            quizRun = {
              startedAt: new Date(run[0].started_at).toISOString(),
              serverNow: new Date(run[0].server_now).toISOString(),
            };
        }
      }
    }
    const wikiPinned =
      post.type === "wiki" && v.userId
        ? (
            await sql`select 1 from wiki_profile_pins where user_id = ${v.userId} and post_id = ${post.id}`
          ).length > 0
        : false;
    return { community, member, post, comments, poll, quizBoard, myQuiz, quizRun, wikiPinned };
  });

export const joinCommunity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; nickname?: string; answers?: string[]; invite?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await ensureProfile(sql, { userId, email: null, name: data.nickname ?? null });
    await requireMinAge(sql, userId);
    const community = await requireCommunity(sql, data.slug);
    const existing = await membershipOf(sql, userId, data.slug);
    if (existing?.status === "banned") throw new Error("You are banned from this community.");
    if (existing?.status === "active") return { ok: true, pending: false };
    if (existing?.status === "pending") return { ok: true, pending: true };
    const profile = mapProfile((await sql`select * from profiles where user_id = ${userId}`)[0]!);
    if (community.ageGate >= 16 && !profile.ageConfirmed) {
      throw new Error("Confirm you meet the age requirement in Settings first.");
    }
    let invited = false;
    const code = (data.invite ?? "").trim().toLowerCase();
    if (code) {
      try {
        const inv = (
          await sql<{ code: string; max_uses: number; uses: number; expires_at: unknown }>`
            select code, max_uses, uses, expires_at from invite_codes
            where code = ${code} and community_id = ${data.slug}
          `
        )[0];
        if (!inv) throw new Error("That invite code isn’t valid.");
        if (inv.expires_at && new Date(String(inv.expires_at)).getTime() < Date.now()) {
          throw new Error("That invite expired.");
        }
        if (Number(inv.max_uses) > 0 && Number(inv.uses) >= Number(inv.max_uses)) {
          throw new Error("That invite is used up.");
        }
        await sql`update invite_codes set uses = uses + 1 where code = ${code}`;
        invited = true;
      } catch (e) {
        if (e instanceof Error && e.message.includes("invite")) throw e;
      }
    }
    if (community.visibility === "private" && !invited) {
      try {
        const questions = await sql<{ prompt: string }>`
          select prompt from join_questions where community_id = ${data.slug} order by sort_order, id
        `;
        if (questions.length) {
          const answers = (data.answers ?? []).map((s) => s.trim()).filter(Boolean);
          if (answers.length < questions.length)
            throw new Error("Answer the join questions first.");
          await sql`
            insert into join_answers (user_id, community_id, answers)
            values (${userId}, ${data.slug}, ${JSON.stringify(answers)})
            on conflict (user_id, community_id) do update set answers = excluded.answers
          `;
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("join questions")) throw e;
      }
    }
    const nick = (data.nickname || profile.displayName).slice(0, 24);
    const pending = community.visibility === "private" && !invited;
    await sql`
      insert into memberships (user_id, community_id, role, status, nickname, persona_hue)
      values (${userId}, ${data.slug}, 'member', ${pending ? "pending" : "active"}, ${nick}, ${profile.avatarHue})
    `;
    if (!pending) {
      await sql`update communities set member_count = member_count + 1 where id = ${data.slug}`;
      const rooms = await sql<{
        id: number;
      }>`select id from chat_rooms where community_id = ${data.slug} and kind in ('public','voice','screening')`;
      for (const r of rooms) {
        await sql`insert into chat_members (room_id, user_id) values (${r.id}, ${userId}) on conflict do nothing`;
      }
    } else {
      await notify(
        sql,
        community.createdBy,
        "join",
        "Join request",
        `${nick} asked to enter ${community.name}`,
        `/c/${data.slug}/mod`,
      );
    }
    return { ok: true, pending };
  });

export const leaveCommunity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((slug: string) => slug)
  .handler(async ({ context, data: slug }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await membershipOf(sql, userId, slug);
    if (!m) return { ok: true };
    if (m.role === "agent") throw new Error("Transfer agent first, or archive the community.");
    await sql`delete from memberships where user_id = ${userId} and community_id = ${slug}`;
    if (m.status === "active") {
      await sql`update communities set member_count = greatest(member_count - 1, 0) where id = ${slug}`;
    }
    return { ok: true };
  });

export const updatePersona = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; nickname: string; personaBio: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const nick = data.nickname.trim().slice(0, 24);
    if (nick.length < 2) throw new Error("Nickname needs at least 2 characters.");
    await sql`
      update memberships set nickname = ${nick}, persona_bio = ${data.personaBio.slice(0, 280)}
      where user_id = ${userId} and community_id = ${data.slug} and status = 'active'
    `;
    return { ok: true };
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((slug: string) => slug)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const rows =
      await sql`select * from creator_drafts where user_id = ${userId} and community_id = ${data} order by updated_at desc`;
    return rows.map((r): CreatorDraft => ({
      id: String(r.id),
      slug: String(r.community_id),
      content: parseJson(r.content, {} as CreatorDraft["content"]),
      revision: Number(r.revision),
      updatedAt: iso(r.updated_at),
    }));
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => saveDraftSchema.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    if ((await membershipOf(sql, userId, data.slug))?.status !== "active")
      throw new Error("Join this community to save a draft.");
    const rows =
      data.revision === 0
        ? await sql`insert into creator_drafts (id, user_id, community_id, content)
          values (${data.id}, ${userId}, ${data.slug}, ${JSON.stringify(data.content)}) on conflict do nothing returning revision`
        : await sql`update creator_drafts set content = ${JSON.stringify(data.content)}, revision = revision + 1, updated_at = now()
          where id = ${data.id} and user_id = ${userId} and community_id = ${data.slug} and revision = ${data.revision} returning revision`;
    if (!rows.length)
      throw new Error("This draft changed in another tab. Save a copy to keep your changes.");
    return { id: data.id, revision: Number(rows[0]!.revision) };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; revision: number }) => data)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const rows =
      await sql`delete from creator_drafts where id = ${data.id} and user_id = ${userId} and revision = ${data.revision} returning id`;
    if (!rows.length)
      throw new Error("Draft unavailable or changed in another tab. Refresh your drafts.");
    return { ok: true };
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      slug: string;
      type: PostType;
      title: string;
      body: string;
      cover?: string;
      /** More pictures for an image post; `cover` is the first picture. */
      album?: string[];
      /** For quizzes: one picture (or "") per question. */
      questionImages?: string[];
      payload?: PostPayload;
      contentWarning?: string;
      featured?: boolean;
      commentsDisabled?: boolean;
      announcement?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "post");
    await requireMinAge(sql, userId);
    const m = await membershipOf(sql, userId, data.slug);
    if (m?.status !== "active") throw new Error("Join this community to post.");
    await assertNotMuted(sql, userId, data.slug);
    const err = scanText(`${data.title}\n${data.body}\n${data.payload?.url ?? ""}`);
    if (err) throw new Error(err);
    if (data.title.trim().length < 3) throw new Error("Give it a title.");
    if (data.type === "link") {
      const url = (data.payload?.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("Add a http(s) link.");
    }
    if (data.type === "poll") {
      const options = (data.payload?.options ?? []).map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) throw new Error("Polls need at least two options.");
    }
    if (!["blog", "image", "link", "question", "wiki", "poll", "quiz", "story"].includes(data.type))
      throw new Error("Choose a supported post type.");
    if (data.type === "quiz") {
      const questions = data.payload?.questions;
      if (
        !questions?.length ||
        questions.length > 30 ||
        questions.some(
          (q) =>
            !q.q?.trim() ||
            !Array.isArray(q.choices) ||
            q.choices.length < 2 ||
            q.choices.length > 6 ||
            q.choices.some((c) => !c.trim()) ||
            !Number.isInteger(q.answer) ||
            q.answer < 0 ||
            q.answer >= q.choices.length,
        )
      )
        throw new Error("Each quiz question needs choices and a correct answer.");
    }
    if (data.type === "wiki") {
      const chosen = (data.payload?.category ?? "").trim();
      const allowed = await sql<{ path: string }>`
        select path from wiki_categories where community_id = ${data.slug}`;
      if (allowed.length && chosen && !allowed.some((r) => r.path === chosen))
        throw new Error("Pick one of this community's wiki categories.");
    }
    const cover = data.cover ?? "";
    if (
      cover &&
      !(
        cover.startsWith("/covers/") ||
        cover.startsWith("https://") ||
        /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(cover)
      )
    )
      throw new Error("Use an image file or HTTPS image URL.");
    if (cover.length > 2800000) throw new Error("Choose an image under 2 MB.");
    const album = checkAlbum(data.album);
    if (album.length && data.type !== "image" && data.type !== "story")
      throw new Error("Only image posts and stories can have more than one picture.");
    if (album.length && !cover) throw new Error("Add a cover picture first; it is the first picture of the album.");
    // The number of extra pictures is set here, never taken from the client.
    const payload: PostPayload = { ...(data.payload ?? {}) };
    delete payload.albumCount;
    if (album.length) payload.albumCount = album.length;
    // Stories: one short caption per scene (the cover, then each extra picture). Empty ones stay empty.
    delete payload.captions;
    if (data.type === "story" && Array.isArray(data.payload?.captions)) {
      const captions = Array.from({ length: album.length + 1 }, (_, n) => {
        const text = data.payload?.captions?.[n];
        return typeof text === "string" ? text.trim().slice(0, 140) : "";
      });
      if (captions.some(Boolean)) payload.captions = captions;
    }
    // Quizzes: an optional time limit and a picture per question. The server decides what is kept.
    let quizPictures: string[] = [];
    delete payload.timeLimitSec;
    if (data.type === "quiz") {
      const questionCount = payload.questions?.length ?? 0;
      const limit = checkTimeLimit(data.payload?.timeLimitSec);
      if (limit) payload.timeLimitSec = limit;
      quizPictures = checkQuestionImages(data.questionImages, questionCount);
      payload.questions = payload.questions?.map((q, i) => {
        const { hasImage: _ignored, ...rest } = q;
        void _ignored;
        return quizPictures[i] ? { ...rest, hasImage: true } : rest;
      });
    } else if (data.questionImages?.length) {
      throw new Error("Only quizzes can have question pictures.");
    }
    const featured = Boolean(data.featured) && canModerate(m.role);
    // With object storage on, an uploaded cover picture goes to the bucket; links and built-in covers stay as they are.
    const storedCover = cover.startsWith("data:") ? await storeMedia("post", cover) : cover;
    const announcement = Boolean(data.announcement) && canLead(m.role);
    const expires =
      data.type === "story" ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null;
    const hashtags = extractHashtags(`${data.title}\n${data.body}`);
    const rows = await sql<{ id: number }>`
      insert into posts (community_id, author_user_id, type, title, body, cover, payload, featured, content_warning, expires_at, comments_disabled, announcement, hashtags)
      values (
        ${data.slug}, ${userId}, ${data.type}, ${data.title.trim().slice(0, 120)}, ${data.body.slice(0, 8000)},
        ${storedCover}, ${JSON.stringify(payload)}, ${featured}, ${data.contentWarning ?? ""}, ${expires},
        ${Boolean(data.commentsDisabled)}, ${announcement}, ${JSON.stringify(hashtags)}
      )
      returning id
    `;
    for (const [i, picture] of album.entries()) {
      const stored = await storeMedia("post", picture);
      await sql`insert into post_images (post_id, position, data_url) values (${rows[0]!.id}, ${i + 1}, ${stored})`;
    }
    for (const [i, picture] of quizPictures.entries()) {
      if (!picture) continue;
      const stored = await storeMedia("post", picture);
      await sql`insert into post_images (post_id, position, data_url) values (${rows[0]!.id}, ${QUIZ_IMAGE_BASE + i}, ${stored})`;
    }
    const postId = Number(rows[0]!.id);
    // Safety check (built-in rules, plus the AI when it is set up). A held post stays hidden until a moderator decides.
    const { held } = await reviewContent(
      sql,
      {
        targetType: "post",
        targetId: postId,
        authorId: userId,
        communityId: data.slug,
        text: `${data.title}\n${data.body}\n${(data.payload?.questions ?? []).map((q) => `${q.q} ${q.choices.join(" ")}`).join("\n")}\n${(data.payload?.options ?? []).join("\n")}\n${(data.payload?.captions ?? []).join("\n")}`,
        images: [cover, ...album, ...quizPictures].filter(Boolean),
        href: `/c/${data.slug}/p/${postId}`,
      },
      notify,
    );
    if (!held) {
      await sql`update memberships set rep = rep + 4 where user_id = ${userId} and community_id = ${data.slug}`;
      await sql`update profiles set rep = rep + 4 where user_id = ${userId}`;
    }
    return { id: postId, held };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requirePostAccess(sql, userId, postId);
    const exists = await sql`select 1 from likes where user_id = ${userId} and post_id = ${postId}`;
    if (exists.length) {
      await sql`delete from likes where user_id = ${userId} and post_id = ${postId}`;
      await sql`update posts set like_count = greatest(like_count - 1, 0) where id = ${postId}`;
      return { liked: false };
    }
    await sql`insert into likes (user_id, post_id) values (${userId}, ${postId})`;
    await sql`update posts set like_count = like_count + 1 where id = ${postId}`;
    const post = await sql<{ author_user_id: string; community_id: string; title: string }>`
      select author_user_id, community_id, title from posts where id = ${postId}
    `;
    if (post[0] && post[0].author_user_id !== userId) {
      await notify(
        sql,
        post[0].author_user_id,
        "like",
        "Liked your post",
        post[0].title,
        `/c/${post[0].community_id}/p/${postId}`,
      );
    }
    return { liked: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: number; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "comment");
    await requireMinAge(sql, userId);
    await requirePostAccess(sql, userId, data.postId);
    if (!data.body.trim()) throw new Error("Write a comment first.");
    const err = scanText(data.body);
    if (err) throw new Error(err);
    const post = await sql<{
      community_id: string;
      author_user_id: string;
      comments_disabled?: unknown;
    }>`
      select community_id, author_user_id, comments_disabled from posts where id = ${data.postId}
    `;
    if (!post[0]) throw new Error("Post not found");
    if (asBool(post[0].comments_disabled)) throw new Error("Comments are closed on this post.");
    const m = await membershipOf(sql, userId, post[0].community_id);
    if (m?.status !== "active") throw new Error("Join to comment.");
    await assertNotMuted(sql, userId, post[0].community_id);
    const inserted = await sql<{ id: number }>`insert into comments (post_id, author_user_id, body)
      values (${data.postId}, ${userId}, ${data.body.trim().slice(0, 2000)}) returning id`;
    const { held } = await reviewContent(
      sql,
      {
        targetType: "comment",
        targetId: Number(inserted[0]!.id),
        authorId: userId,
        communityId: post[0].community_id,
        text: data.body,
        href: `/c/${post[0].community_id}/p/${data.postId}`,
      },
      notify,
    );
    if (held) return { ok: true, held };
    await sql`update posts set comment_count = comment_count + 1 where id = ${data.postId}`;
    if (post[0].author_user_id !== userId) {
      await notify(
        sql,
        post[0].author_user_id,
        "comment",
        "New comment",
        data.body.slice(0, 80),
        `/c/${post[0].community_id}/p/${data.postId}`,
      );
    }
    return { ok: true, held };
  });

export const votePoll = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: number; optionIndex: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requirePostAccess(sql, userId, data.postId);
    const post = await sql<{
      community_id: string;
      type: string;
      payload: string;
    }>`select community_id, type, payload from posts where id = ${data.postId}`;
    if (!post[0]) throw new Error("Post not found");
    const options = parseJson<PostPayload>(post[0].payload, {}).options ?? [];
    if (
      post[0].type !== "poll" ||
      !Number.isInteger(data.optionIndex) ||
      data.optionIndex < 0 ||
      data.optionIndex >= options.length
    )
      throw new Error("Choose a valid poll option.");
    await requireActiveMember(sql, userId, post[0].community_id);
    await sql`
      insert into poll_votes (user_id, post_id, option_index)
      values (${userId}, ${data.postId}, ${data.optionIndex})
      on conflict (user_id, post_id) do update set option_index = ${data.optionIndex}
    `;
    return { ok: true };
  });

/** Loads a quiz the person may play (they must be an active member) and returns its questions and time limit. */
async function loadPlayableQuiz(sql: Awaited<ReturnType<typeof db>>, userId: string, postId: number) {
  await requirePostAccess(sql, userId, postId);
  const post = await sql<{
    payload: string;
    community_id: string;
  }>`select payload, community_id from posts where id = ${postId} and type = 'quiz'`;
  if (!post[0]) throw new Error("Quiz not found");
  await requireActiveMember(sql, userId, post[0].community_id);
  const payload = JSON.parse(post[0].payload || "{}") as {
    questions?: { answer: number }[];
    timeLimitSec?: number;
  };
  return {
    communityId: post[0].community_id,
    questions: payload.questions ?? [],
    timeLimitSec: checkTimeLimit(payload.timeLimitSec ?? 0),
  };
}

/**
 * Starts the clock on a quiz. The clock runs on the server, so a player cannot claim a faster time
 * (or extra time) by changing what their device sends. Safe to call again: the first start is kept.
 */
export const startQuiz = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const quiz = await loadPlayableQuiz(sql, userId, data.postId);
    if ((await sql`select 1 from quiz_attempts where user_id = ${userId} and post_id = ${data.postId}`).length)
      throw new Error("You already took this quiz.");
    await sql`
      insert into quiz_starts (user_id, post_id) values (${userId}, ${data.postId})
      on conflict (user_id, post_id) do nothing
    `;
    const row = (
      await sql<{ started_at: string; server_now: string }>`
        select started_at, now() as server_now from quiz_starts where user_id = ${userId} and post_id = ${data.postId}
      `
    )[0]!;
    return {
      startedAt: new Date(row.started_at).toISOString(),
      serverNow: new Date(row.server_now).toISOString(),
      timeLimitSec: quiz.timeLimitSec,
    };
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: number; answers: number[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const quiz = await loadPlayableQuiz(sql, userId, data.postId);
    if (!Array.isArray(data.answers)) throw new Error("Invalid quiz attempt.");
    const started = (
      await sql<{ elapsed_ms: number }>`
        select (extract(epoch from (now() - started_at)) * 1000)::float8 as elapsed_ms
        from quiz_starts where user_id = ${userId} and post_id = ${data.postId}
      `
    )[0];
    if (!started) throw new Error("Start the quiz first.");
    const elapsedMs = Math.max(0, Math.round(Number(started.elapsed_ms)));
    const timedOut = isQuizLate(quiz.timeLimitSec, elapsedMs);
    let score = 0;
    if (!timedOut)
      quiz.questions.forEach((q, i) => {
        if (data.answers[i] === q.answer) score += 1;
      });
    const attempt = await sql`
      insert into quiz_attempts (user_id, post_id, score, total, time_ms)
      values (${userId}, ${data.postId}, ${score}, ${quiz.questions.length}, ${elapsedMs})
      on conflict (user_id, post_id) do nothing returning post_id
    `;
    if (attempt.length)
      await sql`update memberships set rep = rep + ${score} where user_id = ${userId} and community_id = ${quiz.communityId}`;
    return { score, total: quiz.questions.length, timedOut };
  });

export const checkIn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const changed = await sql<{
      streak: number;
      rep: number;
    }>`update profiles set last_checkin_at=now(), streak=case when (last_checkin_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date-1 then streak+1 else 1 end,rep=rep+10 where user_id=${userId} and (last_checkin_at is null or (last_checkin_at at time zone 'UTC')::date<(now() at time zone 'UTC')::date) returning streak,rep`;
    if (changed.length) {
      await sql`
        with award as (
          insert into coin_ledger (to_user_id, kind, amount, reward_day)
          values (${userId}, 'checkin', 5, (now() at time zone 'UTC')::date)
          on conflict (to_user_id, kind, reward_day) do nothing
          returning amount
        )
        insert into coin_wallets (user_id, balance)
        select ${userId}, amount from award
        on conflict (user_id) do update set balance = coin_wallets.balance + excluded.balance
      `;
      return {
        already: false,
        streak: Number(changed[0].streak),
        rep: Number(changed[0].rep),
        coins: 5,
      };
    }
    const current = (
      await sql<{
        streak: number;
        rep: number;
      }>`select streak,rep from profiles where user_id=${userId}`
    )[0];
    if (!current) throw new Error("Open your profile first.");
    return { already: true, streak: Number(current.streak), rep: Number(current.rep), coins: 0 };
  });

export const getWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const wallet = (
      await sql<{ balance: number }>`select balance from coin_wallets where user_id = ${userId}`
    )[0];
    const history = await sql<{
      id: number;
      from_user_id: string | null;
      to_user_id: string;
      kind: string;
      amount: number;
      created_at: string;
      from_name: string | null;
      to_name: string;
    }>`
      select l.*, sender.display_name as from_name, receiver.display_name as to_name
      from coin_ledger l
      left join profiles sender on sender.user_id = l.from_user_id
      join profiles receiver on receiver.user_id = l.to_user_id
      where l.from_user_id = ${userId} or l.to_user_id = ${userId}
      order by l.id desc limit 50
    `;
    return {
      balance: Number(wallet?.balance ?? 0),
      history: history.map((entry) => ({
        id: Number(entry.id),
        kind: entry.kind as "checkin" | "tip",
        amount: Number(entry.amount),
        direction: entry.to_user_id === userId ? ("in" as const) : ("out" as const),
        otherName: entry.to_user_id === userId ? entry.from_name : entry.to_name,
        createdAt: iso(entry.created_at),
      })),
    };
  });

export const tipMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string; amount: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const amount = Number(data.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100)
      throw new Error("Choose 1–100 coins.");
    if (data.targetUserId === userId) throw new Error("You cannot tip yourself.");
    const recipient = (
      await sql<{
        display_name: string;
      }>`select display_name from profiles where user_id = ${data.targetUserId}`
    )[0];
    if (!recipient) throw new Error("Member not found.");
    if ((await blockedSet(sql, userId)).has(data.targetUserId))
      throw new Error("This member cannot receive your tip.");
    const transferred = await sql<{ id: number }>`
      with debit as (
        update coin_wallets set balance = balance - ${amount}
        where user_id = ${userId} and balance >= ${amount}
        returning user_id
      ), credit as (
        insert into coin_wallets (user_id, balance)
        select ${data.targetUserId}, ${amount} from debit
        on conflict (user_id) do update set balance = coin_wallets.balance + excluded.balance
        returning user_id
      )
      insert into coin_ledger (from_user_id, to_user_id, kind, amount)
      select ${userId}, user_id, 'tip', ${amount} from credit
      returning id
    `;
    if (!transferred.length) throw new Error("Not enough coins. Check in to earn more.");
    await notify(
      sql,
      data.targetUserId,
      "tip",
      "You received a coin tip",
      `${amount} coins from a member`,
      `/wallet`,
    );
    return { ok: true };
  });

export const followMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; userId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "follow");
    if (userId === data.userId) throw new Error("That’s you.");
    const exists = await sql`
      select 1 from follows where follower_id = ${userId} and followee_id = ${data.userId} and community_id = ${data.slug}
    `;
    if (exists.length) {
      await sql`delete from follows where follower_id = ${userId} and followee_id = ${data.userId} and community_id = ${data.slug}`;
      return { following: false };
    }
    await sql`
      insert into follows (follower_id, followee_id, community_id)
      values (${userId}, ${data.userId}, ${data.slug})
    `;
    return { following: true };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((targetId: string) => targetId)
  .handler(async ({ context, data: targetId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    if (userId === targetId) throw new Error("You cannot block yourself.");
    const exists =
      await sql`select 1 from blocks where blocker_id = ${userId} and blocked_id = ${targetId}`;
    if (exists.length) {
      await sql`delete from blocks where blocker_id = ${userId} and blocked_id = ${targetId}`;
      return { blocked: false };
    }
    await sql`insert into blocks (blocker_id, blocked_id) values (${userId}, ${targetId})`;
    return { blocked: true };
  });

export const fileReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      communityId?: string;
      targetType: string;
      targetId: string;
      reason: string;
      details?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "report");
    if (!data.reason) throw new Error("Pick a reason.");
    const dup = await sql`
      select 1 from reports
      where reporter_id = ${userId} and target_type = ${data.targetType} and target_id = ${data.targetId} and status = 'open'
    `;
    if (dup.length) throw new Error("You already reported this. A leader will review it.");
    await sql`
      insert into reports (reporter_id, community_id, target_type, target_id, reason, details)
      values (${userId}, ${data.communityId ?? null}, ${data.targetType}, ${data.targetId}, ${data.reason}, ${data.details ?? ""})
    `;
    if (data.communityId) {
      const leads = await sql<{ user_id: string }>`
        select user_id from memberships
        where community_id = ${data.communityId} and role in ('agent','leader') and status = 'active'
      `;
      for (const l of leads) {
        await notify(
          sql,
          l.user_id,
          "report",
          "New report",
          data.reason,
          `/c/${data.communityId}/mod`,
        );
      }
    }
    return { ok: true };
  });

export const listRooms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const rows = await sql.query(
      `select r.*,
          (select coalesce(nullif(m.body,''), case when mm.kind = 'image' then 'Photo' when mm.kind = 'audio' then 'Voice note' when mm.kind = 'video' then 'Video' end)
             from messages m left join message_media mm on mm.message_id = m.id
             where m.room_id = r.id and m.held = false order by m.id desc limit 1) as last_message,
          (select created_at from messages m where m.room_id = r.id and m.held = false order by m.id desc limit 1) as last_at,
          (select count(*)::int from chat_members cmv where cmv.room_id = r.id and cmv.in_voice = true) as voice_count,
          cm.pinned, cm.muted,
          (select count(*)::int from messages m where m.room_id = r.id and m.author_user_id <> $1 and m.held = false
            and m.created_at > coalesce(cm.last_read_at, to_timestamp(0))) as unread,
          case when r.kind = 'dm' then (
            select p.display_name from chat_members om
            join profiles p on p.user_id = om.user_id
            where om.room_id = r.id and om.user_id <> $1
            limit 1
          ) end as peer_name,
          case when r.kind = 'dm' then (
            select p.handle from chat_members om
            join profiles p on p.user_id = om.user_id
            where om.room_id = r.id and om.user_id <> $1
            limit 1
          ) end as peer_handle,
          case when r.kind = 'dm' then (
            select p.avatar_hue from chat_members om
            join profiles p on p.user_id = om.user_id
            where om.room_id = r.id and om.user_id <> $1
            limit 1
          ) end as peer_hue,
          case when r.kind = 'dm' then (
            select p.avatar_version from chat_members om
            join profiles p on p.user_id = om.user_id
            where om.room_id = r.id and om.user_id <> $1
            limit 1
          ) end as peer_avatar_v,
          case when r.kind = 'dm' then (
            select om.user_id from chat_members om
            where om.room_id = r.id and om.user_id <> $1
            limit 1
          ) end as peer_user_id
       from chat_rooms r
       join chat_members cm on cm.room_id = r.id
       where cm.user_id = $1 and (r.community_id is null or exists
         (select 1 from memberships mb where mb.community_id = r.community_id and mb.user_id = $1 and mb.status = 'active'))
       order by cm.pinned desc, last_at desc nulls last, r.id desc`,
      [userId],
    );
    return rows.map(mapRoom);
  });

export const getRoom = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; afterId?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const roomRow = await requireRoomAccess(sql, userId, data.roomId);
    const blocked = await blockedSet(sql, userId);
    const raw = await sql.query(
      `select m.*, mb.nickname, mb.persona_hue, pr.handle, pr.display_name, pr.avatar_hue, pr.avatar_version,
              coalesce(pr.bubble_hue, 270) as bubble_hue, coalesce(pr.bubble_style, 'soft') as bubble_style,
              mm.kind as media_kind
       from messages m
       left join chat_rooms r on r.id = m.room_id
       left join message_media mm on mm.message_id = m.id
       left join memberships mb on mb.user_id = m.author_user_id and mb.community_id = r.community_id
       left join profiles pr on pr.user_id = m.author_user_id
       where m.room_id = $1 and m.id > $2 and m.held = false
       order by m.id desc
       limit 200`,
      [data.roomId, data.afterId ?? 0],
    );
    const messages = await withMessageReactions(
      sql,
      data.roomId,
      userId,
      raw
        .reverse()
        .map(mapMessage)
        .filter((m) => !blocked.has(m.author.userId)),
    );
    const voices = await sql<{ user_id: string; nickname: string }>`
      select cm.user_id, coalesce(mb.nickname, pr.display_name, 'Member') as nickname
      from chat_members cm
      left join chat_rooms r on r.id = cm.room_id
      left join memberships mb on mb.user_id = cm.user_id and mb.community_id = r.community_id
      left join profiles pr on pr.user_id = cm.user_id
      where cm.room_id = ${data.roomId} and cm.in_voice = true
    `;
    await sql`update chat_members set last_read_at = now() where room_id = ${data.roomId} and user_id = ${userId}`;
    const pref = (
      await sql`select pinned, muted from chat_members where room_id = ${data.roomId} and user_id = ${userId}`
    )[0];
    const participants = await sql<{
      user_id: string;
      name: string;
      handle: string;
      is_cohost: boolean;
    }>`
      select cm.user_id, coalesce(nullif(mb.nickname, ''), pr.display_name, 'Member') as name,
             coalesce(pr.handle, '') as handle,
             exists(select 1 from room_cohosts rc where rc.room_id = cm.room_id and rc.user_id = cm.user_id) as is_cohost
      from chat_members cm
      left join memberships mb on mb.user_id = cm.user_id and mb.community_id = ${roomRow.community_id}
      left join profiles pr on pr.user_id = cm.user_id
      where cm.room_id = ${data.roomId}
      order by cm.user_id = ${roomRow.created_by} desc, name asc
    `;
    return {
      room: {
        ...(await attachPeer(sql, roomRow, userId)),
        pinned: asBool(pref?.pinned),
        muted: asBool(pref?.muted),
      },
      messages,
      voices,
      participants: participants.map((p) => ({
        userId: p.user_id,
        name: p.name,
        handle: p.handle,
        isHost: p.user_id === roomRow.created_by,
        isCohost: asBool(p.is_cohost),
      })),
    };
  });

export const inviteToRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; handle: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "invite");
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (room.kind !== "private" || !room.community_id)
      throw new Error("Invites are for private rooms.");
    const cohost =
      (await sql`select 1 from room_cohosts where room_id = ${data.roomId} and user_id = ${userId}`)
        .length > 0;
    if (room.invite_rule !== "members" && room.created_by !== userId && !cohost)
      throw new Error("Only room hosts can invite members.");
    const handle = data.handle.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_-]{2,30}$/.test(handle)) throw new Error("Enter a valid member handle.");
    const target = (
      await sql<{ user_id: string }>`select user_id from profiles where lower(handle) = ${handle}`
    )[0];
    if (!target) throw new Error("Member not found.");
    if (target.user_id === userId) throw new Error("You're already here.");
    await requireActiveMember(sql, target.user_id, String(room.community_id));
    if ((await blockedSet(sql, userId)).has(target.user_id))
      throw new Error("This member cannot be invited.");
    const inserted = await sql<{ user_id: string }>`
      insert into chat_members (room_id, user_id) values (${data.roomId}, ${target.user_id})
      on conflict do nothing returning user_id
    `;
    if (!inserted.length) throw new Error("This member is already in the room.");
    await notify(
      sql,
      target.user_id,
      "chat",
      "Private room invite",
      "You were invited to a room.",
      `/chats/${data.roomId}`,
    );
    return { ok: true };
  });

export const setRoomInviteRule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; rule: "hosts" | "members" }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (room.kind !== "private" || room.created_by !== userId)
      throw new Error("Only the room host can change invites.");
    if (data.rule !== "hosts" && data.rule !== "members") throw new Error("Invalid invite rule.");
    await sql`update chat_rooms set invite_rule = ${data.rule} where id = ${data.roomId}`;
    return { ok: true };
  });

export const toggleRoomCohost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; targetUserId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (room.kind !== "private" || room.created_by !== userId)
      throw new Error("Only the room host can choose cohosts.");
    if (data.targetUserId === userId) throw new Error("The host already manages this room.");
    const joined =
      await sql`select 1 from chat_members where room_id = ${data.roomId} and user_id = ${data.targetUserId}`;
    if (!joined.length) throw new Error("Choose a room member.");
    await requireActiveMember(sql, data.targetUserId, String(room.community_id));
    const current =
      await sql`select 1 from room_cohosts where room_id = ${data.roomId} and user_id = ${data.targetUserId}`;
    if (current.length) {
      await sql`delete from room_cohosts where room_id = ${data.roomId} and user_id = ${data.targetUserId}`;
      return { cohost: false };
    }
    const count = await sql<{
      count: number;
    }>`select count(*)::int as count from room_cohosts where room_id = ${data.roomId}`;
    if (Number(count[0]?.count) >= 3) throw new Error("A room can have up to three cohosts.");
    await sql`insert into room_cohosts (room_id, user_id) values (${data.roomId}, ${data.targetUserId}) on conflict do nothing`;
    return { cohost: true };
  });

export const transferRoomHost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; targetUserId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (room.kind !== "private" || room.created_by !== userId)
      throw new Error("Only the room host can hand over this room.");
    if (data.targetUserId === userId) throw new Error("You're already the host.");
    const joined =
      await sql`select 1 from chat_members where room_id = ${data.roomId} and user_id = ${data.targetUserId}`;
    if (!joined.length) throw new Error("Choose a room member.");
    await requireActiveMember(sql, data.targetUserId, String(room.community_id));
    const updated = await sql<{
      id: number;
    }>`update chat_rooms set created_by = ${data.targetUserId}
      where id = ${data.roomId} and created_by = ${userId} returning id`;
    if (!updated.length) throw new Error("Room host changed. Refresh and try again.");
    await sql`delete from room_cohosts where room_id = ${data.roomId} and user_id = ${data.targetUserId}`;
    await notify(
      sql,
      data.targetUserId,
      "chat",
      "You're the room host",
      "You can now manage this private room.",
      `/chats/${data.roomId}`,
    );
    return { ok: true };
  });

export const searchRoomMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { roomId: number; query: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    const query = data.query.trim().slice(0, 100);
    if (query.length < 2) return [] as ChatMessage[];
    const raw = await sql.query(
      `select m.*, mb.nickname, mb.persona_hue, pr.handle, pr.display_name, pr.avatar_hue, pr.avatar_version,
              coalesce(pr.bubble_hue, 270) as bubble_hue, coalesce(pr.bubble_style, 'soft') as bubble_style, mm.kind as media_kind
       from messages m
       left join chat_rooms r on r.id = m.room_id
       left join message_media mm on mm.message_id = m.id
       left join memberships mb on mb.user_id = m.author_user_id and mb.community_id = r.community_id
       left join profiles pr on pr.user_id = m.author_user_id
       where m.room_id = $1 and m.deleted = false and m.held = false and m.body ilike $2
       order by m.id desc limit 40`,
      [data.roomId, `%${query}%`],
    );
    const blocked = await blockedSet(sql, userId);
    return raw.map(mapMessage).filter((m) => !blocked.has(m.author.userId));
  });

export const getOlderMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; beforeId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    if (!Number.isSafeInteger(data.beforeId) || data.beforeId < 1) throw new Error("Invalid page.");
    const blocked = await blockedSet(sql, userId);
    const raw = await sql.query(
      `select m.*, mb.nickname, mb.persona_hue, pr.handle, pr.display_name, pr.avatar_hue, pr.avatar_version,
              coalesce(pr.bubble_hue, 270) as bubble_hue, coalesce(pr.bubble_style, 'soft') as bubble_style, mm.kind as media_kind
       from messages m left join chat_rooms r on r.id = m.room_id
       left join message_media mm on mm.message_id = m.id
       left join memberships mb on mb.user_id = m.author_user_id and mb.community_id = r.community_id
       left join profiles pr on pr.user_id = m.author_user_id
       where m.room_id = $1 and m.id < $2 and m.held = false order by m.id desc limit 50`,
      [data.roomId, data.beforeId],
    );
    const messages = await withMessageReactions(
      sql,
      data.roomId,
      userId,
      raw
        .reverse()
        .map(mapMessage)
        .filter((m) => !blocked.has(m.author.userId)),
    );
    return { messages, hasMore: raw.length === 50 };
  });

export const getMessageMedia = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; messageId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    const row = (
      await sql<{ data_url: string; kind: string; author_user_id: string; deleted: unknown; held: unknown }>`
      select mm.data_url, mm.kind, m.author_user_id, m.deleted, m.held
      from message_media mm join messages m on m.id = mm.message_id
      where mm.message_id = ${data.messageId} and mm.room_id = ${data.roomId}
    `
    )[0];
    if (!row || asBool(row.deleted) || asBool(row.held) || (await blockedSet(sql, userId)).has(row.author_user_id))
      throw new Error("Attachment unavailable.");
    return { kind: row.kind, dataUrl: await loadMedia(row.data_url) };
  });

export const toggleMessageReaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; messageId: number; emoji: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    if (!REACTION_EMOJI.has(data.emoji)) throw new Error("Choose a supported reaction.");
    const message = (
      await sql<{ author_user_id: string; deleted: unknown }>`
      select author_user_id, deleted from messages where id = ${data.messageId} and room_id = ${data.roomId}`
    )[0];
    if (
      !message ||
      asBool(message.deleted) ||
      (await blockedSet(sql, userId)).has(message.author_user_id)
    )
      throw new Error("Message unavailable.");
    const removed =
      await sql`delete from message_reactions where message_id = ${data.messageId} and user_id = ${userId} and emoji = ${data.emoji} returning message_id`;
    if (removed.length) return { reacted: false };
    await sql`insert into message_reactions (room_id, message_id, user_id, emoji)
      values (${data.roomId}, ${data.messageId}, ${userId}, ${data.emoji}) on conflict do nothing`;
    return { reacted: true };
  });

export const setRoomPreference = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; pinned?: boolean; muted?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    if (typeof data.pinned !== "boolean" && typeof data.muted !== "boolean")
      throw new Error("Choose a room setting.");
    await sql`update chat_members set pinned = coalesce(${data.pinned ?? null}, pinned),
      muted = coalesce(${data.muted ?? null}, muted) where room_id = ${data.roomId} and user_id = ${userId}`;
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      roomId: number;
      body: string;
      replyTo?: number | null;
      media?: { kind: "image" | "audio" | "video"; dataUrl: string };
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "message");
    await requireMinAge(sql, userId);
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (room.community_id) await assertNotMuted(sql, userId, String(room.community_id));
    const media = checkedChatMedia(data.media);
    const body = data.body.trim().slice(0, 2000);
    if (!body && !media) throw new Error("Write a message or attach media first.");
    if (
      data.replyTo &&
      !(await sql`select 1 from messages where id = ${data.replyTo} and room_id = ${data.roomId}`)
        .length
    )
      throw new Error("Reply not found in this conversation.");
    if (body && !parseSticker(body)) {
      const err = scanText(body);
      if (err) throw new Error(err);
    }
    const rows = await sql<{ id: number }>`
      insert into messages (room_id, author_user_id, body, reply_to)
      values (${data.roomId}, ${userId}, ${body}, ${data.replyTo ?? null})
      returning id
    `;
    if (media) {
      try {
        const stored = await storeMedia("chat", media.dataUrl);
        try {
          await sql`insert into message_media (message_id, room_id, kind, data_url)
            values (${rows[0]!.id}, ${data.roomId}, ${media.kind}, ${stored})`;
        } catch (error) {
          await deleteMedia([stored]);
          throw error;
        }
      } catch (error) {
        await sql`delete from messages where id = ${rows[0]!.id}`;
        throw error;
      }
    }
    const { held } = await reviewContent(
      sql,
      {
        targetType: "message",
        targetId: Number(rows[0]!.id),
        authorId: userId,
        communityId: room.community_id ? String(room.community_id) : null,
        text: parseSticker(body) ? "" : body,
        images: media?.kind === "image" ? [media.dataUrl] : [],
        href: `/chats/${data.roomId}`,
      },
      notify,
    );
    if (held) return { id: Number(rows[0]!.id), held };
    try {
      const room = (
        await sql<{
          kind: string;
          community_id: string | null;
        }>`select kind, community_id from chat_rooms where id = ${data.roomId}`
      )[0];
      if (room && String(room.kind) === "dm") {
        const others = await sql<{
          user_id: string;
        }>`select user_id from chat_members where room_id = ${data.roomId} and user_id <> ${userId} and muted = false`;
        const me = (
          await sql<{
            display_name: string;
          }>`select display_name from profiles where user_id = ${userId}`
        )[0];
        for (const o of others) {
          await notify(
            sql,
            o.user_id,
            "chat",
            me?.display_name ?? "DM",
            (
              body ||
              (media?.kind === "image" ? "Photo" : media?.kind === "video" ? "Video" : "Voice note")
            ).slice(0, 80),
            `/chats/${data.roomId}`,
          );
        }
      }
    } catch {
      /* */
    }
    return { id: Number(rows[0]!.id), held };
  });

export const toggleVoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: number | { roomId: number; on?: boolean }) =>
    typeof d === "number" ? { roomId: d } : d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    const row = (
      await sql`select in_voice from chat_members where room_id = ${data.roomId} and user_id = ${userId}`
    )[0];
    if (!row) throw new Error("Join the room first.");
    const next = data.on == null ? !asBool(row.in_voice) : Boolean(data.on);
    await sql`update chat_members set in_voice = ${next} where room_id = ${data.roomId} and user_id = ${userId}`;
    return { inVoice: next };
  });

export const openDm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((targetId: string) => targetId)
  .handler(async ({ context, data: targetId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "invite");
    await requireMinAge(sql, userId);
    if (userId === targetId) throw new Error("That’s you.");
    const blocked = await sql`
      select 1 from blocks
      where (blocker_id = ${userId} and blocked_id = ${targetId})
         or (blocker_id = ${targetId} and blocked_id = ${userId})
    `;
    if (blocked.length) throw new Error("You can’t message this person.");
    const target = (
      await sql`select dm_privacy, display_name from profiles where user_id = ${targetId}`
    )[0];
    if (!target) throw new Error("Profile not found");
    if (String(target.dm_privacy) === "none") throw new Error("This member has DMs closed.");
    if (String(target.dm_privacy) === "members") {
      const shared = await sql`
        select 1 from memberships a
        join memberships b on a.community_id = b.community_id
        where a.user_id = ${userId} and b.user_id = ${targetId}
          and a.status = 'active' and b.status = 'active'
        limit 1
      `;
      if (!shared.length) throw new Error("DMs are limited to people who share a community.");
    }
    const [a, b] = userId < targetId ? [userId, targetId] : [targetId, userId];
    const name = `dm:${a}:${b}`;
    const existing = await sql<{
      id: number;
    }>`select id from chat_rooms where kind = 'dm' and name = ${name}`;
    let roomId = existing[0]?.id;
    if (!roomId) {
      const created = await sql<{ id: number }>`
        insert into chat_rooms (community_id, name, kind, created_by)
        values (null, ${name}, 'dm', ${userId})
        returning id
      `;
      roomId = created[0]!.id;
      await sql`insert into chat_members (room_id, user_id) values (${roomId}, ${userId}) on conflict do nothing`;
      await sql`insert into chat_members (room_id, user_id) values (${roomId}, ${targetId}) on conflict do nothing`;
    }
    return { roomId: Number(roomId) };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const rows = await sql`
      select * from notifications where user_id = ${userId} order by id desc limit 50
    `;
    return rows.map(mapNote);
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await sql`update notifications set read = true where user_id = ${userId}`;
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await ensureProfile(sql, { userId, email: null, name: null });
    await syncAchievements(sql, userId);
    const profile = mapProfile((await sql`select * from profiles where user_id = ${userId}`)[0]!);
    const joined = (
      await sql`
        select c.*, m.nickname, m.role, m.persona_hue, m.rep as persona_rep
        from memberships m
        join communities c on c.id = m.community_id
        where m.user_id = ${userId} and m.status = 'active'
        order by m.joined_at desc
      `
    ).map((row) => ({
      community: mapCommunity(row),
      nickname: String(row.nickname),
      role: String(row.role) as Role,
      hue: Number(row.persona_hue),
      rep: Number(row.persona_rep),
    }));
    const blocked = await sql<{ blocked_id: string; display_name: string; handle: string }>`
      select b.blocked_id, coalesce(p.display_name, 'Member') as display_name, coalesce(p.handle, 'member') as handle
      from blocks b
      left join profiles p on p.user_id = b.blocked_id
      where b.blocker_id = ${userId}
    `;
    return { profile, joined, blocked };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (
      d: Partial<{
        displayName: string;
        bio: string;
        dmPrivacy: string;
        hideJoined: boolean;
        showOnline: boolean;
        ageConfirmed: boolean;
        cover: string;
        mood: string;
        status: string;
        frame: string;
        bubbleHue: number;
        bubbleStyle: string;
        notifyLikes: boolean;
        notifyComments: boolean;
        notifyFollows: boolean;
        notifyChat: boolean;
        notifyWall: boolean;
      }>,
    ) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const cur = mapProfile((await sql`select * from profiles where user_id = ${userId}`)[0]!);
    const displayName =
      (data.displayName ?? cur.displayName).trim().slice(0, 40) || cur.displayName;
    const bio = (data.bio ?? cur.bio).slice(0, 280);
    const dmPrivacy = data.dmPrivacy ?? cur.dmPrivacy;
    const hideJoined = data.hideJoined ?? cur.hideJoined;
    const showOnline = data.showOnline ?? cur.showOnline;
    const ageConfirmed = data.ageConfirmed ?? cur.ageConfirmed;
    const cover = data.cover != null && isAllowedCover(data.cover) ? data.cover : cur.cover;
    // Switching to a built-in banner (or none) replaces an uploaded wall cover, so its file is removed.
    if (data.cover != null && isAllowedCover(data.cover)) {
      const gone = await sql<{ data_url: string }>`delete from profile_covers where user_id = ${userId} returning data_url`;
      await deleteMedia(gone.map((r) => r.data_url));
    }
    const mood = (data.mood ?? cur.mood).trim().slice(0, 32);
    const status = (data.status ?? cur.status).trim().slice(0, 80);
    const frame =
      data.frame && (PROFILE_FRAME_IDS as readonly string[]).includes(data.frame)
        ? data.frame
        : cur.frame;
    const bubbleStyle =
      data.bubbleStyle && (BUBBLE_STYLES as readonly string[]).includes(data.bubbleStyle)
        ? data.bubbleStyle
        : cur.bubbleStyle;
    const bubbleHue = Number.isFinite(data.bubbleHue)
      ? Math.max(0, Math.min(360, Number(data.bubbleHue)))
      : cur.bubbleHue;
    const notifyLikes = data.notifyLikes ?? cur.notifyLikes;
    const notifyComments = data.notifyComments ?? cur.notifyComments;
    const notifyFollows = data.notifyFollows ?? cur.notifyFollows;
    const notifyChat = data.notifyChat ?? cur.notifyChat;
    const notifyWall = data.notifyWall ?? cur.notifyWall;
    await sql`
      update profiles
      set display_name = ${displayName},
          bio = ${bio},
          dm_privacy = ${dmPrivacy},
          hide_joined = ${hideJoined},
          show_online = ${showOnline},
          age_confirmed = ${ageConfirmed},
          cover = ${cover},
          mood = ${mood},
          status = ${status},
          frame = ${frame},
          bubble_hue = ${bubbleHue},
          bubble_style = ${bubbleStyle},
          notify_likes = ${notifyLikes},
          notify_comments = ${notifyComments},
          notify_follows = ${notifyFollows},
          notify_chat = ${notifyChat},
          notify_wall = ${notifyWall}
      where user_id = ${userId}
    `;
    return { ok: true };
  });

/** For the data export: swaps stored-file references for the files themselves, so the archive is complete. */
async function resolveField<T extends Record<string, unknown>>(rows: T[], field: string): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      const value = row[field];
      if (typeof value !== "string" || !isMediaRef(value)) return row;
      try {
        return { ...row, [field]: await loadMedia(value) };
      } catch {
        return { ...row, [field]: "" }; // a file that is gone from storage is left out rather than failing the whole export
      }
    }),
  );
}

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const profile = (await sql`select * from profiles where user_id = ${userId}`)[0] ?? null;
    const memberships = await sql`select * from memberships where user_id = ${userId}`;
    const posts = await resolveField(await sql`select * from posts where author_user_id = ${userId}`, "cover");
    const comments = await sql`select * from comments where author_user_id = ${userId}`;
    const characters = await sql`select * from characters where user_id = ${userId}`;
    const drafts = await sql`select * from creator_drafts where user_id = ${userId}`;
    const messages =
      await sql`select * from messages where author_user_id = ${userId} and deleted = false`;
    const messageMedia = await resolveField(
      await sql`select mm.* from message_media mm
      join messages m on m.id = mm.message_id
      where m.author_user_id = ${userId} and m.deleted = false`,
      "data_url",
    );
    const wikiRevisions = await sql`select wr.* from wiki_revisions wr
      join posts p on p.id = wr.post_id where p.author_user_id = ${userId}`;
    const wikiProfilePins = await sql`select * from wiki_profile_pins where user_id = ${userId}`;
    const wallPosts = await sql`select * from wall_posts where author_user_id = ${userId}`;
    const sharedItems = await sql`select * from shared_items where author_user_id = ${userId}`;
    const postImages = await resolveField(
      await sql`select pi.* from post_images pi
      join posts p on p.id = pi.post_id where p.author_user_id = ${userId} order by pi.post_id, pi.position`,
      "data_url",
    );
    const savedPosts =
      await sql`select post_id, created_at from favorites where user_id = ${userId}`;
    return {
      json: JSON.stringify({
        exportedAt: new Date().toISOString(),
        formatVersion: 4,
        profile,
        memberships,
        posts,
        comments,
        characters,
        drafts,
        messages,
        messageMedia,
        wikiRevisions,
        wikiProfilePins,
        wallPosts,
        sharedItems,
        postImages,
        savedPosts,
      }),
    };
  });

export const getPublicProfile = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((handle: string) => handle)
  .handler(async ({ context, data: handle }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const row = (
      await sql`select * from profiles where handle = ${handle} or user_id = ${handle}`
    )[0];
    if (!row) throw new Error("No one by that name.");
    const profile = mapProfile(row);
    const blocked = v.userId
      ? (
          await sql`select 1 from blocks where blocker_id = ${v.userId} and blocked_id = ${profile.userId}`
        ).length > 0
      : false;
    const joined = profile.hideJoined
      ? []
      : (
          await sql`
            select c.id, c.name, c.cover, c.category, m.nickname, m.role
            from memberships m join communities c on c.id = m.community_id
            where m.user_id = ${profile.userId} and m.status = 'active' and c.visibility = 'public'
            order by m.joined_at desc
          `
        ).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          cover: String(r.cover),
          category: String(r.category),
          nickname: String(r.nickname),
          role: String(r.role),
        }));
    const recentRows = await sql.query(
      `select ${POST_SELECT} ${POST_JOIN}
         join communities com on com.id = p.community_id
         where p.author_user_id = $1 and com.visibility = 'public'
           and coalesce(p.hidden,false) = false and (p.expires_at is null or p.expires_at > now())
         order by p.created_at desc limit 12`,
      [profile.userId],
    );
    const recentIds = recentRows.map((r) => Number(r.id));
    const recentLikes = await likedSet(sql, v.userId, recentIds);
    const recentSaved = await savedSet(sql, v.userId, recentIds);
    const recentBlocked = await blockedSet(sql, v.userId);
    const recentBanned = new Set(
      v.userId
        ? (
            await sql`select community_id from memberships where user_id = ${v.userId} and status = 'banned'`
          ).map((r) => String(r.community_id))
        : [],
    );
    const recent = recentRows
      .map((r) => mapPost(r, recentLikes.has(Number(r.id)), recentSaved.has(Number(r.id))))
      .filter((p) => !recentBlocked.has(p.author.userId) && !recentBanned.has(p.communityId));
    const pinRows = await sql.query(
      `select ${POST_SELECT} ${POST_JOIN}
         join communities com on com.id = p.community_id
         join wiki_profile_pins wp on wp.post_id = p.id
         where wp.user_id = $1 and p.type = 'wiki' and p.wiki_status = 'approved'
           and coalesce(p.hidden,false) = false and com.visibility = 'public'
         order by wp.created_at desc limit 6`,
      [profile.userId],
    );
    const pinnedWiki = pinRows
      .map((r) => mapPost(r, false))
      .filter((p) => !recentBlocked.has(p.author.userId) && !recentBanned.has(p.communityId));
    let characters: Character[] = [];
    try {
      characters = (
        await sql`select * from characters where user_id = ${profile.userId} order by id`
      ).map(mapCharacter);
    } catch {
      characters = [];
    }
    const titles = (await loadMemberTitles(sql, profile.userId)).filter((t) =>
      v.userId === profile.userId ? true : !t.hidden,
    );
    const featuredTitle =
      titles.find((t) => t.pinned && !t.hidden) ??
      titles.find((t) => t.featured && !t.hidden) ??
      titles.find((t) => !t.hidden) ??
      null;
    let followers = 0;
    let following = 0;
    let viewerFollows = false;
    let wall: WallPost[] = [];
    try {
      followers = Number(
        (
          await sql<{
            n: number;
          }>`select count(*)::int as n from profile_follows where followee_id = ${profile.userId}`
        )[0]?.n ?? 0,
      );
      following = Number(
        (
          await sql<{
            n: number;
          }>`select count(*)::int as n from profile_follows where follower_id = ${profile.userId}`
        )[0]?.n ?? 0,
      );
      if (v.userId) {
        viewerFollows =
          (
            await sql`select 1 from profile_follows where follower_id = ${v.userId} and followee_id = ${profile.userId}`
          ).length > 0;
      }
      const wallRaw = await sql.query(
        `select w.id, w.body, w.created_at, w.author_user_id,
                coalesce(pr.display_name, 'Member') as nickname, coalesce(pr.handle, 'member') as handle,
                coalesce(pr.avatar_hue, 220) as hue, coalesce(pr.avatar_version, 0) as avatar_v,
                (select count(*)::int from wall_likes wl where wl.wall_post_id = w.id) as like_count
         from wall_posts w
         left join profiles pr on pr.user_id = w.author_user_id
         where w.profile_user_id = $1 and w.held = false
         order by w.id desc
         limit 40`,
        [profile.userId],
      );
      const wallIds = wallRaw.map((r) => Number(r.id));
      const likedWall = new Set<number>();
      if (v.userId && wallIds.length) {
        try {
          const likedRows = await sql<{ wall_post_id: number }>`
            select wall_post_id from wall_likes where user_id = ${v.userId}
          `;
          for (const r of likedRows) {
            const id = Number(r.wall_post_id);
            if (wallIds.includes(id)) likedWall.add(id);
          }
        } catch {
          /* wall_likes arrives with 0006 */
        }
      }
      wall = wallRaw.map((r) => ({
        id: Number(r.id),
        body: String(r.body),
        createdAt: String(r.created_at),
        likeCount: Number(r.like_count) || 0,
        liked: likedWall.has(Number(r.id)),
        author: {
          userId: String(r.author_user_id),
          nickname: String(r.nickname),
          handle: String(r.handle),
          hue: Number(r.hue) || 220,
          avatarV: Number(r.avatar_v) || 0,
        },
      }));
    } catch {
      wall = [];
    }
    if (v.userId === profile.userId) await syncAchievements(sql, profile.userId, { force: true });
    const { achievements, showcase } = await achievementsFor(sql, profile.userId);
    return {
      profile,
      joined,
      recent,
      pinnedWiki,
      blocked,
      isSelf: v.userId === profile.userId,
      characters,
      titles,
      featuredTitle,
      achievements,
      showcase,
      stats: { reputation: profile.rep, following, followers },
      viewerFollows,
      wall,
    };
  });

/** Chooses up to three unlocked achievements to show as banners at the top of your profile (empty list = automatic). */
export const setShowcase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ids: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const { achievements } = await achievementsFor(sql, userId);
    const unlocked = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
    const ids = cleanShowcase(data.ids, unlocked);
    if (Array.isArray(data.ids) && data.ids.length && ids.length !== Math.min(new Set(data.ids).size, MAX_SHOWCASE))
      throw new Error("You can only show achievements you have unlocked (up to three).");
    await sql`update profiles set showcase = ${JSON.stringify(ids)} where user_id = ${userId}`;
    return { ids };
  });

export const createCommunity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      name: string;
      tagline: string;
      description: string;
      category: string;
      visibility: "public" | "private" | "unlisted";
      ageGate: number;
      rules: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "community");
    await requireMinAge(sql, userId);
    await ensureProfile(sql, { userId, email: null, name: null });
    const name = data.name.trim().slice(0, 40);
    if (name.length < 3) throw new Error("Name needs at least 3 characters.");
    let id = slugify(name);
    let n = 0;
    while ((await sql`select 1 from communities where id = ${id}`).length) {
      n += 1;
      id = `${slugify(name).slice(0, 24)}-${n}`;
    }
    const profile = mapProfile((await sql`select * from profiles where user_id = ${userId}`)[0]!);
    await sql`
      insert into communities (id, name, tagline, description, category, cover, hue, visibility, age_gate, rules, created_by, member_count)
      values (
        ${id}, ${name}, ${data.tagline.slice(0, 80)}, ${data.description.slice(0, 800)},
        ${data.category}, '/covers/hero.jpg', ${profile.avatarHue}, ${data.visibility},
        ${18}, ${data.rules.slice(0, 2000)}, ${userId}, 1
      )
    `;
    await sql`
      insert into memberships (user_id, community_id, role, status, nickname, persona_hue)
      values (${userId}, ${id}, 'agent', 'active', ${profile.displayName}, ${profile.avatarHue})
    `;
    await sql`
      insert into chat_rooms (community_id, name, kind, created_by)
      values (${id}, 'lobby', 'public', ${userId})
    `;
    const room = (
      await sql<{
        id: number;
      }>`select id from chat_rooms where community_id = ${id} order by id desc limit 1`
    )[0];
    if (room) {
      await sql`insert into chat_members (room_id, user_id) values (${room.id}, ${userId})`;
    }
    return { id };
  });

export const getModeration = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((slug: string) => slug)
  .handler(async ({ context, data: slug }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await membershipOf(sql, userId, slug);
    if (m?.status !== "active" || !canModerate(m?.role)) throw new Error("Leaders only.");
    const reports = (
      await sql`select * from reports where community_id = ${slug} order by id desc limit 50`
    ).map(mapReport);
    const pending = (
      await sql`select * from memberships where community_id = ${slug} and status = 'pending'`
    ).map(mapMembership);
    const audit = await sql<{
      id: number;
      actor_id: string;
      action: string;
      detail: string;
      created_at: string;
    }>`
      select id, actor_id, action, detail, created_at from audit_log where community_id = ${slug} order by id desc limit 40
    `;
    let titleDefs: TitleDef[] = [];
    try {
      titleDefs = (
        await sql`select * from title_defs where community_id = ${slug} order by featured desc, id`
      ).map((r) => ({
        id: Number(r.id),
        communityId: String(r.community_id),
        label: String(r.label),
        color: String(r.color),
        featured: asBool(r.featured),
      }));
    } catch {
      titleDefs = [];
    }
    let joinQuestions: JoinQuestion[] = [];
    let invites: InviteCode[] = [];
    let strikes: Strike[] = [];
    let joinAnswers: { userId: string; answers: string[] }[] = [];
    try {
      joinQuestions = (
        await sql`select * from join_questions where community_id = ${slug} order by sort_order, id`
      ).map((r) => ({
        id: Number(r.id),
        communityId: String(r.community_id),
        prompt: String(r.prompt),
        sortOrder: Number(r.sort_order) || 0,
      }));
      invites = (
        await sql`select * from invite_codes where community_id = ${slug} order by created_at desc`
      ).map((r) => ({
        code: String(r.code),
        communityId: String(r.community_id),
        uses: Number(r.uses) || 0,
        maxUses: Number(r.max_uses) || 0,
        expiresAt: r.expires_at ? iso(r.expires_at) : null,
        createdAt: iso(r.created_at),
      }));
      strikes = (
        await sql`select * from strikes where community_id = ${slug} order by id desc limit 40`
      ).map((r) => ({
        id: Number(r.id),
        communityId: String(r.community_id),
        userId: String(r.user_id),
        issuedBy: String(r.issued_by),
        reason: String(r.reason),
        createdAt: iso(r.created_at),
      }));
      joinAnswers = (
        await sql`select user_id, answers from join_answers where community_id = ${slug}`
      ).map((r) => ({
        userId: String(r.user_id),
        answers: parseJson<string[]>(r.answers, []),
      }));
    } catch {
      joinQuestions = [];
    }
    return {
      reports,
      pending,
      audit,
      role: m!.role,
      communityModules: (await requireCommunity(sql, slug)).modules,
      titleDefs,
      joinQuestions,
      invites,
      strikes,
      joinAnswers,
    };
  });

export const updateCommunityModules = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { slug: string; modules: CommunityModule[] }) => data)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const member = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(member.role)) throw new Error("Only leaders can change community navigation.");
    if (
      !Array.isArray(data.modules) ||
      data.modules.length > COMMUNITY_MODULES.length ||
      new Set(data.modules).size !== data.modules.length ||
      data.modules.some((module) => !COMMUNITY_MODULES.includes(module))
    )
      throw new Error("Choose valid community tabs without duplicates.");
    await sql`update communities set modules = ${JSON.stringify(data.modules)} where id = ${data.slug}`;
    return { modules: data.modules };
  });

const COMMUNITY_PICTURE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const COMMUNITY_ICON_MAX_CHARS = 300_000; // a square icon, about 220 KB
const COMMUNITY_BANNER_MAX_CHARS = 2_000_000; // a wide banner, about 1.5 MB

/**
 * Leaders change how their community looks and reads: name, tagline, description, rules, colour,
 * colour style, banner (a built-in picture or their own upload) and icon. Only what is sent is changed.
 */
export const updateCommunityLook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      slug: string;
      name?: string;
      tagline?: string;
      description?: string;
      rules?: string;
      hue?: number;
      themeStyle?: string;
      /** A built-in banner address from the picker, or "" for the default. */
      cover?: string;
      /** Their own banner picture as a data URL. */
      coverUpload?: string;
      /** Their own icon as a data URL; `null` removes the icon. */
      iconUpload?: string | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const member = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(member.role)) throw new Error("Only leaders can change how the community looks.");
    const current = mapCommunity((await sql`select * from communities where id = ${data.slug}`)[0]!);

    const name = data.name === undefined ? current.name : data.name.trim().slice(0, 40);
    if (name.length < 3) throw new Error("The name needs at least 3 characters.");
    const tagline = data.tagline === undefined ? current.tagline : data.tagline.trim().slice(0, 120);
    const description = data.description === undefined ? current.description : data.description.trim().slice(0, 1000);
    const rules = data.rules === undefined ? current.rules : data.rules.trim().slice(0, 2000);
    const err = scanText(`${name}\n${tagline}\n${description}\n${rules}`);
    if (err) throw new Error(err);
    const hue = clampHue(data.hue, current.hue);
    if (data.themeStyle !== undefined && !(THEME_STYLES as readonly string[]).includes(data.themeStyle))
      throw new Error("Choose one of the listed colour styles.");
    const themeStyle = (data.themeStyle ?? current.themeStyle) as ThemeStyle;

    let cover = current.cover;
    const replaced: string[] = [];
    if (data.coverUpload !== undefined) {
      if (!COMMUNITY_PICTURE.test(data.coverUpload)) throw new Error("Choose a JPEG, PNG or WebP banner.");
      if (data.coverUpload.length > COMMUNITY_BANNER_MAX_CHARS) throw new Error("That banner is too large. Try one under 1.5 MB.");
      await guard(userId, "upload");
    } else if (data.cover !== undefined) {
      if (!isAllowedCover(data.cover)) throw new Error("Choose one of the listed banners.");
    }
    if (data.iconUpload) {
      if (!COMMUNITY_PICTURE.test(data.iconUpload)) throw new Error("Choose a JPEG, PNG or WebP icon.");
      if (data.iconUpload.length > COMMUNITY_ICON_MAX_CHARS) throw new Error("That icon is too large. Try a smaller square picture.");
      await guard(userId, "upload");
    }

    const version = Math.floor(Date.now() / 1000);
    const saveMedia = async (kind: "cover" | "icon", dataUrl: string) => {
      const stored = await storeMedia("community", dataUrl);
      const old = (await sql<{ data_url: string }>`select data_url from community_media where community_id = ${data.slug} and kind = ${kind}`)[0];
      await sql`
        insert into community_media (community_id, kind, data_url) values (${data.slug}, ${kind}, ${stored})
        on conflict (community_id, kind) do update set data_url = excluded.data_url, updated_at = now()
      `;
      if (old) replaced.push(old.data_url);
    };
    const dropMedia = async (kind: "cover" | "icon") => {
      const gone = await sql<{ data_url: string }>`delete from community_media where community_id = ${data.slug} and kind = ${kind} returning data_url`;
      replaced.push(...gone.map((r) => r.data_url));
    };

    let icon = current.icon;
    if (data.coverUpload !== undefined) {
      await saveMedia("cover", data.coverUpload);
      cover = `/api/v1/media/community/${data.slug}/cover?v=${version}`;
    } else if (data.cover !== undefined) {
      await dropMedia("cover");
      cover = data.cover || "/covers/hero.jpg";
    }
    if (data.iconUpload) {
      await saveMedia("icon", data.iconUpload);
      icon = `/api/v1/media/community/${data.slug}/icon?v=${version}`;
    } else if (data.iconUpload === null) {
      await dropMedia("icon");
      icon = "";
    }

    await sql`
      update communities
      set name = ${name}, tagline = ${tagline}, description = ${description}, rules = ${rules},
          hue = ${hue}, theme_style = ${themeStyle}, cover = ${cover}, icon = ${icon}
      where id = ${data.slug}
    `;
    await deleteMedia(replaced);
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, 'community:look', ${"look updated"})
    `;
    return { ok: true, cover, icon };
  });

/** A community's own banner or icon. Public, like profile photos, because it is shown on listings. */
export const getCommunityMedia = createServerFn({ method: "GET" })
  .validator((d: { slug: string; kind: "cover" | "icon" }) => d)
  .handler(async ({ data }) => {
    if (data.kind !== "cover" && data.kind !== "icon") throw new Error("Not found.");
    const sql = await db();
    const row = (await sql<{ data_url: string }>`select data_url from community_media where community_id = ${data.slug} and kind = ${data.kind}`)[0];
    return { dataUrl: row ? await loadMedia(row.data_url) : null };
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; status: "resolved" | "dismissed"; slug: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await membershipOf(sql, userId, data.slug);
    if (m?.status !== "active" || !canModerate(m?.role)) throw new Error("Leaders only.");
    await sql`update reports set status = ${data.status} where id = ${data.id} and community_id = ${data.slug}`;
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, ${"report:" + data.status}, ${String(data.id)})
    `;
    return { ok: true };
  });

export const reviewJoin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; userId: string; allow: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await membershipOf(sql, userId, data.slug);
    if (m?.status !== "active" || !canLead(m?.role)) throw new Error("Leaders only.");
    if (data.allow) {
      const approved =
        await sql`update memberships set status = 'active' where user_id = ${data.userId} and community_id = ${data.slug} and status = 'pending' returning user_id`;
      if (!approved.length) return { ok: true };
      await sql`update communities set member_count = member_count + 1 where id = ${data.slug}`;
      await addToOpenRooms(sql, data.userId, data.slug);
      await notify(
        sql,
        data.userId,
        "join",
        "You’re in",
        "A leader approved your request.",
        `/c/${data.slug}`,
      );
    } else {
      await sql`delete from memberships where user_id = ${data.userId} and community_id = ${data.slug} and status = 'pending'`;
    }
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, ${data.allow ? "join:allow" : "join:deny"}, ${data.userId})
    `;
    return { ok: true };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { slug: string; userId: string; action: "curator" | "member" | "ban" | "unban" }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await membershipOf(sql, userId, data.slug);
    if (m?.status !== "active" || !canLead(m?.role)) throw new Error("Leaders only.");
    if (data.userId === userId) throw new Error("Not on yourself.");
    if (!["curator", "member", "ban", "unban"].includes(data.action))
      throw new Error("Invalid action.");
    const target = await membershipOf(sql, data.userId, data.slug);
    if (!target) throw new Error("Member not found.");
    if (target.role === "agent" || target.role === "leader")
      throw new Error("You cannot change another community leader.");
    if (
      (data.action === "ban" && target.status === "banned") ||
      (data.action === "unban" && target.status !== "banned")
    )
      return { ok: true };
    if (data.action === "ban") {
      await sql`update memberships set status = 'banned' where user_id = ${data.userId} and community_id = ${data.slug}`;
      if (target.status === "active")
        await sql`update communities set member_count = greatest(member_count - 1, 0) where id = ${data.slug}`;
    } else if (data.action === "unban") {
      await sql`update memberships set status = 'active' where user_id = ${data.userId} and community_id = ${data.slug}`;
      await sql`update communities set member_count = member_count + 1 where id = ${data.slug}`;
    } else {
      await sql`update memberships set role = ${data.action} where user_id = ${data.userId} and community_id = ${data.slug}`;
    }
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, ${data.action}, ${data.userId})
    `;
    return { ok: true };
  });

export const featurePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: number; slug: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await membershipOf(sql, userId, data.slug);
    if (m?.status !== "active" || !canModerate(m?.role))
      throw new Error("Curators and leaders only.");
    const cur = (
      await sql`select featured from posts where id = ${data.postId} and community_id = ${data.slug}`
    )[0];
    if (!cur) throw new Error("Post not found");
    const next = !asBool(cur.featured);
    await sql`update posts set featured = ${next} where id = ${data.postId}`;
    return { featured: next };
  });

export const homeFeed = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async ({ context }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const featured = (
      await sql.query(
        `select ${POST_SELECT}, com.name as community_name, com.cover as community_cover
         ${POST_JOIN}
         join communities com on com.id = p.community_id
         where p.featured = true and com.visibility = 'public' and coalesce(p.hidden,false) = false
           and (p.expires_at is null or p.expires_at > now())
         order by p.created_at desc
         limit 12`,
      )
    ).map((r) => ({ ...mapPost(r, false), communityName: String(r.community_name) }));
    if (!v.userId) {
      const communities = (
        await sql`select * from communities where visibility = 'public' order by member_count desc`
      ).map(mapCommunity);
      return { featured, latest: featured, communities, joined: [] as Community[] };
    }
    await ensureProfile(sql, { userId: v.userId, email: v.email, name: v.name });
    const joined = (
      await sql`
        select c.* from communities c
        join memberships m on m.community_id = c.id
        where m.user_id = ${v.userId} and m.status = 'active'
      `
    ).map(mapCommunity);
    const ids = joined.map((c) => c.id);
    let latest: (Post & { communityName: string })[] = [];
    if (ids.length) {
      const ph = ids.map((_, i) => `$${i + 1}`).join(",");
      const raw = await sql.query(
        `select ${POST_SELECT}, com.name as community_name
         ${POST_JOIN}
         join communities com on com.id = p.community_id
         where p.community_id in (${ph})
           and p.type <> 'wiki' and coalesce(p.hidden,false) = false
           and (p.expires_at is null or p.expires_at > now())
         order by p.created_at desc
         limit 30`,
        ids,
      );
      latest = raw.map((r) => ({ ...mapPost(r, false), communityName: String(r.community_name) }));
    }
    const communities = (
      await sql`select * from communities where visibility = 'public' order by member_count desc`
    ).map(mapCommunity);
    const blocked = await blockedSet(sql, v.userId);
    const banned = new Set(
      (
        await sql`select community_id from memberships where user_id = ${v.userId} and status = 'banned'`
      ).map((r) => String(r.community_id)),
    );
    const allIds = [...featured, ...latest].map((p) => p.id);
    const liked = await likedSet(sql, v.userId, allIds);
    const saved = await savedSet(sql, v.userId, allIds);
    const visible = (posts: typeof latest) =>
      posts
        .filter((p) => !blocked.has(p.author.userId) && !banned.has(p.communityId))
        .map((p) => ({ ...p, liked: liked.has(p.id), saved: saved.has(p.id) }));
    return {
      featured: visible(featured),
      latest: visible(latest),
      communities: communities.filter((c) => !banned.has(c.id)),
      joined,
    };
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      slug: string;
      name: string;
      kind: Extract<RoomKind, "public" | "voice" | "screening" | "private">;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "post");
    await requireMinAge(sql, userId);
    const m = await requireActiveMember(sql, userId, data.slug);
    if (data.kind !== "public" && !canLead(m.role)) {
      throw new Error("Leaders open voice, screening, and private rooms.");
    }
    const name = data.name.trim().slice(0, 40);
    if (name.length < 2) throw new Error("Name the room.");
    const created = await sql<{ id: number }>`
      insert into chat_rooms (community_id, name, kind, created_by)
      values (${data.slug}, ${name}, ${data.kind}, ${userId})
      returning id
    `;
    const id = Number(created[0]!.id);
    if (data.kind === "private") {
      await sql`insert into chat_members (room_id, user_id) values (${id}, ${userId}) on conflict do nothing`;
    } else {
      const members = await sql<{ user_id: string }>`
        select user_id from memberships where community_id = ${data.slug} and status = 'active'
      `;
      for (const mem of members) {
        await sql`insert into chat_members (room_id, user_id) values (${id}, ${mem.user_id}) on conflict do nothing`;
      }
    }
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, 'room:create', ${name})
    `;
    return { id };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; postId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const post = (
      await sql<{ author_user_id: string; community_id: string }>`
      select author_user_id, community_id from posts where id = ${data.postId} and community_id = ${data.slug}
    `
    )[0];
    if (!post) throw new Error("Post not found");
    const m = await membershipOf(sql, userId, data.slug);
    if (post.author_user_id !== userId && !canModerate(m?.role))
      throw new Error("You can’t remove this.");
    await sql`delete from comment_likes where comment_id in (select id from comments where post_id = ${data.postId})`;
    await sql`delete from comments where post_id = ${data.postId}`;
    await sql`delete from likes where post_id = ${data.postId}`;
    await sql`delete from poll_votes where post_id = ${data.postId}`;
    await sql`delete from quiz_attempts where post_id = ${data.postId}`;
    await sql`delete from quiz_starts where post_id = ${data.postId}`;
    const pictures = await sql<{ data_url: string }>`delete from post_images where post_id = ${data.postId} returning data_url`;
    const coverRow = (await sql<{ cover: string }>`select cover from posts where id = ${data.postId}`)[0];
    try {
      await sql`delete from favorites where post_id = ${data.postId}`;
    } catch {
      /* favorites arrives with 0006 */
    }
    await sql`delete from posts where id = ${data.postId}`;
    await deleteMedia([...pictures.map((r) => r.data_url), coverRow?.cover]);
    if (canModerate(m?.role) && post.author_user_id !== userId) {
      await sql`
        insert into audit_log (community_id, actor_id, action, detail)
        values (${data.slug}, ${userId}, 'post:delete', ${String(data.postId)})
      `;
    }
    return { ok: true };
  });

export const saveCharacter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { id?: number; name: string; fandom: string; bio: string; appearance: string }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const name = data.name.trim().slice(0, 40);
    if (name.length < 2) throw new Error("Name the character.");
    const err = scanText(`${data.bio}\n${data.appearance}`);
    if (err) throw new Error(err);
    const fandom = data.fandom.trim().slice(0, 40);
    const bio = data.bio.slice(0, 600);
    const appearance = data.appearance.slice(0, 400);
    if (data.id) {
      await sql`
        update characters
        set name = ${name}, fandom = ${fandom}, bio = ${bio}, appearance = ${appearance}
        where id = ${data.id} and user_id = ${userId}
      `;
      return { id: data.id };
    }
    const rows = await sql<{ id: number }>`
      insert into characters (user_id, name, fandom, bio, appearance, hue)
      values (${userId}, ${name}, ${fandom}, ${bio}, ${appearance}, ${hashHue(name + userId)})
      returning id
    `;
    return { id: Number(rows[0]!.id) };
  });

export const deleteCharacter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await sql`delete from characters where id = ${id} and user_id = ${userId}`;
    return { ok: true };
  });

export const searchPeople = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((q: string) => q)
  .handler(async ({ data: q }) => {
    const sql = await db();
    const term = q.trim().slice(0, 40);
    if (term.length < 2)
      return [] as { handle: string; displayName: string; bio: string; hue: number; rep: number }[];
    const like = `%${term.replace(/[%_]/g, "")}%`;
    const rows = await sql`
      select handle, display_name, bio, avatar_hue, rep
      from profiles
      where handle ilike ${like} or display_name ilike ${like}
      order by rep desc
      limit 12
    `;
    return rows.map((r) => ({
      handle: String(r.handle),
      displayName: String(r.display_name),
      bio: String(r.bio ?? ""),
      hue: Number(r.avatar_hue) || 220,
      rep: Number(r.rep) || 0,
    }));
  });

export const toggleCommentLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((commentId: number) => commentId)
  .handler(async ({ context, data: commentId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const comment = (
      await sql<{ post_id: number }>`select post_id from comments where id = ${commentId}`
    )[0];
    if (!comment) throw new Error("Comment not found");
    const post = (
      await sql<{
        community_id: string;
      }>`select community_id from posts where id = ${comment.post_id}`
    )[0];
    if (!post) throw new Error("Post not found");
    await requireActiveMember(sql, userId, post.community_id);
    const exists =
      await sql`select 1 from comment_likes where user_id = ${userId} and comment_id = ${commentId}`;
    if (exists.length) {
      await sql`delete from comment_likes where user_id = ${userId} and comment_id = ${commentId}`;
      return { liked: false };
    }
    await sql`insert into comment_likes (user_id, comment_id) values (${userId}, ${commentId})`;
    return { liked: true };
  });

export const listShared = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((slug: string) => slug)
  .handler(async ({ context, data: slug }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const community = await requireCommunity(sql, slug);
    const member = await membershipOf(sql, v.userId, slug);
    if (!canRead(community, member)) throw new Error("This community is private.");
    const rows = await sql`
      select s.*, coalesce(m.nickname, pr.display_name, 'Member') as author
      from shared_items s
      left join memberships m on m.user_id = s.author_user_id and m.community_id = s.community_id
      left join profiles pr on pr.user_id = s.author_user_id
      where s.community_id = ${slug}
      order by s.folder, s.id desc
      limit 200
    `;
    // Leaders see everything; everyone else needs the level the item asks for.
    const viewerLevel = member?.status === "active" ? levelFromRep(member.rep) : 1;
    const leader = member?.status === "active" && canLead(member.role);
    return {
      member,
      items: rows.map((r): SharedItem => {
        const minLevel = Number(r.min_level ?? 1);
        const locked = !leader && minLevel > viewerLevel;
        return {
          id: Number(r.id),
          communityId: String(r.community_id),
          title: String(r.title),
          url: locked ? "" : String(r.url ?? ""),
          note: locked ? "" : String(r.note ?? ""),
          author: String(r.author),
          authorId: String(r.author_user_id),
          folder: String(r.folder ?? ""),
          minLevel,
          locked,
          createdAt: String(r.created_at),
        };
      }),
    };
  });

export const addShared = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; title: string; url?: string; note?: string; folder?: string; minLevel?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "post");
    const member = await requireActiveMember(sql, userId, data.slug);
    const title = data.title.trim().slice(0, 80);
    if (title.length < 2) throw new Error("Name the file.");
    const url = (data.url ?? "").trim().slice(0, 500);
    const note = (data.note ?? "").trim().slice(0, 400);
    if (url && !/^https?:\/\//i.test(url)) throw new Error("Links must start with http(s).");
    const folder = normalizeFolder(data.folder);
    const minLevel = sharedMinLevel(data.minLevel, member.role);
    const err = scanText(`${title}\n${url}\n${note}\n${folder}`);
    if (err) throw new Error(err);
    const rows = await sql<{ id: number }>`
      insert into shared_items (community_id, author_user_id, title, url, note, folder, min_level)
      values (${data.slug}, ${userId}, ${title}, ${url}, ${note}, ${folder}, ${minLevel})
      returning id
    `;
    return { id: Number(rows[0]!.id) };
  });

/** Only leaders may lock an item behind a level; everyone else's items are open to all members. */
function sharedMinLevel(requested: unknown, role: string | undefined): number {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n) || n <= 1) return 1;
  if (!canLead(role as Role | undefined)) throw new Error("Only leaders can require a level.");
  return Math.min(n, 30);
}

/** Moves a shared item to another folder (and, for leaders, changes the level it needs). */
export const moveShared = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; id: number; folder: string; minLevel?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    const row = (
      await sql<{ author_user_id: string; min_level: number }>`
        select author_user_id, min_level from shared_items where id = ${data.id} and community_id = ${data.slug}
      `
    )[0];
    if (!row) throw new Error("File not found");
    if (row.author_user_id !== userId && !canModerate(m.role)) throw new Error("You can’t move this.");
    const folder = normalizeFolder(data.folder);
    const minLevel = data.minLevel === undefined ? Number(row.min_level) : sharedMinLevel(data.minLevel, m.role);
    const err = scanText(folder);
    if (err) throw new Error(err);
    await sql`update shared_items set folder = ${folder}, min_level = ${minLevel} where id = ${data.id} and community_id = ${data.slug}`;
    return { ok: true };
  });

export const deleteShared = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; id: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const row = (
      await sql<{ author_user_id: string }>`
        select author_user_id from shared_items where id = ${data.id} and community_id = ${data.slug}
      `
    )[0];
    if (!row) throw new Error("File not found");
    const m = await membershipOf(sql, userId, data.slug);
    if (row.author_user_id !== userId && !canModerate(m?.role))
      throw new Error("You can’t remove this.");
    await sql`delete from shared_items where id = ${data.id} and community_id = ${data.slug}`;
    return { ok: true };
  });

export const toggleFollowProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((targetId: string) => targetId)
  .handler(async ({ context, data: targetId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "follow");
    if (userId === targetId) throw new Error("That’s you.");
    const blocked = await sql`
      select 1 from blocks
      where (blocker_id = ${userId} and blocked_id = ${targetId})
         or (blocker_id = ${targetId} and blocked_id = ${userId})
    `;
    if (blocked.length) throw new Error("You can’t follow someone you’ve blocked.");
    const exists =
      await sql`select 1 from profile_follows where follower_id = ${userId} and followee_id = ${targetId}`;
    if (exists.length) {
      await sql`delete from profile_follows where follower_id = ${userId} and followee_id = ${targetId}`;
      return { following: false };
    }
    await sql`insert into profile_follows (follower_id, followee_id) values (${userId}, ${targetId})`;
    const me = (
      await sql<{
        display_name: string;
      }>`select display_name from profiles where user_id = ${userId}`
    )[0];
    await notify(
      sql,
      targetId,
      "follow",
      "New follower",
      `${me?.display_name ?? "Someone"} followed you`,
      `/u/${(await sql<{ handle: string }>`select handle from profiles where user_id = ${targetId}`)[0]?.handle ?? ""}`,
    );
    return { following: true };
  });

export const listFollows = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((d: { handle: string; kind: "followers" | "following" }) => d)
  .handler(async ({ data }) => {
    const sql = await db();
    const profile = (
      await sql<{ user_id: string }>`select user_id from profiles where handle = ${data.handle}`
    )[0];
    if (!profile) return [];
    const rows =
      data.kind === "followers"
        ? await sql`
            select p.handle, p.display_name, p.avatar_hue, p.rep
            from profile_follows f join profiles p on p.user_id = f.follower_id
            where f.followee_id = ${profile.user_id}
            order by f.created_at desc
            limit 40
          `
        : await sql`
            select p.handle, p.display_name, p.avatar_hue, p.rep
            from profile_follows f join profiles p on p.user_id = f.followee_id
            where f.follower_id = ${profile.user_id}
            order by f.created_at desc
            limit 40
          `;
    return rows.map((r) => ({
      handle: String(r.handle),
      displayName: String(r.display_name),
      hue: Number(r.avatar_hue) || 220,
      rep: Number(r.rep) || 0,
    }));
  });

export const createTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; label: string; color: string; featured?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders create titles.");
    const err = scanTitle(data.label);
    if (err) throw new Error(err);
    if (!isAllowedTitleColor(data.color)) throw new Error("Pick a title color.");
    const count = Number(
      (
        await sql<{
          n: number;
        }>`select count(*)::int as n from title_defs where community_id = ${data.slug}`
      )[0]?.n ?? 0,
    );
    if (count >= 16) throw new Error("This hall already has 16 titles.");
    const rows = await sql<{ id: number }>`
      insert into title_defs (community_id, label, color, featured, created_by)
      values (${data.slug}, ${data.label.trim()}, ${data.color}, ${Boolean(data.featured)}, ${userId})
      returning id
    `;
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, 'title:create', ${data.label.trim()})
    `;
    return { id: Number(rows[0]!.id) };
  });

export const deleteTitleDef = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; id: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders only.");
    await sql`delete from member_titles where title_id = ${data.id} and community_id = ${data.slug}`;
    await sql`delete from title_defs where id = ${data.id} and community_id = ${data.slug}`;
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, 'title:delete', ${String(data.id)})
    `;
    return { ok: true };
  });

export const grantTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; userId: string; titleId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders grant titles.");
    const target = await membershipOf(sql, data.userId, data.slug);
    if (target?.status !== "active") throw new Error("They have to be in this hall.");
    const def = (
      await sql`select id, label from title_defs where id = ${data.titleId} and community_id = ${data.slug}`
    )[0];
    if (!def) throw new Error("Title not found.");
    const held = Number(
      (
        await sql<{
          n: number;
        }>`select count(*)::int as n from member_titles where user_id = ${data.userId}`
      )[0]?.n ?? 0,
    );
    if (held >= 12) throw new Error("They already have 12 titles.");
    await sql`
      insert into member_titles (user_id, title_id, community_id, granted_by)
      values (${data.userId}, ${data.titleId}, ${data.slug}, ${userId})
      on conflict (user_id, title_id) do nothing
    `;
    await notify(
      sql,
      data.userId,
      "title",
      "New title",
      `You were given “${def.label}”.`,
      `/c/${data.slug}`,
    );
    return { ok: true };
  });

export const revokeTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; userId: string; titleId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders revoke titles.");
    await sql`delete from member_titles where user_id = ${data.userId} and title_id = ${data.titleId} and community_id = ${data.slug}`;
    return { ok: true };
  });

export const pinTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const row = (
      await sql`select id from member_titles where id = ${id} and user_id = ${userId}`
    )[0];
    if (!row) throw new Error("Title not found.");
    await sql`update member_titles set pinned = false where user_id = ${userId}`;
    await sql`update member_titles set pinned = true, hidden = false where id = ${id} and user_id = ${userId}`;
    return { ok: true };
  });

export const hideTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const row = (
      await sql<{
        hidden: unknown;
      }>`select hidden from member_titles where id = ${id} and user_id = ${userId}`
    )[0];
    if (!row) throw new Error("Title not found.");
    const next = !asBool(row.hidden);
    await sql`update member_titles set hidden = ${next}, pinned = false where id = ${id} and user_id = ${userId}`;
    return { hidden: next };
  });

export const addWallPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { handle: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "comment");
    await requireMinAge(sql, userId);
    const profile = (
      await sql<{
        user_id: string;
        handle: string;
      }>`select user_id, handle from profiles where handle = ${data.handle}`
    )[0];
    if (!profile) throw new Error("No one by that name.");
    if (userId === profile.user_id)
      throw new Error("Use a post in a hall — the wall is for visitors.");
    const blocked = await sql`
      select 1 from blocks
      where (blocker_id = ${userId} and blocked_id = ${profile.user_id})
         or (blocker_id = ${profile.user_id} and blocked_id = ${userId})
    `;
    if (blocked.length) throw new Error("You can’t write on this wall.");
    const err = scanText(data.body);
    if (err) throw new Error(err);
    const note = await sql<{ id: number }>`
      insert into wall_posts (profile_user_id, author_user_id, body)
      values (${profile.user_id}, ${userId}, ${data.body.trim().slice(0, 500)})
      returning id
    `;
    const { held } = await reviewContent(
      sql,
      { targetType: "wall", targetId: Number(note[0]!.id), authorId: userId, communityId: null, text: data.body, href: `/u/${profile.handle}` },
      notify,
    );
    if (held) return { ok: true, held };
    await notify(
      sql,
      profile.user_id,
      "wall",
      "New wall note",
      data.body.slice(0, 80),
      `/u/${profile.handle}`,
    );
    return { ok: true, held };
  });

export const deleteWallPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const row = (
      await sql<{
        profile_user_id: string;
        author_user_id: string;
      }>`select profile_user_id, author_user_id from wall_posts where id = ${id}`
    )[0];
    if (!row) throw new Error("Note not found.");
    if (row.profile_user_id !== userId && row.author_user_id !== userId)
      throw new Error("You can’t remove this.");
    await sql`delete from wall_posts where id = ${id}`;
    try {
      await sql`delete from wall_likes where wall_post_id = ${id}`;
    } catch {
      /* */
    }
    return { ok: true };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requirePostAccess(sql, userId, postId);
    const post = (
      await sql<{ community_id: string }>`select community_id from posts where id = ${postId}`
    )[0];
    if (!post) throw new Error("Post not found");
    const exists =
      await sql`select 1 from favorites where user_id = ${userId} and post_id = ${postId}`;
    if (exists.length) {
      await sql`delete from favorites where user_id = ${userId} and post_id = ${postId}`;
      return { saved: false };
    }
    await sql`insert into favorites (user_id, post_id) values (${userId}, ${postId})`;
    return { saved: true };
  });

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const raw = await sql.query(
      `select ${POST_SELECT}, com.name as community_name
       ${POST_JOIN}
       join favorites f on f.post_id = p.id
       join communities com on com.id = p.community_id
       where f.user_id = $1 and coalesce(p.hidden,false) = false
         and (p.expires_at is null or p.expires_at > now())
         and not exists (select 1 from blocks b where (b.blocker_id = $1 and b.blocked_id = p.author_user_id) or (b.blocked_id = $1 and b.blocker_id = p.author_user_id))
         and not exists (select 1 from memberships mm where mm.community_id = p.community_id and mm.user_id = $1 and mm.status = 'banned')
         and (com.visibility in ('public','unlisted') or exists (select 1 from memberships mm where mm.community_id = p.community_id and mm.user_id = $1 and mm.status = 'active'))
       order by f.created_at desc
       limit 40`,
      [userId],
    );
    const ids = raw.map((r) => Number(r.id));
    const liked = await likedSet(sql, userId, ids);
    return raw.map((r) => ({
      ...mapPost(r, liked.has(Number(r.id)), true),
      communityName: String(r.community_name),
    }));
  });

export const editPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; postId: number; title: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireActiveMember(sql, userId, data.slug);
    await requirePostAccess(sql, userId, data.postId);
    const post = (
      await sql<{ author_user_id: string; type: string; title: string; body: string }>`
        select author_user_id, type, title, body from posts where id = ${data.postId} and community_id = ${data.slug}
      `
    )[0];
    if (!post) throw new Error("Post not found");
    if (post.author_user_id !== userId) throw new Error("You can only edit your own post.");
    const err = scanText(`${data.title}\n${data.body}`);
    if (err) throw new Error(err);
    if (data.title.trim().length < 3) throw new Error("Give it a title.");
    const hashtags = extractHashtags(`${data.title}\n${data.body}`);
    if (post.type === "wiki") {
      await sql`insert into wiki_revisions (post_id, editor_user_id, title, body)
        values (${data.postId}, ${userId}, ${post.title}, ${post.body})`;
    }
    await sql`
      update posts
      set title = ${data.title.trim().slice(0, 120)},
          body = ${data.body.slice(0, 8000)},
          hashtags = ${JSON.stringify(hashtags)},
          edited_at = now(),
          wiki_status = case when type = 'wiki' and wiki_status = 'approved' then 'pending' else wiki_status end
      where id = ${data.postId}
    `;
    const { held } = await reviewContent(
      sql,
      { targetType: "post", targetId: data.postId, authorId: userId, communityId: data.slug, text: `${data.title}\n${data.body}`, href: `/c/${data.slug}/p/${data.postId}` },
      notify,
    );
    return { ok: true, held };
  });

export const setPostFlags = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      slug: string;
      postId: number;
      commentsDisabled?: boolean;
      pinned?: boolean;
      hidden?: boolean;
      announcement?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const post = (
      await sql<{
        author_user_id: string;
        comments_disabled: unknown;
        pinned: unknown;
        hidden: unknown;
        announcement: unknown;
      }>`
        select author_user_id, comments_disabled, pinned, hidden, announcement
        from posts where id = ${data.postId} and community_id = ${data.slug}
      `
    )[0];
    if (!post) throw new Error("Post not found");
    const m = await membershipOf(sql, userId, data.slug);
    const owner = post.author_user_id === userId;
    if (!owner && !canModerate(m?.role)) throw new Error("You can’t change this post.");
    const commentsDisabled = data.commentsDisabled ?? asBool(post.comments_disabled);
    let pinned = asBool(post.pinned);
    let hidden = asBool(post.hidden);
    let announcement = asBool(post.announcement);
    if (data.pinned != null || data.hidden != null || data.announcement != null) {
      if (m?.status !== "active" || !canModerate(m?.role))
        throw new Error("Leaders pin, hide, and announce.");
      if (data.pinned != null) pinned = data.pinned;
      if (data.hidden != null) hidden = data.hidden;
      if (data.announcement != null) {
        if (m?.status !== "active" || !canLead(m?.role)) throw new Error("Leaders announce.");
        announcement = data.announcement;
      }
    }
    await sql`
      update posts
      set comments_disabled = ${commentsDisabled}, pinned = ${pinned}, hidden = ${hidden}, announcement = ${announcement}
      where id = ${data.postId}
    `;
    return { commentsDisabled, pinned, hidden, announcement };
  });

export const repost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; postId: number; note?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "post");
    await requireMinAge(sql, userId);
    await requirePostAccess(sql, userId, data.postId);
    await requireActiveMember(sql, userId, data.slug);
    const src = (
      await sql<{ id: number; title: string; body: string; community_id: string; type: string }>`
        select id, title, body, community_id, type from posts where id = ${data.postId}
      `
    )[0];
    if (!src) throw new Error("Post not found");
    const sourceCommunity = await requireCommunity(sql, src.community_id);
    if (sourceCommunity.visibility !== "public" && data.slug !== src.community_id)
      throw new Error("Private community posts can only be shared inside their community.");
    const note = (data.note ?? "").trim().slice(0, 400);
    if (note) {
      const err = scanText(note);
      if (err) throw new Error(err);
    }
    const rows = await sql<{ id: number }>`
      insert into posts (community_id, author_user_id, type, title, body, payload, original_post_id, hashtags)
      values (
        ${data.slug}, ${userId}, 'blog', ${"Repost: " + String(src.title).slice(0, 100)},
        ${note || String(src.body).slice(0, 400)}, ${JSON.stringify({})}, ${src.id}, ${JSON.stringify([])}
      )
      returning id
    `;
    await sql`update memberships set rep = rep + 2 where user_id = ${userId} and community_id = ${data.slug}`;
    return { id: Number(rows[0]!.id) };
  });

export const toggleWallLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const note = (await sql`select id from wall_posts where id = ${id}`)[0];
    if (!note) throw new Error("Note not found.");
    const exists =
      await sql`select 1 from wall_likes where user_id = ${userId} and wall_post_id = ${id}`;
    if (exists.length) {
      await sql`delete from wall_likes where user_id = ${userId} and wall_post_id = ${id}`;
      return { liked: false };
    }
    await sql`insert into wall_likes (user_id, wall_post_id) values (${userId}, ${id})`;
    return { liked: true };
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; messageId: number; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, data.roomId);
    const body = data.body.trim().slice(0, 2000);
    if (!body) throw new Error("Write a message first.");
    if (!parseSticker(body)) {
      const err = scanText(body);
      if (err) throw new Error(err);
    }
    const row = (
      await sql<{ author_user_id: string; deleted: unknown }>`
        select author_user_id, deleted from messages where id = ${data.messageId} and room_id = ${data.roomId}
      `
    )[0];
    if (!row) throw new Error("Message not found.");
    if (row.author_user_id !== userId) throw new Error("You can only edit your own messages.");
    if (asBool(row.deleted)) throw new Error("That message was removed.");
    if ((await sql`select 1 from message_media where message_id = ${data.messageId}`).length)
      throw new Error("Media messages cannot be edited. Delete and resend instead.");
    await sql`update messages set body = ${body}, edited_at = now() where id = ${data.messageId}`;
    const room = (await sql<{ community_id: string | null }>`select community_id from chat_rooms where id = ${data.roomId}`)[0];
    const { held } = await reviewContent(
      sql,
      {
        targetType: "message",
        targetId: data.messageId,
        authorId: userId,
        communityId: room?.community_id ? String(room.community_id) : null,
        text: parseSticker(body) ? "" : body,
        href: `/chats/${data.roomId}`,
      },
      notify,
    );
    return { ok: true, held };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; messageId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const room = await requireRoomAccess(sql, userId, data.roomId);
    const row = (
      await sql<{ author_user_id: string }>`
        select author_user_id from messages where id = ${data.messageId} and room_id = ${data.roomId}
      `
    )[0];
    if (!row) throw new Error("Message not found.");
    const communityId = room.community_id ? String(room.community_id) : null;
    const m = communityId ? await membershipOf(sql, userId, communityId) : null;
    if (row.author_user_id !== userId && !canModerate(m?.role))
      throw new Error("You can’t remove this.");
    await sql`update messages set deleted = true, body = '' where id = ${data.messageId}`;
    const gone = await sql<{ data_url: string }>`delete from message_media where message_id = ${data.messageId} returning data_url`;
    await deleteMedia(gone.map((r) => r.data_url));
    await sql`delete from message_reactions where message_id = ${data.messageId}`;
    return { ok: true };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders send broadcasts.");
    const err = scanText(data.body);
    if (err) throw new Error(err);
    const body = data.body.trim().slice(0, 400);
    await sql`
      insert into broadcasts (community_id, author_user_id, body)
      values (${data.slug}, ${userId}, ${body})
    `;
    const members = await sql<{ user_id: string }>`
      select user_id from memberships where community_id = ${data.slug} and status = 'active'
    `;
    for (const mem of members) {
      if (mem.user_id === userId) continue;
      await notify(sql, mem.user_id, "broadcast", "Hall broadcast", body, `/c/${data.slug}`);
    }
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, 'broadcast', ${body.slice(0, 80)})
    `;
    return { ok: true };
  });

export const setJoinQuestions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; prompts: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders set join questions.");
    const prompts = data.prompts
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    for (const p of prompts) {
      const err = scanText(p);
      if (err) throw new Error(err);
    }
    await sql`delete from join_questions where community_id = ${data.slug}`;
    let i = 0;
    for (const prompt of prompts) {
      await sql`
        insert into join_questions (community_id, prompt, sort_order)
        values (${data.slug}, ${prompt.slice(0, 140)}, ${i})
      `;
      i += 1;
    }
    return { ok: true };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; maxUses?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await guard(userId, "invite");
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders make invite codes.");
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    const maxUses = Math.max(0, Math.min(200, Number(data.maxUses ?? 0) || 0));
    await sql`
      insert into invite_codes (code, community_id, created_by, max_uses)
      values (${code}, ${data.slug}, ${userId}, ${maxUses})
    `;
    return { code };
  });

export const issueStrike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; userId: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders issue strikes.");
    if (data.userId === userId) throw new Error("Not on yourself.");
    const err = scanText(data.reason);
    if (err) throw new Error(err);
    await sql`
      insert into strikes (community_id, user_id, issued_by, reason)
      values (${data.slug}, ${data.userId}, ${userId}, ${data.reason.trim().slice(0, 200)})
    `;
    const n = Number(
      (
        await sql<{
          n: number;
        }>`select count(*)::int as n from strikes where community_id = ${data.slug} and user_id = ${data.userId}`
      )[0]?.n ?? 0,
    );
    await notify(
      sql,
      data.userId,
      "strike",
      "Strike issued",
      data.reason.slice(0, 80),
      `/c/${data.slug}`,
    );
    if (n >= 3) {
      await sql`update memberships set status = 'banned' where user_id = ${data.userId} and community_id = ${data.slug}`;
      await sql`update communities set member_count = greatest(member_count - 1, 0) where id = ${data.slug}`;
      await notify(
        sql,
        data.userId,
        "ban",
        "Removed after 3 strikes",
        data.slug,
        `/c/${data.slug}`,
      );
    }
    await sql`
      insert into audit_log (community_id, actor_id, action, detail)
      values (${data.slug}, ${userId}, 'strike', ${data.userId + ":" + n})
    `;
    return { count: n, banned: n >= 3 };
  });

export const weeklyRank = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((slug: string) => slug)
  .handler(async ({ context, data: slug }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const community = await requireCommunity(sql, slug);
    const member = await membershipOf(sql, v.userId, slug);
    if (!canRead(community, member)) throw new Error("This community is private.");
    const rows = await sql.query(
      // Ranked by the same week score that is shown (3 per like received, 4 per post), then all-time rep.
      `select * from (
         select m.user_id, m.nickname, m.persona_hue, m.role, m.rep, pr.handle, pr.avatar_version,
                (select count(*)::int from posts p
                  where p.author_user_id = m.user_id and p.community_id = m.community_id
                    and p.created_at > now() - interval '7 days') as week_posts,
                (select coalesce(sum(p.like_count),0)::int from posts p
                  where p.author_user_id = m.user_id and p.community_id = m.community_id
                    and p.created_at > now() - interval '7 days') as week_likes
         from memberships m
         left join profiles pr on pr.user_id = m.user_id
         where m.community_id = $1 and m.status = 'active'
       ) ranked
       order by week_likes * 3 + week_posts * 4 desc, rep desc
       limit 40`,
      [slug],
    );
    const rank: RankRow[] = rows.map((r) => {
      const weekPosts = Number(r.week_posts) || 0;
      const weekLikes = Number(r.week_likes) || 0;
      return {
        userId: String(r.user_id),
        nickname: String(r.nickname),
        handle: String(r.handle || "member"),
        hue: Number(r.persona_hue) || 220,
        avatarV: Number(r.avatar_version) || 0,
        role: (r.role as Role) ?? "member",
        rep: Number(r.rep) || 0,
        weekPosts,
        weekLikes,
        weekScore: weekLikes * 3 + weekPosts * 4,
      };
    });
    return { community, rank };
  });

export const listEvents = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .validator((slug: string) => slug)
  .handler(async ({ context, data: slug }) => {
    const sql = await db();
    const v = context as unknown as Viewer;
    const community = await requireCommunity(sql, slug);
    const member = await membershipOf(sql, v.userId, slug);
    if (!canRead(community, member)) throw new Error("This community is private.");
    const eventRows = await sql.query(
      `select e.*, ${EVENT_COUNTS}
       from events e
       where e.community_id = $1
       order by e.starts_at desc
       limit 30`,
      [slug, v.userId ?? ""],
    );
    const goingIds = new Set<number>();
    if (v.userId && eventRows.length) {
      const mine = await sql<{
        event_id: number;
      }>`select event_id from event_rsvps where user_id = ${v.userId}`;
      for (const r of mine) goingIds.add(Number(r.event_id));
    }
    const events: HallEvent[] = eventRows.map((r) => mapHallEvent(r, goingIds.has(Number(r.id))));
    return { community, member, events };
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      slug: string;
      title: string;
      body: string;
      kind: "event" | "challenge";
      startsAt: string;
      endsAt?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const m = await requireActiveMember(sql, userId, data.slug);
    if (!canLead(m.role)) throw new Error("Leaders schedule events.");
    const err = scanText(`${data.title}\n${data.body}`);
    if (err) throw new Error(err);
    const title = data.title.trim().slice(0, 80);
    if (title.length < 3) throw new Error("Name the event.");
    const starts = new Date(data.startsAt);
    if (Number.isNaN(starts.getTime())) throw new Error("Pick a start time.");
    const ends = data.endsAt ? new Date(data.endsAt) : null;
    const rows = await sql<{ id: number }>`
      insert into events (community_id, title, body, kind, starts_at, ends_at, created_by)
      values (
        ${data.slug}, ${title}, ${data.body.slice(0, 800)}, ${data.kind},
        ${starts.toISOString()}, ${ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : null}, ${userId}
      )
      returning id
    `;
    return { id: Number(rows[0]!.id) };
  });

export const rsvpEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string; eventId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireActiveMember(sql, userId, data.slug);
    const ev = (
      await sql`select id from events where id = ${data.eventId} and community_id = ${data.slug}`
    )[0];
    if (!ev) throw new Error("Event not found.");
    const exists =
      await sql`select 1 from event_rsvps where event_id = ${data.eventId} and user_id = ${userId}`;
    if (exists.length) {
      await sql`delete from event_rsvps where event_id = ${data.eventId} and user_id = ${userId}`;
      return { going: false };
    }
    await sql`insert into event_rsvps (event_id, user_id) values (${data.eventId}, ${userId})`;
    return { going: true };
  });

export const ringCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((roomId: number) => roomId)
  .handler(async ({ context, data: roomId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const room = await requireRoomAccess(sql, userId, roomId);
    const me = (
      await sql<{
        display_name: string;
      }>`select display_name from profiles where user_id = ${userId}`
    )[0];
    const others = await sql<{
      user_id: string;
    }>`select user_id from chat_members where room_id = ${roomId} and user_id <> ${userId}`;
    const label = String(room.name || "call");
    for (const o of others) {
      await notify(
        sql,
        o.user_id,
        "call",
        me?.display_name ?? "Someone",
        "Incoming call",
        `/chats/${roomId}?call=1`,
      );
    }
    return { ok: true, name: label };
  });

export const listIncomingCalls = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const rows = await sql`
      select id, title, body, href, created_at
      from notifications
      where user_id = ${userId} and kind = 'call' and read = false
      order by id desc
      limit 8
    `;
    const cutoff = Date.now() - 45_000;
    return rows
      .map((r) => ({
        id: Number(r.id),
        name: String(r.title),
        body: String(r.body ?? "Incoming call"),
        href: String(r.href),
        createdAt: iso(r.created_at),
      }))
      .filter((r) => new Date(r.createdAt).getTime() >= cutoff);
  });

export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await sql`update notifications set read = true where id = ${id} and user_id = ${userId}`;
    return { ok: true };
  });

export const endCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((roomId: number) => roomId)
  .handler(async ({ context, data: roomId }) => {
    const sql = await db();
    const { userId } = context as Authed;
    await requireRoomAccess(sql, userId, roomId);
    await sql`
      update notifications
      set read = true
      where kind = 'call' and href = ${`/chats/${roomId}?call=1`}
    `;
    return { ok: true };
  });

export const setWatchMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; url: string; title: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { userId } = context as Authed;
    const room = await requireRoomAccess(sql, userId, data.roomId);
    if (String(room.kind) !== "screening") throw new Error("Watch party is for screening rooms.");
    const parsed = parseWatchInput(data.url);
    if ("error" in parsed) throw new Error(parsed.error);
    const title = (data.title || parsed.title).slice(0, 80);
    await sql`update chat_rooms set watch_url = ${parsed.url}, watch_title = ${title} where id = ${data.roomId}`;
    return { url: parsed.url, title };
  });

/**
 * Helpers shared with sibling server modules (`extras.ts`, media routes).
 * This is an object, not a function, so it is never exposed over the mobile RPC.
 */
export const internals = {
  db,
  notify,
  canRead,
  membershipOf,
  requireCommunity,
  requireMinAge,
  ensureProfile,
  requireActiveMember,
  requirePostAccess,
  requireRoomAccess,
  assertNotMuted,
  blockedSet,
  likedSet,
  savedSet,
  POST_SELECT,
  POST_JOIN,
};
