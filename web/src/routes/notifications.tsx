import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listNotifications, markNotificationsRead } from "@/lib/kamino/server";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({ component: Notes });

function Notes() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["notes"],
    queryFn: () => listNotifications(),
    enabled: !!user,
  });
  useEffect(() => {
    if (user) void markNotificationsRead();
  }, [user]);
  if (isPending)
    return (
      <AppShell title="Activity">
        <div className="h-24" />
      </AppShell>
    );
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell title="Activity">
      <ul className="divide-y divide-border">
        {(q.data ?? []).map((n) => (
          <li key={n.id}>
            <a href={n.href} className="flex items-start gap-3 px-4 py-3 hover:bg-surface">
              {n.kind === "call" ? (
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ok/20 text-ok">
                  <Phone className="size-4" />
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="text-xs text-subtle">{timeAgo(n.createdAt)}</p>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {(q.data ?? []).length === 0 && (
        <p className="px-4 py-12 text-center text-sm text-muted">You’re caught up.</p>
      )}
    </AppShell>
  );
}
