import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Coins,
  Ellipsis,
  Flag,
  Heart,
  MessageCircle,
  Phone,
  Plus,
  Share2,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AvatarFrame } from "@/components/avatar-frame";
import { Face } from "@/components/face";
import { PostCard } from "@/components/post-card";
import { TitleChip } from "@/components/title-chip";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isOnline } from "@/lib/kamino/hashtags";
import {
  addWallPost,
  blockUser,
  deleteCharacter,
  deleteWallPost,
  fileReport,
  getPublicProfile,
  hideTitle,
  listFollows,
  openDm,
  ringCall,
  pinTitle,
  saveCharacter,
  toggleFollowProfile,
  toggleLike,
  toggleFavorite,
  toggleWallLike,
  tipMember,
  updateSettings,
} from "@/lib/kamino/server";
import { PROFILE_COVERS } from "@/lib/kamino/titles";
import { REPORT_REASONS } from "@/lib/kamino/types";
import type { Achievement, MemberTitle } from "@/lib/kamino/types";
import { cn, levelFromRep, timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/u/$handle")({
  loader: ({ params }) => getPublicProfile({ data: params.handle }),
  component: Profile,
});

function memberDays(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function Profile() {
  const { handle } = Route.useParams();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["profile", handle],
    queryFn: () => getPublicProfile({ data: handle }),
    initialData: Route.useLoaderData(),
  });
  const [tab, setTab] = useState<"posts" | "wall" | "halls" | "ocs">("posts");
  const [achOn, setAchOn] = useState(false);
  const [people, setPeople] = useState<"followers" | "following" | null>(null);
  const [wallBody, setWallBody] = useState("");
  const [coverOn, setCoverOn] = useState(false);
  const [menuOn, setMenuOn] = useState(false);
  const [reportOn, setReportOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipBusy, setTipBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (q.error) {
    return (
      <AppShell title="Profile">
        <p className="px-4 py-12 text-center text-sm text-muted">{(q.error as Error).message}</p>
      </AppShell>
    );
  }
  const data = q.data;
  if (!data) {
    return (
      <AppShell title="Profile">
        <p className="px-4 py-12 text-center text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }
  const p = data.profile;
  const level = levelFromRep(p.rep);
  const featured = data.featuredTitle as MemberTitle | null;
  const titles = (data.titles ?? []).filter((t: MemberTitle) => (data.isSelf ? true : !t.hidden));
  const chipTitles = titles.filter((t: MemberTitle) => !t.pinned);
  const unlocked =
    (data.achievements as Achievement[] | undefined)?.filter((a) => a.unlocked) ?? [];
  const cover = p.cover || data.joined[0]?.cover || "/covers/hero.jpg";
  const days = memberDays(p.createdAt);
  const online = isOnline(p.lastSeenAt, p.showOnline);

  async function follow() {
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    await toggleFollowProfile({ data: p.userId });
    void q.refetch();
  }

  return (
    <AppShell title={p.displayName}>
      <div className="relative">
        <img src={cover} alt="" className="h-52 w-full object-cover md:h-64" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
        <button
          type="button"
          className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-bg/55 text-fg backdrop-blur-sm"
          aria-label="More"
          onClick={() => setMenuOn((v) => !v)}
        >
          <Ellipsis className="size-5" />
        </button>
        {menuOn && (
          <div className="absolute top-16 right-3 z-20 w-44 overflow-hidden rounded-2xl bg-surface shadow-border">
            <button
              type="button"
              className="flex h-11 w-full items-center gap-2 px-3 text-sm font-bold"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                setMenuOn(false);
              }}
            >
              <Share2 className="size-4" /> Share
            </button>
            {data.isSelf ? (
              <Link
                to="/saved"
                className="flex h-11 items-center gap-2 px-3 text-sm font-bold"
                onClick={() => setMenuOn(false)}
              >
                <Bookmark className="size-4" /> Saved
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="flex h-11 w-full items-center gap-2 px-3 text-sm font-bold"
                  onClick={() => {
                    setMenuOn(false);
                    setReportOn(true);
                  }}
                >
                  <Flag className="size-4" /> Report
                </button>
                {user && (
                  <button
                    type="button"
                    className="flex h-11 w-full items-center gap-2 px-3 text-sm font-bold text-danger"
                    onClick={() =>
                      void blockUser({ data: p.userId }).then(() => {
                        setMenuOn(false);
                        void q.refetch();
                      })
                    }
                  >
                    {data.blocked ? "Unblock" : "Block"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-2">
          <AvatarFrame frame={p.frame} online={online}>
            <Face name={p.displayName} hue={p.avatarHue} size="hero" className="relative" />
          </AvatarFrame>
        </div>
      </div>

      <div className="px-4 pt-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{p.displayName}</h1>
          {featured && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1">
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-extrabold text-accent-fg">
                lv{level}
              </span>
              <span className="text-xs font-extrabold" style={{ color: featured.color }}>
                {featured.label}
              </span>
            </span>
          )}
          {!featured && (
            <span className="rounded-full bg-accent px-1.5 text-[10px] font-extrabold text-accent-fg">
              lv{level}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-muted">@{p.handle}</p>
        {(p.mood || p.status) && (
          <p className="mt-1 text-sm text-muted">
            {p.mood ? <span className="font-extrabold text-accent">{p.mood}</span> : null}
            {p.mood && p.status ? " · " : null}
            {p.status}
          </p>
        )}
        <p className="mt-1 text-[11px] font-semibold text-subtle">
          {online
            ? "Online now"
            : p.showOnline && p.lastSeenAt
              ? `Last seen ${timeAgo(p.lastSeenAt)}`
              : "Last seen hidden"}
        </p>

        {chipTitles.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {chipTitles.map((t: MemberTitle) => (
              <TitleChip
                key={t.id}
                label={t.label}
                color={t.color}
                hall={t.communityName}
                pinned={t.pinned}
                onClick={
                  data.isSelf
                    ? () => {
                        void pinTitle({ data: t.id }).then(() => q.refetch());
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
        {data.isSelf && titles.length > 0 && (
          <p className="mt-1 text-[11px] text-subtle">
            Tap a title to pin it under your name. Leaders grant these in a hall.
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-2">
          {data.isSelf ? (
            <>
              <Link to="/settings">
                <Button variant="secondary">Edit profile</Button>
              </Link>
              <Link to="/saved">
                <Button variant="secondary" size="icon" aria-label="Saved">
                  <Bookmark className="size-5" />
                </Button>
              </Link>
              <Link to="/wallet">
                <Button variant="secondary" className="gap-1.5">
                  <Coins className="size-4" /> Coins
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setCoverOn(true)}
                aria-label="Change cover"
              >
                <Plus className="size-5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                className="min-w-36 bg-follow font-extrabold tracking-wide text-follow-fg hover:opacity-90"
                disabled={busy}
                onClick={() => void follow()}
              >
                {data.viewerFollows ? "Following" : "Follow"}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                disabled={!user}
                aria-label="Message"
                className="relative"
                onClick={() =>
                  void openDm({ data: p.userId })
                    .then((r) =>
                      navigate({ to: "/chats/$roomId", params: { roomId: String(r.roomId) } }),
                    )
                    .catch((e) => alert(e instanceof Error ? e.message : "Could not open DM"))
                }
              >
                <MessageCircle className="size-5" />
                <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-extrabold text-accent-fg">
                  +
                </span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                disabled={!user}
                aria-label="Call"
                onClick={() =>
                  void openDm({ data: p.userId })
                    .then(async (r) => {
                      await ringCall({ data: r.roomId }).catch(() => undefined);
                      sessionStorage.setItem("kamino-call", String(r.roomId));
                      await navigate({
                        to: "/chats/$roomId",
                        params: { roomId: String(r.roomId) },
                      });
                    })
                    .catch((e) => alert(e instanceof Error ? e.message : "Could not start call"))
                }
              >
                <Phone className="size-5" />
              </Button>
              <Button
                variant="secondary"
                disabled={!user}
                onClick={() => setTipOpen((v) => !v)}
                className="gap-1.5"
              >
                <Coins className="size-4" /> Tip
              </Button>
            </>
          )}
        </div>
        {tipOpen && !data.isSelf && (
          <form
            className="mx-auto mt-3 flex max-w-sm flex-wrap items-center justify-center gap-2 rounded-2xl border border-white bg-white/85 p-3 shadow-lg"
            onSubmit={async (event) => {
              event.preventDefault();
              setTipBusy(true);
              try {
                await tipMember({ data: { targetUserId: p.userId, amount: tipAmount } });
                toast.success(`Sent ${tipAmount} coins to ${p.displayName}!`);
                setTipOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not send tip.");
              } finally {
                setTipBusy(false);
              }
            }}
          >
            <label htmlFor="tip-amount" className="text-xs font-bold">
              Coins to send
            </label>
            <input
              id="tip-amount"
              type="number"
              min="1"
              max="100"
              step="1"
              required
              value={tipAmount}
              onChange={(event) => setTipAmount(Number(event.target.value))}
              className="w-20 rounded-xl border border-border bg-white px-2 py-1.5 text-sm"
            />
            <Button size="sm" type="submit" disabled={tipBusy}>
              Send tip
            </Button>
            <Link to="/wallet" className="text-xs font-bold text-accent">
              My coins
            </Link>
          </form>
        )}
      </div>

      <button
        type="button"
        onClick={() => setAchOn((v) => !v)}
        className="mx-4 mt-5 flex w-[calc(100%-2rem)] items-center justify-between rounded-xl bg-gradient-to-r from-[#c9a227] to-[#f5c15c] px-4 py-2.5 text-left text-[#1a1408]"
      >
        <span className="inline-flex items-center gap-2 text-sm font-extrabold">
          <Trophy className="size-4" />
          Achievements
        </span>
        <span className="text-sm font-extrabold tabular-nums">
          {unlocked.length}/{data.achievements?.length ?? 0}
        </span>
      </button>
      {achOn && (
        <ul className="mx-4 mt-2 grid grid-cols-2 gap-2">
          {(data.achievements as Achievement[]).map((a) => (
            <li
              key={a.id}
              className={cn(
                "rounded-xl bg-surface px-3 py-2.5 shadow-border",
                !a.unlocked && "opacity-40",
              )}
            >
              <p className="text-sm font-extrabold">{a.name}</p>
              <p className="text-[11px] text-muted">{a.desc}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-3 border-y border-border py-3 text-center">
        <div>
          <p className="font-display text-xl font-extrabold tabular-nums">
            {data.stats?.reputation ?? p.rep}
          </p>
          <p className="text-[11px] font-bold tracking-wide text-subtle uppercase">Reputation</p>
        </div>
        <button type="button" onClick={() => setPeople("following")}>
          <p className="font-display text-xl font-extrabold tabular-nums">
            {data.stats?.following ?? 0}
          </p>
          <p className="text-[11px] font-bold tracking-wide text-subtle uppercase">Following</p>
        </button>
        <button type="button" onClick={() => setPeople("followers")}>
          <p className="font-display text-xl font-extrabold tabular-nums">
            {data.stats?.followers ?? 0}
          </p>
          <p className="text-[11px] font-bold tracking-wide text-subtle uppercase">Followers</p>
        </button>
      </div>

      <div className="px-4 py-4">
        <p className="text-xs font-bold tracking-wide text-subtle uppercase">Bio</p>
        <p className="mt-1 text-sm">{p.bio || "No bio yet."}</p>
        <p className="mt-1 text-sm text-muted">Member for {days} days</p>
        {p.streak > 0 && (
          <p className="mt-1 text-xs font-semibold text-accent">{p.streak}-day check-in</p>
        )}
      </div>

      {data.pinnedWiki.length > 0 && (
        <section className="px-4 pb-5">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark className="size-4 text-accent" />
            <h2 className="font-display text-base font-bold">Pinned wiki pages</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.pinnedWiki.map((wiki) => (
              <Link
                key={wiki.id}
                to="/c/$slug/p/$postId"
                params={{ slug: wiki.communityId, postId: String(wiki.id) }}
                className="glass-card group rounded-2xl p-4 transition-transform hover:-translate-y-1"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-accent">
                  Community wiki
                </p>
                <p className="mt-1 font-display text-lg font-bold group-hover:text-accent">
                  {wiki.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{wiki.body}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="sticky top-14 z-10 flex border-b border-border bg-bg/90 backdrop-blur-sm">
        {(
          [
            { id: "posts", label: `Posts ${data.recent.length}` },
            { id: "wall", label: `Wall ${data.wall?.length ?? 0}` },
            { id: "halls", label: "Halls" },
            { id: "ocs", label: "OCs" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "h-11 flex-1 text-sm font-extrabold",
              tab === t.id ? "amino-tab-active text-accent" : "text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "posts" && (
        <div>
          {data.recent.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={async (id) => {
                await toggleLike({ data: id });
                await q.refetch();
              }}
              onSave={async (id) => {
                await toggleFavorite({ data: id });
                await q.refetch();
              }}
            />
          ))}
          {data.recent.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted">Nothing public yet.</p>
          )}
        </div>
      )}

      {tab === "wall" && (
        <div className="px-4 py-4">
          {!data.isSelf && user && (
            <form
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!wallBody.trim()) return;
                setBusy(true);
                setErr(null);
                void addWallPost({ data: { handle, body: wallBody } })
                  .then(() => {
                    setWallBody("");
                    void q.refetch();
                  })
                  .catch((e) => setErr(e instanceof Error ? e.message : "Could not post"))
                  .finally(() => setBusy(false));
              }}
            >
              <input
                value={wallBody}
                onChange={(e) => setWallBody(e.target.value)}
                placeholder="Write on their wall"
                className="h-11 flex-1 rounded-full bg-elevated px-4 text-sm"
              />
              <Button type="submit" disabled={busy}>
                Send
              </Button>
            </form>
          )}
          {err ? <p className="mb-2 text-sm text-danger">{err}</p> : null}
          <ul className="space-y-3">
            {(data.wall ?? []).map((w) => (
              <li key={w.id} className="flex gap-3 rounded-2xl bg-surface p-3 shadow-border">
                <Link to="/u/$handle" params={{ handle: w.author.handle }}>
                  <Face name={w.author.nickname} hue={w.author.hue} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {w.author.nickname}{" "}
                    <span className="font-semibold text-subtle">{timeAgo(w.createdAt)}</span>
                  </p>
                  <p className="text-sm text-muted">{w.body}</p>
                  <button
                    type="button"
                    className={cn(
                      "mt-1 inline-flex h-8 items-center gap-1 text-xs font-bold text-muted",
                      w.liked && "text-accent",
                    )}
                    onClick={() => void toggleWallLike({ data: w.id }).then(() => q.refetch())}
                  >
                    <Heart className={cn("size-3.5", w.liked && "fill-accent")} />
                    {w.likeCount}
                  </button>
                </div>
                {(data.isSelf || user?.id === w.author.userId) && (
                  <button
                    type="button"
                    className="text-xs text-subtle"
                    onClick={() => void deleteWallPost({ data: w.id }).then(() => q.refetch())}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {(data.wall ?? []).length === 0 && (
            <p className="py-12 text-center text-sm text-muted">Wall is quiet. Leave a note.</p>
          )}
        </div>
      )}

      {tab === "halls" && (
        <div className="flex gap-3 overflow-x-auto px-4 py-4">
          {data.joined.map((c) => (
            <Link
              key={c.id}
              to="/c/$slug"
              params={{ slug: c.id }}
              className="w-36 shrink-0 overflow-hidden rounded-2xl bg-surface shadow-border"
            >
              <img src={c.cover} alt="" className="h-16 w-full object-cover" />
              <p className="truncate px-3 py-2 text-xs font-bold">
                {c.nickname} · {c.name}
              </p>
            </Link>
          ))}
          {data.joined.length === 0 && (
            <p className="py-8 text-sm text-muted">No public halls listed.</p>
          )}
        </div>
      )}

      {tab === "ocs" && (
        <div className="px-4 py-4">
          <OcLibrary
            mine={data.isSelf}
            characters={data.characters ?? []}
            onChange={() => void q.refetch()}
          />
        </div>
      )}

      {!data.isSelf && user && (
        <button
          type="button"
          onClick={() => setTab("wall")}
          className="fixed right-4 bottom-24 z-20 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-lg md:bottom-6"
          aria-label="Write on wall"
        >
          <Plus className="size-7" strokeWidth={2.2} />
        </button>
      )}

      {people && <FollowSheet handle={handle} kind={people} onClose={() => setPeople(null)} />}

      {coverOn && data.isSelf && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <div className="w-full max-w-lg rounded-t-2xl bg-surface p-5 md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Cover</h2>
              <Button variant="ghost" size="sm" onClick={() => setCoverOn(false)}>
                Close
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PROFILE_COVERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    void updateSettings({ data: { cover: c.src } }).then(() => {
                      setCoverOn(false);
                      void q.refetch();
                    });
                  }}
                  className={cn(
                    "overflow-hidden rounded-xl",
                    p.cover === c.src && "outline outline-2 outline-accent",
                  )}
                >
                  <img src={c.src} alt={c.label} className="h-16 w-full object-cover" />
                </button>
              ))}
            </div>
            {data.isSelf && titles.some((t: MemberTitle) => t.hidden) && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-subtle uppercase">Hidden titles</p>
                {titles
                  .filter((t: MemberTitle) => t.hidden)
                  .map((t: MemberTitle) => (
                    <button
                      key={t.id}
                      type="button"
                      className="mr-1 text-xs text-muted"
                      onClick={() => void hideTitle({ data: t.id }).then(() => q.refetch())}
                    >
                      Show {t.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {reportOn && (
        <div
          className="fixed inset-0 z-40 grid place-items-end bg-bg/70 md:place-items-center md:p-6"
          onClick={() => setReportOn(false)}
        >
          <form
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-surface p-5 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void fileReport({
                data: {
                  targetType: "user",
                  targetId: p.userId,
                  reason: String(fd.get("reason")),
                  details: String(fd.get("details") || ""),
                },
              }).then(() => setReportOn(false));
            }}
          >
            <h2 className="font-display text-lg font-extrabold">Report {p.displayName}</h2>
            <select name="reason" className="h-11 w-full rounded-lg bg-elevated px-3 text-sm">
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <textarea
              name="details"
              rows={3}
              placeholder="What happened"
              className="w-full rounded-lg bg-elevated px-3 py-2 text-sm"
            />
            <Button type="submit" className="w-full">
              Send report
            </Button>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function FollowSheet({
  handle,
  kind,
  onClose,
}: {
  handle: string;
  kind: "followers" | "following";
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["follows", handle, kind],
    queryFn: () => listFollows({ data: { handle, kind } }),
  });
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-bg/70 md:place-items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold capitalize">{kind}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {(q.data ?? []).map((p) => (
            <li key={p.handle}>
              <Link
                to="/u/$handle"
                params={{ handle: p.handle }}
                className="flex items-center gap-3 py-2.5"
                onClick={onClose}
              >
                <Face name={p.displayName} hue={p.hue} size="sm" />
                <div>
                  <p className="text-sm font-bold">{p.displayName}</p>
                  <p className="text-xs text-subtle">@{p.handle}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {(q.data ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No one here yet.</p>
        )}
      </div>
    </div>
  );
}

function OcLibrary({
  mine,
  characters,
  onChange,
}: {
  mine: boolean;
  characters: {
    id: number;
    name: string;
    fandom: string;
    bio: string;
    appearance: string;
    hue: number;
  }[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">Original characters</h2>
        {mine && (
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Add OC"}
          </Button>
        )}
      </div>
      {open && mine && (
        <form
          className="mb-4 space-y-2 rounded-xl bg-surface p-4 shadow-border"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErr(null);
            void saveCharacter({
              data: {
                name: String(fd.get("name")),
                fandom: String(fd.get("fandom")),
                bio: String(fd.get("bio")),
                appearance: String(fd.get("appearance")),
              },
            })
              .then(() => {
                setOpen(false);
                onChange();
              })
              .catch((e) => setErr(e instanceof Error ? e.message : "Could not save"));
          }}
        >
          <input
            name="name"
            required
            placeholder="Name"
            className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
          />
          <input
            name="fandom"
            placeholder="Fandom or world"
            className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
          />
          <textarea
            name="bio"
            placeholder="Who they are"
            rows={3}
            className="w-full rounded-lg bg-elevated px-3 py-2 text-sm"
          />
          <input
            name="appearance"
            placeholder="Look, tells"
            className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
          />
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <Button type="submit" className="w-full">
            Save character
          </Button>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {characters.map((c) => (
          <article key={c.id} className="rounded-xl bg-surface p-4 shadow-border">
            <div className="flex items-start gap-3">
              <Face name={c.name} hue={c.hue} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{c.name}</p>
                <p className="text-xs text-subtle">{c.fandom || "Original"}</p>
                <p className="mt-2 text-sm text-muted">{c.bio}</p>
              </div>
            </div>
            {mine && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => void deleteCharacter({ data: c.id }).then(onChange)}
              >
                Remove
              </Button>
            )}
          </article>
        ))}
      </div>
      {characters.length === 0 && <p className="text-sm text-muted">No character sheets yet.</p>}
    </section>
  );
}
