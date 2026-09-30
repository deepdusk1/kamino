import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Copy, Lock, Shield, Users } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { checkInCommunity } from "@/lib/kamino/engagement";
import { getCommunityPage, joinCommunity, leaveCommunity } from "@/lib/kamino/server";
import { communityColors } from "@/lib/kamino/theme";
import { COMMUNITY_MODULES, type CommunityModule } from "@/lib/kamino/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/c/$slug")({
  loader: ({ params }) => getCommunityPage({ data: { slug: params.slug } }),
  component: CommunityLayout,
});

function CommunityLayout() {
  const queryClient = useQueryClient();
  const { slug } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();
  const [nick, setNick] = useState("");
  const [invite, setInvite] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const page = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityPage({ data: { slug } }),
    initialData: Route.useLoaderData(),
  });
  const c = page.data?.community;
  const look = c ? communityColors(c.hue, c.themeStyle) : null;
  const member = page.data?.member;
  const locked = page.data?.locked;
  const active = member?.status === "active";
  const pending = member?.status === "pending";
  const visibleModules = c?.modules ?? [...COMMUNITY_MODULES];
  const tabModule = (label: string) =>
    (label === "Folder" ? "files" : label === "Stories" ? "roleplay" : label.toLowerCase()) as CommunityModule;

  async function checkIn() {
    setBusy(true);
    setErr(null);
    try {
      await checkInCommunity({ data: { slug } });
      await queryClient.invalidateQueries({ queryKey: ["community", slug] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not check in");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setErr(null);
    try {
      const res = await joinCommunity({
        data: { slug, nickname: nick || undefined, invite: invite || undefined, answers },
      });
      if (res.pending) setErr("Request sent. A leader will review it.");
      await queryClient.invalidateQueries();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title={c?.name ?? "Community"}>
      {/* The community's own colours: everything inside picks up the accent its leaders chose. */}
      <div
        className="contents"
        style={
          look
            ? ({
                "--color-accent": look.accent,
                "--color-accent-fg": look.accentFg,
              } as React.CSSProperties)
            : undefined
        }
      >
        {c && look && (
          <>
            <div className="relative">
              <img
                src={c.cover}
                alt=""
                className="h-36 w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10 md:h-48"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${look.from}, ${look.to})`,
                  opacity: look.tint,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
            </div>
            <div className="flex flex-wrap items-end gap-3 px-4 pb-3">
              <img
                src={c.icon || c.cover}
                alt=""
                className="-mt-8 size-16 rounded-full object-cover outline outline-4 outline-bg md:size-20"
              />
              <div className="min-w-[12rem] flex-1 py-1">
                <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{c.category}</p>
                <h1 className="font-display text-2xl font-semibold tracking-tight">{c.name}</h1>
                <p className="text-sm text-muted">{c.tagline}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
                  <Users className="size-3.5" />
                  {c.memberCount} members · {c.ageGate}+
                  {c.visibility !== "public" ? ` · ${c.visibility}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void navigator.clipboard.writeText(window.location.href)}
                >
                  <Copy className="size-3.5" />
                  Invite
                </Button>
                {active && (
                  <Button
                    size="sm"
                    variant={member?.checkedInToday ? "secondary" : "primary"}
                    disabled={busy || member?.checkedInToday}
                    onClick={() => void checkIn()}
                  >
                    <CalendarCheck className="size-3.5" />
                    {member?.checkedInToday
                      ? `Checked in${member.streak > 1 ? ` · ${member.streak} days` : ""}`
                      : member?.streak
                        ? `Check in · keep your ${member.streak}-day streak`
                        : "Check in"}
                  </Button>
                )}
                {active ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (confirm("Leave this community?")) {
                        void leaveCommunity({ data: slug })
                          .then(() => queryClient.invalidateQueries())
                          .catch((e) => setErr(e instanceof Error ? e.message : "Could not leave"));
                      }
                    }}
                  >
                    Joined
                  </Button>
                ) : pending ? (
                  <Button size="sm" variant="secondary" disabled>
                    Pending
                  </Button>
                ) : (
                  <Button size="sm" disabled={!user || busy} onClick={() => void join()}>
                    {user ? "Join" : "Sign in to join"}
                  </Button>
                )}
              </div>
            </div>
            {err ? <p className="px-4 pb-2 text-sm text-warn">{err}</p> : null}
          </>
        )}

        {locked ? (
          <div className="mx-auto max-w-md space-y-4 px-4 py-12 text-center">
            <Lock className="mx-auto size-8 text-accent" />
            <h2 className="font-display text-xl font-semibold">Private community</h2>
            <p className="text-sm text-muted">
              Leaders review every join. Pick a persona name for this room.
            </p>
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Persona name"
              className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
            />
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Invite code (optional)"
              className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
            />
            {(page.data?.joinQuestions ?? []).map((q, i) => (
              <input
                key={q.id}
                value={answers[i] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                placeholder={q.prompt}
                className="h-11 w-full rounded-lg bg-elevated px-3 text-sm"
              />
            ))}
            <Button className="w-full" disabled={busy || !user} onClick={() => void join()}>
              {user ? "Request to join" : "Sign in to request"}
            </Button>
          </div>
        ) : (
          <>
            <nav className="sticky top-14 z-10 flex gap-0 overflow-x-auto border-b border-border bg-bg/90 px-2 backdrop-blur-sm">
              {(
                [
                  {
                    to: "/c/$slug" as const,
                    label: "Home",
                    match: (p: string) => p === `/c/${slug}` || p.startsWith(`/c/${slug}/p/`),
                  },
                  {
                    to: "/c/$slug/chats" as const,
                    label: "Chats",
                    match: (p: string) => p.startsWith(`/c/${slug}/chats`),
                  },
                  {
                    to: "/c/$slug/wiki" as const,
                    label: "Wiki",
                    match: (p: string) => p.startsWith(`/c/${slug}/wiki`),
                  },
                  {
                    to: "/c/$slug/files" as const,
                    label: "Folder",
                    match: (p: string) => p.startsWith(`/c/${slug}/files`),
                  },
                  {
                    to: "/c/$slug/events" as const,
                    label: "Events",
                    match: (p: string) => p.startsWith(`/c/${slug}/events`),
                  },
                  {
                    to: "/c/$slug/roleplay" as const,
                    label: "Stories",
                    match: (p: string) => p.startsWith(`/c/${slug}/roleplay`),
                  },
                  {
                    to: "/c/$slug/rank" as const,
                    label: "Rank",
                    match: (p: string) => p.startsWith(`/c/${slug}/rank`),
                  },
                  {
                    to: "/c/$slug/members" as const,
                    label: "Members",
                    match: (p: string) => p.startsWith(`/c/${slug}/members`),
                  },
                ] as const
              )
                .filter(
                  (tab) => tab.label === "Home" || visibleModules.includes(tabModule(tab.label)),
                )
                .sort(
                  (a, b) =>
                    (a.label === "Home" ? -1 : visibleModules.indexOf(tabModule(a.label))) -
                    (b.label === "Home" ? -1 : visibleModules.indexOf(tabModule(b.label))),
                )
                .map((tab) => (
                  <Link
                    key={tab.label}
                    to={tab.to}
                    params={{ slug }}
                    className={cn(
                      "grid h-11 shrink-0 place-items-center px-3.5 text-sm font-extrabold",
                      tab.match(pathname) ? "amino-tab-active text-accent" : "text-muted",
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              {member && ["agent", "leader", "curator"].includes(member.role) ? (
                <Link
                  to="/c/$slug/mod"
                  params={{ slug }}
                  className={cn(
                    "ml-auto inline-flex h-11 items-center gap-1 px-3 text-sm font-extrabold text-muted",
                    pathname.endsWith("/mod") && "amino-tab-active text-accent",
                  )}
                >
                  <Shield className="size-3.5" />
                  Mod
                </Link>
              ) : null}
            </nav>
            <Outlet />
          </>
        )}
      </div>
    </AppShell>
  );
}
