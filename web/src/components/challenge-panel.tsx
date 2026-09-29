import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { enterChallenge, judgeChallenge, listChallengeEntries, listMyPostsIn } from "@/lib/kamino/engagement";
import type { HallEvent } from "@/lib/kamino/types";

const MEDAL: Record<number, string> = { 1: "🥇 1st", 2: "🥈 2nd", 3: "🥉 3rd" };

/** Entries, entering, and (for leaders) picking winners, shown under a challenge on the Events tab. */
export function ChallengePanel({ slug, event, isMember, isLeader, onChanged }: { slug: string; event: HallEvent; isMember: boolean; isLeader: boolean; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [showEntries, setShowEntries] = useState(false);
  const [entering, setEntering] = useState(false);
  const [pickedPost, setPickedPost] = useState("");
  const [places, setPlaces] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = event.phase === "open";
  const status = { upcoming: "Not started yet", open: "Open for entries", closed: "Entries closed", judged: "Winners picked" }[event.phase];

  const entries = useQuery({
    queryKey: ["challenge-entries", event.id],
    queryFn: () => listChallengeEntries({ data: event.id }),
    enabled: showEntries,
  });
  const myPosts = useQuery({
    queryKey: ["my-posts", slug],
    queryFn: () => listMyPostsIn({ data: slug }),
    enabled: entering,
  });

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["challenge-entries", event.id] });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Trophy className="size-4 text-accent" aria-hidden /> {event.entryCount} {event.entryCount === 1 ? "entry" : "entries"} · {status}
        </p>
        <div className="flex gap-2">
          {event.entryCount > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowEntries((v) => !v)}>
              {showEntries ? "Hide entries" : "See entries"}
            </Button>
          )}
          {open && isMember && (
            <Button size="sm" onClick={() => setEntering((v) => !v)}>
              {event.myEntryPostId ? "Change my entry" : "Enter"}
            </Button>
          )}
        </div>
      </div>

      {entering && open && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await enterChallenge({ data: { eventId: event.id, postId: Number(pickedPost) } });
              setEntering(false);
              setShowEntries(true);
            });
          }}
        >
          <select aria-label="Choose one of your posts" required value={pickedPost} onChange={(e) => setPickedPost(e.target.value)} className="h-11 min-w-0 flex-1 rounded-lg bg-elevated px-3 text-sm">
            <option value="">{myPosts.data?.length === 0 ? "Write a post here first" : "Choose one of your posts…"}</option>
            {myPosts.data?.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={busy || !pickedPost}>Submit entry</Button>
        </form>
      )}

      {showEntries && entries.data && (
        <ul className="mt-3 space-y-2">
          {entries.data.entries.map((entry) => (
            <li key={entry.postId} className="flex flex-wrap items-center gap-3 rounded-xl bg-elevated px-3 py-2">
              <div className="min-w-0 flex-1">
                <Link to="/c/$slug/p/$postId" params={{ slug, postId: String(entry.postId) }} className="block truncate font-bold hover:underline">
                  {entry.placement ? `${MEDAL[entry.placement]} · ` : ""}{entry.title}
                </Link>
                <p className="text-xs text-subtle">by {entry.author.nickname} · {entry.likeCount} likes</p>
              </div>
              {isLeader && !event.judged && (
                <select aria-label={`Place for ${entry.title}`} value={places[entry.postId] ?? ""} onChange={(e) => setPlaces((cur) => ({ ...cur, [entry.postId]: e.target.value }))} className="h-9 rounded-lg bg-surface px-2 text-sm">
                  <option value="">No place</option>
                  <option value="1">1st</option>
                  <option value="2">2nd</option>
                  <option value="3">3rd</option>
                </select>
              )}
            </li>
          ))}
        </ul>
      )}

      {isLeader && !event.judged && showEntries && (
        <Button
          className="mt-3"
          size="sm"
          disabled={busy || !Object.values(places).some(Boolean)}
          onClick={() => {
            if (!confirm("Announce these winners? This can only be done once.")) return;
            const winners = Object.entries(places)
              .filter(([, place]) => place)
              .map(([postId, place]) => ({ postId: Number(postId), place: Number(place) as 1 | 2 | 3 }));
            void run(() => judgeChallenge({ data: { eventId: event.id, winners } }));
          }}
        >
          Announce winners
        </Button>
      )}
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
