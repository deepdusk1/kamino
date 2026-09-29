import type {
  Achievement, AuthorChip, BoardRow, Broadcast, ChallengeEntry, Character, ChatMessage, ChatRoom, Comment, Community, HallEvent,
  InviteCode, JoinQuestion, MemberTitle, Membership, Notification, Post, Profile, RankBoard, RankPeriod, RankRow, Report,
  SharedItem, Strike, TitleDef, WallPost,
} from "./types";

/** Shapes of what the server answers. They mirror the server functions in web/src/lib/kamino. */

export type PostWithCommunity = Post & { communityName?: string };

export type Bootstrap = { profile: Profile | null; unread: number; joined: Community[] };
export type Discover = { communities: Community[]; joinedIds: string[] };
export type HomeFeed = {
  featured: PostWithCommunity[];
  latest: PostWithCommunity[];
  communities: Community[];
  joined: Community[];
};

export type CommunityPage = {
  community: Community;
  member: Membership | null;
  locked: boolean;
  posts: Post[];
  stories: Post[];
  rooms: ChatRoom[];
  members: Membership[];
  followingIds: string[];
  titleDefs: TitleDef[];
  grantedTitles: { userId: string; titles: MemberTitle[] }[];
  announcements: Post[];
  events: HallEvent[];
  broadcasts: Broadcast[];
  joinQuestions: JoinQuestion[];
};

export type PostPage = {
  community: Community;
  member: Membership | null;
  post: Post;
  comments: Comment[];
  poll: { options: string[]; counts: number[]; mine: number | null } | null;
  quizBoard: { nickname: string; score: number; total: number; timeMs: number }[];
  myQuiz: { score: number; total: number } | null;
  /** Set when the quiz was started but not handed in yet; the server keeps the clock. */
  quizRun: { startedAt: string; serverNow: string } | null;
  wikiPinned: boolean;
};

export type WikiPage = { community: Community; member: Membership | null; locked: boolean; entries: Post[] };
export type WikiRevision = { id: number; editorId?: string; title: string; body: string; createdAt: string };

export type RoomPage = {
  room: ChatRoom;
  messages: ChatMessage[];
  /** People currently in a voice room (raw column names, as the server sends them). */
  voices: { user_id: string; nickname: string }[];
  participants: { userId: string; name: string; handle: string; isHost: boolean; isCohost: boolean }[];
};

export type Me = {
  profile: Profile;
  /** Your communities, with your nickname, role and reputation in each (matches `getMe` on the server). */
  joined: { community: Community; nickname: string; role: string; hue: number; rep: number }[];
  /** People you blocked (raw column names, as the server sends them; the website uses the same shape). */
  blocked: { blocked_id: string; handle: string; display_name: string }[];
};

export type PublicProfile = {
  profile: Profile;
  joined: { id: string; name: string; cover: string; category: string; nickname: string; role: string }[];
  recent: Post[];
  pinnedWiki: Post[];
  blocked: boolean;
  isSelf: boolean;
  characters: Character[];
  titles: MemberTitle[];
  featuredTitle: MemberTitle | null;
  achievements: Achievement[];
  stats: { reputation: number; following: number; followers: number };
  viewerFollows: boolean;
  wall: (WallPost & { author: AuthorChip })[];
};

export type Moderation = {
  reports: Report[];
  pending: Membership[];
  audit: { id: number; actor_id: string; action: string; detail: string; created_at: string }[];
  role: string;
  communityModules: string[];
  titleDefs: TitleDef[];
  joinQuestions: JoinQuestion[];
  invites: InviteCode[];
  strikes: Strike[];
  joinAnswers: { userId: string; answers: string[] }[];
};

export type RankPage = { community: Community; rank: RankRow[] };
export type BoardPage = { community: Community; by: RankBoard; period: RankPeriod; rank: BoardRow[] };
export type CommunityCheckIn = { already: boolean; streak: number; bestStreak: number; rep: number };
export type MyPost = { id: number; title: string; type: string };
export type ChallengeEntries = { eventId: number; judged: boolean; entries: ChallengeEntry[] };
export type EventsPage = { community: Community; member: Membership | null; events: HallEvent[] };
export type ImportResult = { imported: number; skipped: number };
export type SharedPage = { member: Membership | null; items: SharedItem[] };
export type CheckIn = { already: boolean; streak: number; rep: number };

export type MyStanding = {
  status: "active" | "pending" | "banned" | "none";
  strikes: { id: number; reason: string; createdAt: string }[];
  mute: { until: string; reason: string } | null;
  appeals: { id: number; kind: string; status: string; decisionNote: string; createdAt: string }[];
};
export type AppealRow = {
  id: number; userId: string; name: string; handle: string; kind: string; message: string;
  status: string; decisionNote: string; createdAt: string;
};
export type WikiProposal = {
  id: number; proposerId: string; proposer: string; title: string; body: string; note: string;
  /** "open", "accepted" or "rejected". */
  status: string; createdAt: string;
};
export type FeedItem = { title: string; link: string; publishedAt: string | null; source: string };
export type NotificationRow = Notification;

/** What a saved draft holds. Mirrors `draftContentSchema` on the server. */
export type DraftContent = {
  type: "blog" | "image" | "question" | "link" | "poll" | "quiz" | "wiki" | "story";
  title: string;
  body: string;
  url: string;
  warning: string;
  opts: string[]; // always exactly 5 entries (blank ones are ignored)
  image: string;
  /** More pictures for an image post (the cover is `image`). Missing on older drafts. */
  album?: string[];
  commentsOff: boolean;
  announce: boolean;
  questions: { q: string; choices: string[]; answer: number; /** A picture shown with the question (data URL). */ image?: string }[];
  /** Whole-quiz time limit in seconds; empty or 0 means untimed. */
  timeLimitSec?: number;
  /** Story only: one short caption per scene. */
  captions?: string[];
};
export type Draft = { id: string; slug: string; content: DraftContent; revision: number; updatedAt: string };

export type SearchResults = {
  query: string;
  communities: Community[];
  posts: PostWithCommunity[];
  people: { userId: string; handle: string; displayName: string; hue: number; avatarV: number; rep: number }[];
};

/** A network server for calls (STUN finds a route; TURN relays when there is none). */
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
/** Someone is calling a room you are in. Only rings for 45 seconds. */
export type IncomingCall = { id: number; name: string; body: string; href: string; createdAt: string };
