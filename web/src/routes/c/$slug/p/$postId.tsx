import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flag, Heart, Bookmark, Pin, Repeat2, Sparkles, Trash2, History, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Face } from "@/components/face";
import { FormattedBody } from "@/components/formatted-body";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StoryViewer } from "@/components/story-viewer";
import { QuizPlayer } from "@/components/quiz-player";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addComment,
  copyWikiTemplate,
  deletePost,
  editPost,
  featurePost,
  fileReport,
  getPostPage,
  listWikiRevisions,
  repost,
  restoreWikiRevision,
  setPostFlags,
  submitWiki,
  toggleCommentLike,
  toggleFavorite,
  toggleLike,
  toggleWikiProfilePin,
  votePoll,
} from "@/lib/kamino/server";
import { REPORT_REASONS } from "@/lib/kamino/types";
import { cn, timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/c/$slug/p/$postId")({ component: PostPage });

function PostPage() {
  const { slug, postId } = Route.useParams();
  const id = Number(postId);
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["post", slug, id],
    queryFn: () => getPostPage({ data: { slug, postId: id } }),
  });
  const [comment, setComment] = useState("");
  const [reportOn, setReportOn] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [wikiBusy, setWikiBusy] = useState(false);
  const [historyOn, setHistoryOn] = useState(false);
  const revisions = useQuery({
    queryKey: ["wiki-revisions", id],
    queryFn: () => listWikiRevisions({ data: id }),
    enabled: historyOn,
  });
  const data = q.data;
  const questions = useMemo(() => {
    const raw = data?.post.payload.questions as
      { q: string; choices: string[]; answer: number }[] | undefined;
    return raw ?? [];
  }, [data]);

  if (q.error)
    return (
      <p className="px-4 py-12 text-center text-sm text-danger">{(q.error as Error).message}</p>
    );
  if (!data) return <p className="px-4 py-12 text-center text-sm text-muted">Opening post…</p>;
  const { post, community, member } = data;
  const showBody = !post.contentWarning || revealed;
  const canDelete = Boolean(
    user &&
    (user.id === post.author.userId ||
      (member && ["agent", "leader", "curator"].includes(member.role))),
  );

  return (
    <article className="px-4 py-5">
      {post.type === "story" && post.cover ? (
        <StoryViewer
          scenes={[
            post.cover,
            ...Array.from(
              { length: post.payload.albumCount ?? 0 },
              (_, i) => `/api/v1/media/post/${post.id}/${i + 1}`,
            ),
          ]}
          captions={post.payload.captions}
        />
      ) : post.cover ? (
        <img
          src={post.cover}
          alt=""
          className="mb-5 h-52 w-full rounded-2xl object-cover outline outline-1 -outline-offset-1 outline-fg/10"
        />
      ) : null}
      {post.type !== "story" && post.payload.albumCount ? (
        <ul className="-mt-2 mb-5 grid grid-cols-3 gap-2" aria-label="More pictures">
          {Array.from({ length: post.payload.albumCount }, (_, i) => i + 1).map((n) => (
            <li key={n}>
              <a href={`/api/v1/media/post/${post.id}/${n}`} target="_blank" rel="noreferrer">
                <img
                  src={`/api/v1/media/post/${post.id}/${n}`}
                  alt={`Picture ${n + 1} of ${post.payload.albumCount! + 1}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mb-4 flex items-center gap-3">
        <Link to="/u/$handle" params={{ handle: post.author.handle }}>
          <Face name={post.author.nickname} hue={post.author.hue} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{post.author.nickname}</p>
          <p className="text-xs text-subtle">
            {community.name} · {timeAgo(post.createdAt)}
          </p>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center text-muted"
          onClick={() => setReportOn(true)}
        >
          <Flag className="size-4" />
        </button>
      </div>
      {post.contentWarning && !revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-4 w-full rounded-xl bg-elevated px-4 py-5 text-left"
        >
          <p className="text-xs font-medium tracking-wide text-warn uppercase">
            CW · {post.contentWarning}
          </p>
          <p className="mt-1 text-sm text-muted">Tap to show this post</p>
        </button>
      ) : (
        <>
          {post.contentWarning ? (
            <p className="mb-2 text-xs font-medium text-warn uppercase">
              CW · {post.contentWarning}
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-semibold tracking-tight">{post.title}</h1>
          {post.type === "link" && post.payload.url ? (
            <a
              href={post.payload.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block truncate rounded-2xl bg-elevated px-4 py-3 text-sm font-bold text-accent"
            >
              {post.payload.url}
            </a>
          ) : null}
          <div className="mt-3">
            <FormattedBody body={post.body} formatted={post.payload.format === "markdown"} />
          </div>
          {post.hashtags.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold text-accent">
              {post.hashtags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </p>
          )}
          {post.editedAt ? (
            <p className="mt-1 text-xs text-subtle">Edited {timeAgo(post.editedAt)}</p>
          ) : null}
          {post.originalPostId ? (
            <p className="mt-1 text-xs font-bold text-subtle">Repost of #{post.originalPostId}</p>
          ) : null}
        </>
      )}

      {showBody && data.poll && (
        <div className="mt-6 space-y-2">
          {data.poll.options.map((opt, i) => {
            const total = data.poll!.counts.reduce((a, b) => a + Number(b), 0) || 1;
            const pct = Math.round((Number(data.poll!.counts[i] ?? 0) / total) * 100);
            const mine = data.poll!.mine === i;
            return (
              <button
                key={opt}
                type="button"
                disabled={!user}
                onClick={() =>
                  void votePoll({ data: { postId: id, optionIndex: i } }).then(() => q.refetch())
                }
                className="relative block w-full overflow-hidden rounded-xl bg-elevated px-4 py-3 text-left text-sm"
              >
                {data.poll!.mine != null && (
                  <span
                    className="absolute inset-y-0 left-0 bg-accent/20"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex justify-between">
                  <span className={cn(mine && "text-accent")}>{opt}</span>
                  {data.poll!.mine != null && (
                    <span className="tabular-nums text-muted">{pct}%</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showBody && post.type === "wiki" && (
        <div className="mt-5 rounded-xl border border-accent/20 bg-accent/5 p-4">
          <p className="text-sm font-bold">
            {post.wikiStatus === "approved"
              ? "Approved community library page"
              : post.wikiStatus === "pending"
                ? "Submitted for library review"
                : "Community wiki page"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Approved pages appear in the community library. Editing an approved page sends it back
            for review.
          </p>
          {post.author.userId === user?.id && post.wikiReviewNote && (
            <p className="mt-2 text-sm">Review feedback: {post.wikiReviewNote}</p>
          )}
          {post.payload.templateSourceId && (
            <Link
              to="/c/$slug/p/$postId"
              params={{ slug, postId: String(post.payload.templateSourceId) }}
              className="mt-2 block text-xs font-bold text-accent"
            >
              Based on wiki page #{post.payload.templateSourceId} →
            </Link>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {post.author.userId === user?.id && ["draft", "rejected"].includes(post.wikiStatus) && (
              <Button
                size="sm"
                disabled={wikiBusy}
                onClick={async () => {
                  setWikiBusy(true);
                  try {
                    await submitWiki({ data: id });
                    await q.refetch();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not submit wiki");
                  } finally {
                    setWikiBusy(false);
                  }
                }}
              >
                Submit to library
              </Button>
            )}
            <Link to="/c/$slug/wiki" params={{ slug }} className="text-xs font-bold text-accent">
              Open community library →
            </Link>
            {user && post.wikiStatus === "approved" && member?.status === "active" && (
              <Button
                variant="secondary"
                size="sm"
                disabled={wikiBusy}
                onClick={async () => {
                  setWikiBusy(true);
                  try {
                    const copy = await copyWikiTemplate({ data: id });
                    await navigate({
                      to: "/c/$slug/p/$postId",
                      params: { slug: copy.slug, postId: String(copy.id) },
                    });
                    toast.success("Template copied into your drafts");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not copy wiki");
                  } finally {
                    setWikiBusy(false);
                  }
                }}
              >
                <Copy className="size-4" />
                Use as template
              </Button>
            )}
            {user && post.wikiStatus === "approved" && community.visibility === "public" && (
              <Button
                variant="secondary"
                size="sm"
                disabled={wikiBusy}
                onClick={async () => {
                  setWikiBusy(true);
                  try {
                    const result = await toggleWikiProfilePin({ data: id });
                    await q.refetch();
                    toast.success(
                      result.pinned ? "Pinned to your profile" : "Removed from profile",
                    );
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not pin wiki");
                  } finally {
                    setWikiBusy(false);
                  }
                }}
              >
                <Pin className="size-4" />
                {data.wikiPinned ? "Unpin from profile" : "Pin to profile"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setHistoryOn((v) => !v)}>
              <History className="size-4" />
              {historyOn ? "Hide history" : "Edit history"}
            </Button>
          </div>
          {historyOn && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs text-muted">
                Current page appears above. Earlier versions are saved when the author edits.
              </p>
              {revisions.isLoading && <p className="text-xs text-muted">Loading history…</p>}
              {revisions.error && <p className="text-xs text-danger">Could not load history.</p>}
              {revisions.data?.length === 0 && (
                <p className="text-xs text-muted">No earlier versions yet.</p>
              )}
              {revisions.data?.map((rev) => (
                <details key={rev.id} className="rounded-xl bg-elevated/70 p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">
                    {rev.title} · {timeAgo(rev.createdAt)} · {rev.editor}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted">{rev.body}</p>
                  {post.author.userId === user?.id && (
                    <Button
                      className="mt-2"
                      variant="secondary"
                      size="sm"
                      disabled={wikiBusy}
                      onClick={async () => {
                        setWikiBusy(true);
                        try {
                          await restoreWikiRevision({ data: { postId: id, revisionId: rev.id } });
                          await Promise.all([q.refetch(), revisions.refetch()]);
                          toast.success("Previous version restored");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not restore version");
                        } finally {
                          setWikiBusy(false);
                        }
                      }}
                    >
                      Restore this version
                    </Button>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {showBody && post.type === "quiz" && questions.length > 0 && (
        <div className="mt-6 rounded-2xl bg-surface p-4 shadow-border">
          {data.myQuiz ? (
            <p className="text-sm">
              You scored{" "}
              <span className="tabular-nums text-accent">
                {data.myQuiz.score}/{data.myQuiz.total}
              </span>
            </p>
          ) : (
            <QuizPlayer
              postId={id}
              questions={questions}
              timeLimitSec={post.payload.timeLimitSec ?? 0}
              quizRun={data.quizRun}
              onDone={() => void q.refetch()}
            />
          )}
          {data.quizBoard.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {data.quizBoard.map((row, i) => (
                <li key={i} className="flex justify-between">
                  <span>{row.nickname}</span>
                  <span className="tabular-nums">
                    {row.score}/{row.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => void toggleLike({ data: id }).then(() => q.refetch())}
          className={cn(post.liked && "text-accent")}
        >
          <Heart className={cn("size-4", post.liked && "fill-accent")} />
          <span className="tabular-nums">{post.likeCount}</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => void toggleFavorite({ data: id }).then(() => q.refetch())}
          className={cn(post.saved && "text-accent")}
        >
          <Bookmark className={cn("size-4", post.saved && "fill-accent")} />
          {post.saved ? "Saved" : "Save"}
        </Button>
        {user && member?.status === "active" && (
          <Button
            variant="ghost"
            onClick={() =>
              void repost({ data: { slug, postId: id } }).then((r) =>
                navigate({ to: "/c/$slug/p/$postId", params: { slug, postId: String(r.id) } }),
              )
            }
          >
            <Repeat2 className="size-4" />
            Repost
          </Button>
        )}
        {user?.id === post.author.userId && (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing((v) => !v);
              setEditTitle(post.title);
              setEditBody(post.body);
            }}
          >
            Edit
          </Button>
        )}
        {user &&
          (user.id === post.author.userId ||
            (member && ["agent", "leader", "curator"].includes(member.role))) && (
            <Button
              variant="ghost"
              onClick={() =>
                void setPostFlags({
                  data: { slug, postId: id, commentsDisabled: !post.commentsDisabled },
                }).then(() => q.refetch())
              }
            >
              {post.commentsDisabled ? "Open comments" : "Close comments"}
            </Button>
          )}
        {member && ["agent", "leader", "curator"].includes(member.role) && (
          <>
            <Button
              variant="ghost"
              onClick={() =>
                void featurePost({ data: { postId: id, slug } }).then(() => q.refetch())
              }
            >
              <Sparkles className="size-4" />
              {post.featured ? "Unfeature" : "Feature"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void setPostFlags({ data: { slug, postId: id, pinned: !post.pinned } }).then(() =>
                  q.refetch(),
                )
              }
            >
              <Pin className="size-4" />
              {post.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void setPostFlags({ data: { slug, postId: id, hidden: !post.hidden } }).then(() =>
                  q.refetch(),
                )
              }
            >
              {post.hidden ? "Unhide" : "Hide"}
            </Button>
            {["agent", "leader"].includes(member.role) && (
              <Button
                variant="ghost"
                onClick={() =>
                  void setPostFlags({
                    data: { slug, postId: id, announcement: !post.announcement },
                  }).then(() => q.refetch())
                }
              >
                {post.announcement ? "Unannounce" : "Announce"}
              </Button>
            )}
          </>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            onClick={() => {
              if (!confirm("Remove this post?")) return;
              void deletePost({ data: { slug, postId: id } }).then(() => {
                void navigate({ to: "/c/$slug", params: { slug } });
              });
            }}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        )}
      </div>

      {editing && (
        <form
          className="mt-4 space-y-2 rounded-2xl bg-surface p-4 shadow-border"
          onSubmit={(e) => {
            e.preventDefault();
            void editPost({ data: { slug, postId: id, title: editTitle, body: editBody } }).then(
              () => {
                setEditing(false);
                void q.refetch();
              },
            );
          }}
        >
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
          />
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={5}
            className="w-full rounded-lg bg-elevated px-3 py-2 text-sm"
          />
          <Button type="submit">Save edits</Button>
        </form>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">
          {post.type === "question" ? "Answers" : "Comments"}
        </h2>
        <ul className="space-y-3">
          {data.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Face name={c.author.nickname} hue={c.author.hue} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {c.author.nickname}{" "}
                  <span className="font-normal text-subtle">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-sm text-muted">{c.body}</p>
              </div>
              <button
                type="button"
                disabled={!user}
                onClick={() => void toggleCommentLike({ data: c.id }).then(() => q.refetch())}
                className={cn(
                  "inline-flex h-9 items-center gap-1 text-sm font-bold text-muted",
                  c.liked && "text-accent",
                )}
              >
                <Heart className={cn("size-4", c.liked && "fill-accent")} />
                <span className="tabular-nums">{c.likeCount}</span>
              </button>
            </li>
          ))}
        </ul>
        {user && !post.commentsDisabled && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              void addComment({ data: { postId: id, body: comment } }).then(() => {
                setComment("");
                void q.refetch();
              });
            }}
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={post.type === "question" ? "Write an answer" : "Reply"}
              className="h-11 flex-1 rounded-lg bg-elevated px-3 text-sm"
            />
            <Button type="submit">Send</Button>
          </form>
        )}
        {post.commentsDisabled && <p className="mt-3 text-sm text-muted">Comments are closed.</p>}
      </section>

      {reportOn && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-bg/70 p-4">
          <form
            className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-border"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void fileReport({
                data: {
                  communityId: slug,
                  targetType: "post",
                  targetId: String(id),
                  reason: String(fd.get("reason")),
                  details: String(fd.get("details") || ""),
                },
              }).then(() => setReportOn(false));
            }}
          >
            <h2 className="font-display text-lg font-semibold">Report this post</h2>
            <select
              name="reason"
              className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
              defaultValue={REPORT_REASONS[0]}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <textarea
              name="details"
              placeholder="Details"
              className="w-full rounded-lg bg-elevated px-3 py-2 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Submit
              </Button>
              <Button type="button" variant="secondary" onClick={() => setReportOn(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}
