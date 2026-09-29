import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Plus, Search, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Composer } from "./composer";
import { Button } from "./ui/button";
import { getWiki, reviewWiki, submitWiki } from "@/lib/kamino/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export function WikiLibrary({ slug }: { slug: string }) {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("library");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const q = useQuery({
    queryKey: ["wiki", slug, user?.id],
    queryFn: () => getWiki({ data: slug }),
  });
  const entries = q.data?.entries ?? [];
  const member = q.data?.member?.status === "active" ? q.data.member : null;
  const mod = member && ["agent", "leader", "curator"].includes(member.role);
  const cats = [...new Set(entries.map((e) => e.payload.category || "General"))].sort();
  const shown = entries.filter(
    (e) =>
      (filter === "library"
        ? e.wikiStatus === "approved"
        : filter === "mine"
          ? e.author.userId === user?.id
          : filter === "review"
            ? e.wikiStatus === "pending"
            : true) &&
      (!category || (e.payload.category || "General") === category) &&
      `${e.title} ${e.body} ${e.author.nickname}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function act(id: number, action: () => Promise<unknown>) {
    if (pending !== null) return;
    setPending(id);
    try {
      await action();
      await q.refetch();
      toast.success("Wiki updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update wiki");
    } finally {
      setPending(null);
    }
  }
  if (q.error)
    return (
      <p role="alert" className="p-6 text-danger">
        {q.error.message}
      </p>
    );
  if (q.data?.locked)
    return <p className="p-6 text-muted">Join this community to open its wiki.</p>;
  return (
    <div className="space-y-5 px-4 py-5">
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/15 via-surface to-surface p-6">
        <BookOpen className="mb-3 size-7 text-accent" />
        <p className="text-[10px] font-bold tracking-[.2em] text-accent uppercase">
          Made by the community
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">
          A home for everything you know.
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Character lore, thoughtful guides, and stories worth keeping. Submit your page for a place
          in the community library.
        </p>
        {member && user && (
          <Button className="mt-4" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Create a wiki page
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["library", "Community library"],
          ["all", "All pages"],
          ...(user ? [["mine", "My pages"]] : []),
          ...(mod
            ? [
                [
                  "review",
                  `Review queue (${entries.filter((e) => e.wikiStatus === "pending").length})`,
                ],
              ]
            : []),
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-bold",
              filter === id ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-elevated px-3">
          <Search className="size-4 text-muted" />
          <input
            aria-label="Search wiki pages"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search lore, guides, creators…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Wiki category filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 max-w-full rounded-xl bg-elevated px-3 text-sm"
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {q.isPending ? (
        <p className="py-8 text-center text-muted">Opening the library…</p>
      ) : !shown.length ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <BookOpen className="mx-auto mb-3 size-8 text-muted" />
          <p className="font-bold">
            {search || category ? "No matching pages" : "No pages here yet"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {search || category
              ? "Try another search or category."
              : filter === "library"
                ? "Approved submissions appear here. Explore All pages to find more."
                : "Try a different search or create the first page."}
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((e) => (
          <article
            key={e.id}
            className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface"
          >
            {e.cover && !e.contentWarning && (
              <img src={e.cover} alt="" className="h-32 w-full object-cover" />
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-accent">
                  {e.payload.category || "General"}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                  {e.wikiStatus === "approved" ? (
                    <>
                      <CheckCircle2 className="size-3" />
                      Approved
                    </>
                  ) : e.wikiStatus === "pending" ? (
                    <>
                      <Clock className="size-3" />
                      In review
                    </>
                  ) : (
                    "Community page"
                  )}
                </span>
              </div>
              <Link
                to="/c/$slug/p/$postId"
                params={{ slug, postId: String(e.id) }}
                className="font-display text-lg font-bold hover:text-accent"
              >
                {e.title}
              </Link>
              <p className="mt-2 line-clamp-3 break-words text-sm text-muted">
                {e.contentWarning ? `Content warning: ${e.contentWarning}` : e.body}
              </p>
              <p className="mt-3 text-xs text-subtle">By {e.author.nickname}</p>
              {e.author.userId === user?.id && (
                <div className="mt-3 border-t border-border pt-3">
                  {e.wikiReviewNote && (
                    <p className="mb-2 text-xs text-muted">Review feedback: {e.wikiReviewNote}</p>
                  )}
                  {["draft", "rejected"].includes(e.wikiStatus) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() => void act(e.id, () => submitWiki({ data: e.id }))}
                    >
                      Submit to library
                    </Button>
                  )}
                </div>
              )}
              {mod && e.wikiStatus === "pending" && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <input
                    aria-label={`Review feedback for ${e.title}`}
                    maxLength={500}
                    value={notes[e.id] ?? ""}
                    onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })}
                    className="w-full rounded-lg bg-elevated p-2 text-xs"
                    placeholder="Helpful feedback (optional)"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending !== null}
                      onClick={() =>
                        void act(e.id, () =>
                          reviewWiki({
                            data: { postId: e.id, decision: "approved", note: notes[e.id] },
                          }),
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending !== null}
                      onClick={() =>
                        void act(e.id, () =>
                          reviewWiki({
                            data: { postId: e.id, decision: "rejected", note: notes[e.id] },
                          }),
                        )
                      }
                    >
                      Request changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {open && (
        <Composer
          slug={slug}
          initialType="wiki"
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false);
            void q.refetch();
            void navigate({ to: "/c/$slug/p/$postId", params: { slug, postId: String(id) } });
          }}
        />
      )}
    </div>
  );
}
