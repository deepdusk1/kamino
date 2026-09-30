export type Visibility = "public" | "private" | "unlisted";
export type Role = "agent" | "leader" | "curator" | "member";
export type MemberStatus = "active" | "pending" | "banned";
export type PostType = "blog" | "image" | "poll" | "quiz" | "wiki" | "story" | "question" | "link";
export type RoomKind = "public" | "private" | "dm" | "voice" | "screening";
export type DmPrivacy = "everyone" | "members" | "none";
/** Free avatar frames (everyone can use every one; nothing is bought or unlocked). */
export const PROFILE_FRAME_IDS = ["ring", "moon", "star", "laurel", "spark", "flame", "crown", "aurora", "none"] as const;
export type ProfileFrame = (typeof PROFILE_FRAME_IDS)[number];
/** Free chat bubble looks, on top of the colour you pick. */
export const BUBBLE_STYLES = ["soft", "glass", "outline", "bold"] as const;
export type BubbleStyle = (typeof BUBBLE_STYLES)[number];
export const COMMUNITY_MODULES = ["chats", "wiki", "files", "events", "rank", "members", "roleplay"] as const;
export type CommunityModule = (typeof COMMUNITY_MODULES)[number];

/** Colour styles a community can pick (free, like every other cosmetic). */
export const THEME_STYLES = ["aurora", "solid", "vivid", "soft", "night"] as const;
export type ThemeStyle = (typeof THEME_STYLES)[number];

export type Community = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  cover: string;
  hue: number;
  /** How the community's colour is used (banner tint and accent colour). */
  themeStyle: ThemeStyle;
  /** Address of the community's own icon picture, or "" for none. */
  icon: string;
  visibility: Visibility;
  ageGate: number;
  contentWarnings: string[];
  rules: string;
  modules: CommunityModule[];
  createdBy: string;
  memberCount: number;
  createdAt: string;
};

export type Membership = {
  userId: string;
  communityId: string;
  role: Role;
  status: MemberStatus;
  nickname: string;
  personaBio: string;
  personaHue: number;
  rep: number;
  /** Check-in streak inside this community (days in a row, counting yesterday as still alive). */
  streak: number;
  bestStreak: number;
  checkedInToday: boolean;
  handle?: string;
  /** Profile photo version, 0 when none (only filled in lists that join profiles). */
  avatarV?: number;
  joinedAt: string;
};

export type Profile = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarHue: number;
  /** 0 = no photo; otherwise changes on every upload (used to refresh cached images). */
  avatarVersion: number;
  cover: string;
  mood: string;
  status: string;
  frame: ProfileFrame;
  lastSeenAt: string | null;
  bubbleHue: number;
  bubbleStyle: BubbleStyle;
  ageConfirmed: boolean;
  /** True once the person has passed the 13+ birthday check (the date itself is never saved). */
  minAgeConfirmed: boolean;
  dmPrivacy: DmPrivacy;
  hideJoined: boolean;
  showOnline: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyChat: boolean;
  notifyWall: boolean;
  rep: number;
  streak: number;
  lastCheckinAt: string | null;
  createdAt: string;
};

export type TitleDef = {
  id: number;
  communityId: string;
  communityName?: string;
  label: string;
  color: string;
  featured: boolean;
};

export type MemberTitle = {
  id: number;
  titleId: number;
  label: string;
  color: string;
  communityId: string;
  communityName: string;
  featured: boolean;
  pinned: boolean;
  hidden: boolean;
};

export type WallPost = {
  id: number;
  author: AuthorChip;
  body: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
};

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  /** An icon name each app maps to its own icons (see `achievements.ts`). */
  icon: string;
  category: string;
  tier: "bronze" | "silver" | "gold" | "legend";
  /** Count so far (capped at `target`) for the progress bar. */
  progress: number;
  target: number;
  unlockedAt: string | null;
};

export type Character = {
  id: number;
  userId: string;
  name: string;
  fandom: string;
  bio: string;
  appearance: string;
  hue: number;
};

export type SharedItem = {
  id: number;
  communityId: string;
  title: string;
  url: string;
  note: string;
  author: string;
  authorId?: string;
  /** Folder path such as "Guides/Maps"; "" is the top level. */
  folder: string;
  /** The level a member needs to open this item (leaders can raise it). 1 means everyone. */
  minLevel: number;
  /** True when the viewer's level is too low: the link and note are left out. */
  locked: boolean;
  createdAt: string;
};

export type PostPayload = {
  format?: "markdown";
  templateSourceId?: number;
  options?: string[];
  questions?: { q: string; choices: string[]; answer: number; /** Set by the server when the question has a picture (`/api/v1/media/post/<id>/<100 + question number>`). */ hasImage?: boolean }[];
  /** Quiz time limit in seconds for the whole quiz; missing or 0 means untimed. Kept by the server. */
  timeLimitSec?: number;
  /** Story only: one short caption per scene (scene 1 is the cover, then the album pictures). Cleaned by the server. */
  captions?: string[];
  category?: string;
  url?: string;
  /** How many extra pictures an image post has (set by the server; see `/api/v1/media/post/<id>/<n>`). */
  albumCount?: number;
};

export type AuthorChip = {
  userId: string;
  nickname: string;
  handle: string;
  hue: number;
  /** Profile photo version, 0 when the person has no photo. */
  avatarV: number;
};

export type Post = {
  id: number;
  communityId: string;
  author: AuthorChip;
  type: PostType;
  wikiStatus: "draft" | "pending" | "approved" | "rejected";
  wikiReviewNote: string;
  title: string;
  body: string;
  cover: string;
  payload: PostPayload;
  featured: boolean;
  pinned: boolean;
  hidden: boolean;
  announcement: boolean;
  commentsDisabled: boolean;
  hashtags: string[];
  originalPostId: number | null;
  editedAt: string | null;
  saved: boolean;
  contentWarning: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export type Comment = {
  id: number;
  postId: number;
  author: AuthorChip;
  body: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
};

export type ChatRoom = {
  id: number;
  communityId: string | null;
  name: string;
  kind: RoomKind;
  createdBy: string;
  inviteRule: "hosts" | "members";
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  voiceCount: number;
  watchUrl: string;
  watchTitle: string;
  peerName: string | null;
  peerHandle: string | null;
  peerHue: number;
  peerAvatarV: number;
  peerUserId: string | null;
  pinned: boolean;
  muted: boolean;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  author: AuthorChip;
  body: string;
  replyTo: number | null;
  bubbleHue: number;
  bubbleStyle: BubbleStyle;
  editedAt: string | null;
  deleted: boolean;
  mediaKind: "image" | "audio" | "video" | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  createdAt: string;
};

export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type Report = {
  id: number;
  reporterId: string;
  communityId: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};

export type HallEvent = {
  id: number;
  communityId: string;
  title: string;
  body: string;
  kind: "event" | "challenge";
  startsAt: string;
  endsAt: string | null;
  createdBy: string;
  rsvpCount: number;
  going: boolean;
  /** Challenges only: how many entries, whether the winners were picked, and the viewer's own entry. */
  entryCount: number;
  judged: boolean;
  myEntryPostId: number | null;
  /** Where a challenge is in its life: not started, taking entries, closed, or winners picked. */
  phase: ChallengePhase;
};

export type ChallengePhase = "upcoming" | "open" | "closed" | "judged";

export type RankBoard = "activity" | "streak" | "quiz";
export type RankPeriod = "week" | "month" | "all";
/** A leaderboard row. `score` is what the chosen board counts (points, streak days or quiz points). */
export type BoardRow = RankRow & { score: number };

export type ChallengeEntry = {
  postId: number;
  title: string;
  cover: string;
  author: AuthorChip;
  likeCount: number;
  /** 1, 2 or 3 once the leaders have picked winners. */
  placement: number | null;
  enteredAt: string;
};

export type InviteCode = {
  code: string;
  communityId: string;
  uses: number;
  maxUses: number;
  expiresAt: string | null;
  createdAt: string;
};

export type Strike = {
  id: number;
  communityId: string;
  userId: string;
  issuedBy: string;
  reason: string;
  createdAt: string;
};

export type JoinQuestion = {
  id: number;
  communityId: string;
  prompt: string;
  sortOrder: number;
};

export type Broadcast = {
  id: number;
  communityId: string;
  body: string;
  createdAt: string;
};

export type RankRow = {
  userId: string;
  nickname: string;
  handle: string;
  hue: number;
  avatarV: number;
  role: Role;
  rep: number;
  weekPosts: number;
  weekLikes: number;
  weekScore: number;
};

export const CATEGORIES = [
  "Anime",
  "Music",
  "Games",
  "Writing",
  "Art",
  "Roleplay",
  "Tabletop",
  "Film",
  "Science",
  "Lifestyle",
] as const;

export const REPORT_REASONS = [
  "Harassment",
  "Hate or threats",
  "Spam or scam",
  "Sexual content involving minors",
  "Non-consensual intimate content",
  "Self-harm",
  "Impersonation",
  "Off-topic / community rules",
] as const;

export const MOOD_PRESETS = [
  "watching",
  "drawing",
  "writing",
  "listening",
  "in character",
  "offline hours",
  "on a comeback",
  "lore diving",
] as const;

/** An item the automatic safety check held or flagged, waiting for a person to decide. */
export type SafetyFlag = {
  id: number;
  communityId: string | null;
  targetType: "post" | "comment" | "message" | "wall" | "roleplay" | "scene";
  targetId: string;
  authorId: string;
  authorName: string;
  /** "hold": hidden until someone decides. "flag": still visible. */
  action: "hold" | "flag";
  reasons: string[];
  /** Serious enough to reach the site owner too. */
  severe: boolean;
  /** Linked to minors: its pictures are locked and the site owner must follow the reporting steps in the guide. */
  minors: boolean;
  excerpt: string;
  href: string;
  status: "open" | "restored" | "removed" | "dismissed";
  createdAt: string;
};

/** What the server's AI can do right now (the apps hide or explain features accordingly). */
export type AiStatus = {
  /** The AI safety check (OpenAI's free moderation service) is set up. The built-in rules always run. */
  moderation: boolean;
  /** The AI storyteller for role-play is set up. */
  storyteller: boolean;
  /** Storyteller replies left today for the whole server. */
  repliesLeft: number;
};

export type RoleplayCharacter = { name: string; description: string; playedBy: { userId: string; name: string } | null };

export type RoleplaySceneSummary = {
  id: number;
  communityId: string;
  title: string;
  source: string;
  premise: string;
  status: "open" | "ended";
  castCount: number;
  turnCount: number;
  endingCount: number;
  creatorName: string;
  updatedAt: string;
};

export type RoleplayTurn = {
  id: number;
  /** "narration" and "ending" are written by the AI storyteller; "turn" by a member. */
  kind: "turn" | "narration" | "ending";
  character: string;
  author: { userId: string; name: string; hue: number; avatarV: number } | null;
  body: string;
  createdAt: string;
};

export type RoleplayScene = RoleplaySceneSummary & {
  creatorId: string;
  characters: RoleplayCharacter[];
  turns: RoleplayTurn[];
  /** The character the viewer plays, or null. */
  myCharacter: string | null;
  /** The viewer may end or delete the scene (its creator or a moderator). */
  canManage: boolean;
  canPlay: boolean;
};
