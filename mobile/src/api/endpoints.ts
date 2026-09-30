import { rpc } from "./client";
import type * as M from "./models";
import type { AiStatus, PostPayload, PostType, RankBoard, RankPeriod, RoleplayScene, RoleplaySceneSummary, RoomKind, SafetyFlag } from "./types";

/**
 * One typed function per server call. Screens use `api.something()` and never build
 * request bodies by hand, so a wrong argument is a compile error rather than a bug.
 */
export const api = {
  // ── Session & discovery ──────────────────────────────────────────────────
  bootstrap: () => rpc<M.Bootstrap>("bootstrap"),
  homeFeed: () => rpc<M.HomeFeed>("homeFeed"),
  discover: () => rpc<M.Discover>("listDiscover"),
  search: (q: string) => rpc<M.SearchResults>("searchAll", q),
  checkIn: () => rpc<M.CheckIn>("checkIn"),
  /** The 13+ birthday check. The date is compared once on the server and never saved. */
  confirmAge: (input: { year: number; month: number; day: number }) => rpc<{ ok: boolean }>("confirmMinimumAge", input),

  // ── Communities ──────────────────────────────────────────────────────────
  community: (slug: string) => rpc<M.CommunityPage>("getCommunityPage", { slug }),
  join: (input: { slug: string; nickname?: string; answers?: string[]; invite?: string }) =>
    rpc<{ ok: boolean; pending: boolean }>("joinCommunity", input),
  leave: (slug: string) => rpc<unknown>("leaveCommunity", slug),
  createCommunity: (input: {
    name: string; tagline: string; description: string; category: string;
    visibility: "public" | "private" | "unlisted"; ageGate: number; rules: string;
  }) => rpc<{ id: string }>("createCommunity", input),
  updatePersona: (input: { slug: string; nickname: string; personaBio: string }) => rpc<unknown>("updatePersona", input),
  rank: (slug: string) => rpc<M.RankPage>("weeklyRank", slug),
  /** Leaderboard by activity, check-in streak or quiz points, over a week, a month or all time. */
  board: (slug: string, by: RankBoard, period: RankPeriod) => rpc<M.BoardPage>("communityRank", { slug, by, period }),
  checkInCommunity: (slug: string) => rpc<M.CommunityCheckIn>("checkInCommunity", { slug }),
  myPostsIn: (slug: string) => rpc<M.MyPost[]>("listMyPostsIn", slug),
  challengeEntries: (eventId: number) => rpc<M.ChallengeEntries>("listChallengeEntries", eventId),
  enterChallenge: (eventId: number, postId: number) => rpc<unknown>("enterChallenge", { eventId, postId }),
  judgeChallenge: (eventId: number, winners: { postId: number; place: 1 | 2 | 3 }[]) => rpc<unknown>("judgeChallenge", { eventId, winners }),
  events: (slug: string) => rpc<M.EventsPage>("listEvents", slug),
  createEvent: (input: { slug: string; title: string; body: string; kind: "event" | "challenge"; startsAt: string; endsAt?: string }) =>
    rpc<unknown>("createEvent", input),
  rsvp: (slug: string, eventId: number) => rpc<unknown>("rsvpEvent", { slug, eventId }),
  shared: (slug: string) => rpc<M.SharedPage>("listShared", slug),
  addShared: (input: { slug: string; title: string; url?: string; note?: string; folder?: string; minLevel?: number }) => rpc<unknown>("addShared", input),
  moveShared: (input: { slug: string; id: number; folder: string; minLevel?: number }) => rpc<unknown>("moveShared", input),
  deleteShared: (slug: string, id: number) => rpc<unknown>("deleteShared", { slug, id }),
  follow: (slug: string, userId: string) => rpc<unknown>("followMember", { slug, userId }),

  // ── Posts ────────────────────────────────────────────────────────────────
  post: (slug: string, postId: number) => rpc<M.PostPage>("getPostPage", { slug, postId }),
  createPost: (input: {
    slug: string; type: PostType; title: string; body: string; cover?: string; album?: string[]; questionImages?: string[]; payload?: PostPayload;
    contentWarning?: string; commentsDisabled?: boolean; announcement?: boolean;
  }) => rpc<{ id: number; held: boolean }>("createPost", input),
  updateLook: (input: {
    slug: string; name?: string; tagline?: string; description?: string; rules?: string; hue?: number; themeStyle?: string;
    cover?: string; coverUpload?: string; iconUpload?: string | null;
  }) => rpc<{ ok: boolean; cover: string; icon: string }>("updateCommunityLook", input),
  drafts: (slug: string) => rpc<M.Draft[]>("listDrafts", slug),
  saveDraft: (input: { id: string; slug: string; revision: number; content: M.DraftContent }) =>
    rpc<{ id: string; revision: number }>("saveDraft", input),
  deleteDraft: (id: string, revision: number) => rpc<unknown>("deleteDraft", { id, revision }),
  editPost: (input: { slug: string; postId: number; title: string; body: string }) => rpc<{ ok: boolean; held: boolean }>("editPost", input),
  deletePost: (slug: string, postId: number) => rpc<unknown>("deletePost", { slug, postId }),
  like: (postId: number) => rpc<unknown>("toggleLike", postId),
  save: (postId: number) => rpc<unknown>("toggleFavorite", postId),
  saved: () => rpc<M.PostWithCommunity[]>("listFavorites"),
  comment: (postId: number, body: string) => rpc<{ ok: boolean; held: boolean }>("addComment", { postId, body }),
  likeComment: (commentId: number) => rpc<unknown>("toggleCommentLike", commentId),
  vote: (postId: number, optionIndex: number) => rpc<unknown>("votePoll", { postId, optionIndex }),
  /** Starts the server's clock for a quiz (safe to repeat: the first start is kept). */
  startQuiz: (postId: number) =>
    rpc<{ startedAt: string; serverNow: string; timeLimitSec: number }>("startQuiz", { postId }),
  submitQuiz: (postId: number, answers: number[]) =>
    rpc<{ score: number; total: number; timedOut: boolean }>("submitQuiz", { postId, answers }),
  repost: (slug: string, postId: number, note?: string) => rpc<unknown>("repost", { slug, postId, note }),
  setPostFlags: (input: { slug: string; postId: number; commentsDisabled?: boolean; pinned?: boolean; hidden?: boolean; announcement?: boolean }) =>
    rpc<unknown>("setPostFlags", input),
  featurePost: (slug: string, postId: number) => rpc<unknown>("featurePost", { slug, postId }),
  report: (input: { communityId?: string; targetType: string; targetId: string; reason: string; details?: string }) =>
    rpc<unknown>("fileReport", input),

  // ── Wiki ─────────────────────────────────────────────────────────────────
  wiki: (slug: string) => rpc<M.WikiPage>("getWiki", slug),
  wikiCategories: (slug: string) => rpc<string[]>("getWikiCategories", slug),
  setWikiCategories: (slug: string, paths: string[]) => rpc<{ paths: string[] }>("setWikiCategories", { slug, paths }),
  submitWiki: (postId: number) => rpc<unknown>("submitWiki", postId),
  reviewWiki: (postId: number, decision: "approved" | "rejected", note?: string) =>
    rpc<unknown>("reviewWiki", { postId, decision, note }),
  copyWiki: (postId: number) => rpc<unknown>("copyWikiTemplate", postId),
  pinWiki: (postId: number) => rpc<unknown>("toggleWikiProfilePin", postId),
  wikiRevisions: (postId: number) => rpc<M.WikiRevision[]>("listWikiRevisions", postId),
  restoreWikiRevision: (postId: number, revisionId: number) => rpc<unknown>("restoreWikiRevision", { postId, revisionId }),
  proposeWikiEdit: (input: { postId: number; title: string; body: string; note?: string }) => rpc<unknown>("proposeWikiEdit", input),
  wikiProposals: (postId: number) => rpc<{ canReview: boolean; proposals: M.WikiProposal[] }>("listWikiProposals", postId),
  resolveWikiProposal: (proposalId: number, decision: "accepted" | "rejected") =>
    rpc<unknown>("resolveWikiProposal", { proposalId, decision }),
  wikiContributors: (postId: number) => rpc<{ userId: string; name: string; handle: string }[]>("getWikiContributors", postId),

  // ── Feeds ────────────────────────────────────────────────────────────────
  feeds: (slug: string) => rpc<{ id: number; url: string; title: string }[]>("listFeeds", slug),
  readFeeds: (slug: string) => rpc<{ items: M.FeedItem[] }>("readFeeds", slug),
  addFeed: (slug: string, url: string) => rpc<{ title: string }>("addFeed", { slug, url }),
  removeFeed: (slug: string, feedId: number) => rpc<unknown>("removeFeed", { slug, feedId }),

  // ── Chat ─────────────────────────────────────────────────────────────────
  rooms: () => rpc<import("./types").ChatRoom[]>("listRooms"),
  room: (roomId: number, afterId?: number) => rpc<M.RoomPage>("getRoom", { roomId, afterId }),
  olderMessages: (roomId: number, beforeId: number) => rpc<import("./types").ChatMessage[]>("getOlderMessages", { roomId, beforeId }),
  searchMessages: (roomId: number, query: string) => rpc<import("./types").ChatMessage[]>("searchRoomMessages", { roomId, query }),
  send: (input: { roomId: number; body: string; replyTo?: number | null; media?: { kind: "image" | "audio" | "video"; dataUrl: string } }) =>
    rpc<{ id: number; held: boolean }>("sendMessage", input),
  editMessage: (roomId: number, messageId: number, body: string) => rpc<{ ok: boolean; held: boolean }>("editMessage", { roomId, messageId, body }),
  deleteMessage: (roomId: number, messageId: number) => rpc<unknown>("deleteMessage", { roomId, messageId }),
  react: (roomId: number, messageId: number, emoji: string) => rpc<unknown>("toggleMessageReaction", { roomId, messageId, emoji }),
  roomPreference: (roomId: number, prefs: { pinned?: boolean; muted?: boolean }) => rpc<unknown>("setRoomPreference", { roomId, ...prefs }),
  openDm: (targetId: string) => rpc<{ roomId: number }>("openDm", targetId),
  createRoom: (slug: string, name: string, kind: Extract<RoomKind, "public" | "voice" | "screening" | "private">) =>
    rpc<{ id: number }>("createRoom", { slug, name, kind }),
  inviteToRoom: (roomId: number, handle: string) => rpc<unknown>("inviteToRoom", { roomId, handle }),
  setInviteRule: (roomId: number, rule: "hosts" | "members") => rpc<unknown>("setRoomInviteRule", { roomId, rule }),
  toggleCohost: (roomId: number, targetUserId: string) => rpc<unknown>("toggleRoomCohost", { roomId, targetUserId }),
  transferHost: (roomId: number, targetUserId: string) => rpc<unknown>("transferRoomHost", { roomId, targetUserId }),

  // ── People & profile ─────────────────────────────────────────────────────
  me: () => rpc<M.Me>("getMe"),
  profile: (handle: string) => rpc<M.PublicProfile>("getPublicProfile", handle),
  updateSettings: (patch: Partial<Omit<import("./types").Profile, "userId" | "handle" | "avatarHue" | "lastSeenAt" | "rep" | "streak" | "lastCheckinAt" | "createdAt">>) =>
    rpc<unknown>("updateSettings", patch),
  setAvatar: (dataUrl: string) => rpc<unknown>("setAvatar", { dataUrl }),
  removeAvatar: () => rpc<unknown>("removeAvatar", {}),
  followProfile: (targetId: string) => rpc<unknown>("toggleFollowProfile", targetId),
  block: (targetId: string) => rpc<unknown>("blockUser", targetId),
  addWallPost: (handle: string, body: string) => rpc<{ ok: boolean; held: boolean }>("addWallPost", { handle, body }),
  /** Your own picture as your profile's wall cover. */
  setProfileCover: (dataUrl: string) => rpc<{ cover: string }>("setProfileCover", { dataUrl }),
  removeProfileCover: () => rpc<{ ok: boolean }>("removeProfileCover", {}),
  /** Up to three unlocked achievements shown as banners on your profile (empty = chosen automatically). */
  setShowcase: (ids: string[]) => rpc<{ ids: string[] }>("setShowcase", { ids }),
  deleteWallPost: (id: number) => rpc<unknown>("deleteWallPost", id),
  likeWallPost: (id: number) => rpc<unknown>("toggleWallLike", id),
  exportData: () => rpc<{ json: string }>("exportMyData"),
  importData: (json: string) => rpc<M.ImportResult>("importMyData", { json }),
  deleteAccount: () => rpc<unknown>("deleteMyAccount", { confirm: "DELETE" }),

  // ── Notifications & push ─────────────────────────────────────────────────
  notifications: () => rpc<M.NotificationRow[]>("listNotifications"),

  // ── AI: safety queue and role-play stories ──────────────────────────────
  aiStatus: () => rpc<AiStatus>("getAiStatus"),
  safetyFlags: (slug: string) => rpc<SafetyFlag[]>("listSafetyFlags", { slug }),
  reviewSafetyFlag: (id: number, decision: "restore" | "remove" | "dismiss") =>
    rpc<{ ok: boolean; status: string }>("reviewSafetyFlag", { id, decision }),
  scenes: (slug: string) => rpc<RoleplaySceneSummary[]>("listScenes", { slug }),
  scene: (sceneId: number) => rpc<RoleplayScene>("getScene", { sceneId }),
  draftScene: (slug: string, idea: string, source?: string) =>
    rpc<{ source: string; title: string; premise: string; characters: { name: string; description: string }[]; opening: string }>("draftScene", { slug, idea, source }),
  createScene: (input: {
    slug: string; title: string; source?: string; premise: string; characters: { name: string; description: string }[]; opening?: string; playAs?: string;
  }) => rpc<{ id: number; held: boolean; aiError: string | null }>("createScene", input),
  joinScene: (sceneId: number, character: string) => rpc<{ character: string }>("joinScene", { sceneId, character }),
  leaveScene: (sceneId: number) => rpc<{ ok: boolean }>("leaveScene", { sceneId }),
  addTurn: (sceneId: number, body: string, narrate = true) =>
    rpc<{ id: number; held: boolean; aiError: string | null }>("addTurn", { sceneId, body, narrate }),
  continueScene: (sceneId: number, nudge?: string) => rpc<{ ok: boolean }>("continueScene", { sceneId, nudge }),
  writeEnding: (sceneId: number, direction: string) => rpc<{ ok: boolean }>("writeEnding", { sceneId, direction }),
  endScene: (sceneId: number) => rpc<{ ok: boolean }>("endScene", { sceneId }),
  deleteScene: (sceneId: number) => rpc<{ ok: boolean }>("deleteScene", { sceneId }),

  // ── Calls ────────────────────────────────────────────────────────────────
  iceServers: () => rpc<M.IceServer[]>("getIceServers"),
  /** Marks you as present in the room's call (the website shows this in the room). */
  setVoice: (roomId: number, on: boolean) => rpc<{ inVoice: boolean }>("toggleVoice", { roomId, on }),
  /** Notifies everyone else in the room that you are calling. */
  ringCall: (roomId: number) => rpc<{ ok: boolean; name: string }>("ringCall", roomId),
  endCall: (roomId: number) => rpc<{ ok: boolean }>("endCall", roomId),
  incomingCalls: () => rpc<M.IncomingCall[]>("listIncomingCalls"),
  dismissNotification: (id: number) => rpc<{ ok: boolean }>("dismissNotification", id),
  markNotificationsRead: () => rpc<unknown>("markNotificationsRead"),
  registerPush: (token: string, platform: "ios" | "android" | "web" | "unknown") => rpc<unknown>("registerPushToken", { token, platform }),
  unregisterPush: (token: string) => rpc<unknown>("unregisterPushToken", token),

  // ── Moderation ───────────────────────────────────────────────────────────
  moderation: (slug: string) => rpc<M.Moderation>("getModeration", slug),
  resolveReport: (slug: string, id: number, status: "resolved" | "dismissed") => rpc<unknown>("resolveReport", { slug, id, status }),
  reviewJoin: (slug: string, userId: string, allow: boolean) => rpc<unknown>("reviewJoin", { slug, userId, allow }),
  setMemberRole: (slug: string, userId: string, action: "curator" | "member" | "ban" | "unban") =>
    rpc<unknown>("setMemberRole", { slug, userId, action }),
  strike: (slug: string, userId: string, reason: string) => rpc<{ count: number; banned: boolean }>("issueStrike", { slug, userId, reason }),
  mute: (slug: string, userId: string, hours: number, reason: string) => rpc<{ until: string }>("issueMute", { slug, userId, hours, reason }),
  clearMute: (slug: string, userId: string) => rpc<unknown>("clearMute", { slug, userId }),
  standing: (slug: string) => rpc<M.MyStanding>("getMyStanding", slug),
  appeal: (slug: string, kind: "strike" | "mute" | "ban", message: string) => rpc<unknown>("fileAppeal", { slug, kind, message }),
  appeals: (slug: string) => rpc<M.AppealRow[]>("listAppeals", slug),
  resolveAppeal: (slug: string, appealId: number, decision: "upheld" | "overturned", note?: string) =>
    rpc<unknown>("resolveAppeal", { slug, appealId, decision, note }),
  broadcast: (slug: string, body: string) => rpc<unknown>("sendBroadcast", { slug, body }),
  createInvite: (slug: string, maxUses?: number) => rpc<{ code: string }>("createInvite", { slug, maxUses }),
  setJoinQuestions: (slug: string, prompts: string[]) => rpc<unknown>("setJoinQuestions", { slug, prompts }),
  setModules: (slug: string, modules: import("./types").CommunityModule[]) => rpc<unknown>("updateCommunityModules", { slug, modules }),
};
