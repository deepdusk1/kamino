import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CommunityCard } from "@/components/community-card";
import { Face } from "@/components/face";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listDiscover, searchPeople } from "@/lib/kamino/server";
import { CATEGORIES } from "@/lib/kamino/types";
import { cn, levelFromRep } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  loader: () => listDiscover(),
  component: Explore,
});

function Explore() {
  const initial = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["discover"],
    queryFn: () => listDiscover(),
    initialData: initial,
  });
  const [cat, setCat] = useState("All");
  const [qtext, setQ] = useState("");
  const people = useQuery({
    queryKey: ["people", qtext],
    queryFn: () => searchPeople({ data: qtext }),
    enabled: qtext.trim().length >= 2,
  });
  const list = useMemo(() => {
    const rows = q.data?.communities ?? [];
    return rows.filter((c) => {
      if (cat !== "All" && c.category !== cat) return false;
      if (
        qtext &&
        !`${c.name} ${c.tagline} ${c.category}`.toLowerCase().includes(qtext.toLowerCase())
      )
        return false;
      return true;
    });
  }, [q.data, cat, qtext]);

  return (
    <AppShell
      title="Explore"
      actions={
        user ? (
          <Link to="/new">
            <Button size="sm">
              <Plus className="size-4" />
              Create
            </Button>
          </Link>
        ) : (
          <Link to="/login">
            <Button size="sm" variant="secondary">
              Sign in
            </Button>
          </Link>
        )
      }
    >
      <div className="space-y-4 px-4 py-5">
        <section className="discover-intro">
          <p className="eyebrow">FIND YOUR NEXT OBSESSION</p>
          <h1>There's a world for you.</h1>
          <p>Big fandoms, tiny hobbies, and people who just get it.</p>
        </section>
        <input
          aria-label="Search communities or people"
          value={qtext}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search communities or people"
          className="h-12 w-full rounded-xl bg-surface px-4 text-sm shadow-border outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "h-9 shrink-0 rounded-full px-3 text-sm",
                cat === c ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {(people.data?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-semibold">People</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-border">
              {people.data!.map((p) => (
                <li key={p.handle}>
                  <Link
                    to="/u/$handle"
                    params={{ handle: p.handle }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Face name={p.displayName} hue={p.hue} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.displayName}</p>
                      <p className="truncate text-xs text-subtle">
                        @{p.handle} · Lv {levelFromRep(p.rep)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((c) => (
            <CommunityCard key={c.id} community={c} />
          ))}
        </div>
        {list.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">No communities match that.</p>
        )}
      </div>
    </AppShell>
  );
}
