import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChallengePanel } from "@/components/challenge-panel";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { canLead } from "@/lib/kamino/safety";
import { createEvent, listEvents, rsvpEvent } from "@/lib/kamino/server";

export const Route = createFileRoute("/c/$slug/events")({ component: Events });

function Events() {
  const { slug } = Route.useParams();
  const { user } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["events", slug],
    queryFn: () => listEvents({ data: slug }),
  });
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lead = canLead(q.data?.member?.role);

  if (q.error) return <p className="px-4 py-12 text-center text-sm text-muted">{(q.error as Error).message}</p>;
  if (!q.data) return <p className="px-4 py-12 text-center text-sm text-muted">Loading events…</p>;

  return (
    <div className="px-4 py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">Events & challenges</h2>
          <p className="text-sm text-muted">Hall nights, check-in challenges, wiki weeks. RSVP so the lobby knows you’re in.</p>
        </div>
        {lead && (
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Schedule"}
          </Button>
        )}
      </div>
      {open && lead && (
        <form
          className="mb-5 space-y-2 rounded-2xl bg-surface p-4 shadow-border"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErr(null);
            void createEvent({
              data: {
                slug,
                title: String(fd.get("title")),
                body: String(fd.get("body")),
                kind: fd.get("kind") === "challenge" ? "challenge" : "event",
                startsAt: String(fd.get("startsAt")),
                endsAt: String(fd.get("endsAt") || "") || undefined,
              },
            })
              .then(() => {
                setOpen(false);
                void q.refetch();
              })
              .catch((e) => setErr(e instanceof Error ? e.message : "Could not schedule"));
          }}
        >
          <input name="title" required placeholder="Name" className="h-11 w-full rounded-lg bg-elevated px-3 text-sm" />
          <textarea name="body" rows={3} placeholder="What happens" className="w-full rounded-lg bg-elevated px-3 py-2 text-sm" />
          <select name="kind" className="h-11 w-full rounded-lg bg-elevated px-3 text-sm">
            <option value="event">Event</option>
            <option value="challenge">Challenge</option>
          </select>
          <label className="block text-sm">
            Starts
            <input type="datetime-local" name="startsAt" required className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
          </label>
          <label className="block text-sm">
            Ends
            <input type="datetime-local" name="endsAt" className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
          </label>
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <Button type="submit" className="w-full">
            Publish
          </Button>
        </form>
      )}
      <ul className="space-y-3">
        {q.data.events.map((ev) => (
          <li key={ev.id} className="rounded-2xl bg-surface p-4 shadow-border">
            <p className="text-[11px] font-extrabold tracking-wide text-accent uppercase">{ev.kind}</p>
            <h3 className="font-display text-lg font-extrabold">{ev.title}</h3>
            <p className="mt-1 text-sm text-muted">{ev.body}</p>
            <p className="mt-2 text-xs font-semibold text-subtle">
              {new Date(ev.startsAt).toLocaleString()}
              {ev.endsAt ? ` → ${new Date(ev.endsAt).toLocaleString()}` : ""}
            </p>
            {ev.kind === "challenge" && (
              <ChallengePanel slug={slug} event={ev} isMember={q.data.member?.status === "active"} isLeader={lead} onChanged={() => void q.refetch()} />
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-bold">{ev.rsvpCount} going</p>
              {user && q.data.member?.status === "active" && (
                <Button
                  size="sm"
                  variant={ev.going ? "secondary" : "primary"}
                  onClick={() => void rsvpEvent({ data: { slug, eventId: ev.id } }).then(() => q.refetch())}
                >
                  {ev.going ? "Can’t go" : "I’m in"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {q.data.events.length === 0 && <p className="py-12 text-center text-sm text-muted">No events yet.</p>}
    </div>
  );
}
