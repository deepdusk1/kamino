import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, MessageCircle, Pin, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Post } from "@/lib/kamino/types";
import { cn, timeAgo } from "@/lib/utils";
import { Face } from "./face";

const TYPE_LABEL: Record<string, string> = {
  blog: "Blog",
  image: "Image",
  poll: "Poll",
  quiz: "Quiz",
  wiki: "Wiki",
  story: "Story",
  question: "Q&A",
  link: "Link",
};

export function PostCard({
  post,
  communityName,
  onLike,
  onSave,
}: {
  post: Post;
  communityName?: string;
  onLike?: (id: number) => void;
  onSave?: (id: number) => void;
}) {
  const [revealed, setRevealed] = useState(!post.contentWarning);
  const [pending, setPending] = useState(false);
  async function act(callback?: (id: number) => void) {
    if (!callback || pending) return;
    setPending(true);
    try {
      await callback(post.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="bg-surface px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]">
      <div className="flex items-center gap-2.5">
        <Link to="/u/$handle" params={{ handle: post.author.handle }}>
          <Face name={post.author.nickname} hue={post.author.hue} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{post.author.nickname}</p>
          <p className="text-[11px] font-semibold text-subtle">
            {communityName ? `${communityName} · ` : ""}
            {timeAgo(post.createdAt)} · {TYPE_LABEL[post.type] ?? post.type}
            {post.editedAt ? " · edited" : ""}
          </p>
        </div>
        {post.announcement ? (
          <span className="text-[11px] font-bold text-warn">Announcement</span>
        ) : post.pinned ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
            <Pin className="size-3.5" />
            Pinned
          </span>
        ) : post.featured ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
            <Sparkles className="size-3.5" />
            Featured
          </span>
        ) : null}
      </div>
      {post.originalPostId ? (
        <p className="mt-2 text-[11px] font-bold text-subtle">Repost</p>
      ) : null}
      {post.cover && post.type !== "blog" ? (
        <Link
          to="/c/$slug/p/$postId"
          params={{ slug: post.communityId, postId: String(post.id) }}
          className="mt-3 block"
        >
          <img
            src={post.cover}
            alt=""
            className={cn("h-44 w-full rounded-2xl object-cover", !revealed && "blur-md")}
          />
          {post.payload.albumCount ? (
            <span className="mt-1 inline-block rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">
              {post.payload.albumCount + 1} pictures
            </span>
          ) : null}
        </Link>
      ) : null}
      <div className="mt-2.5 space-y-2">
        {post.contentWarning && !revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full rounded-2xl bg-elevated px-3 py-3 text-left text-sm"
          >
            <span className="text-xs font-bold tracking-wide text-warn uppercase">
              CW · {post.contentWarning}
            </span>
            <span className="mt-1 block text-muted">Tap to show</span>
          </button>
        ) : (
          <Link
            to="/c/$slug/p/$postId"
            params={{ slug: post.communityId, postId: String(post.id) }}
            className="block"
          >
            {post.contentWarning ? (
              <p className="mb-1 text-xs font-bold tracking-wide text-warn uppercase">
                CW · {post.contentWarning}
              </p>
            ) : null}
            <h3 className="font-display text-[17px] font-extrabold tracking-tight">{post.title}</h3>
            {post.type === "link" && post.payload.url ? (
              <p className="mt-1 truncate text-xs font-bold text-accent">{post.payload.url}</p>
            ) : null}
            <p className="mt-1 line-clamp-3 text-sm text-muted">{post.body}</p>
          </Link>
        )}
        {post.hashtags.length > 0 && (
          <p className="flex flex-wrap gap-1.5 text-xs font-bold text-accent">
            {post.hashtags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </p>
        )}
        <div className="flex items-center gap-4 pt-1 text-sm text-muted">
          <button
            type="button"
            onClick={() => void act(onLike)}
            disabled={pending || !onLike}
            aria-label={`${post.liked ? "Unlike" : "Like"} ${post.title}`}
            aria-pressed={post.liked}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 font-bold",
              post.liked && "text-accent",
            )}
          >
            <Heart className={cn("size-4", post.liked && "fill-accent")} />
            <span className="tabular-nums">{post.likeCount}</span>
          </button>
          <Link
            to="/c/$slug/p/$postId"
            params={{ slug: post.communityId, postId: String(post.id) }}
            className="inline-flex h-9 items-center gap-1.5 font-bold"
          >
            <MessageCircle className="size-4" />
            <span className="tabular-nums">{post.commentCount}</span>
          </Link>
          {onSave && (
            <button
              type="button"
              onClick={() => void act(onSave)}
              disabled={pending}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 font-bold",
                post.saved && "text-accent",
              )}
              aria-label={post.saved ? "Unsave" : "Save"}
              aria-pressed={post.saved}
            >
              <Bookmark className={cn("size-4", post.saved && "fill-accent")} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
