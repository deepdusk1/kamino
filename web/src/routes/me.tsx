import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMe } from "@/lib/kamino/server";

export const Route = createFileRoute("/me")({ component: Me });

function Me() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({ queryKey: ["me"], queryFn: () => getMe(), enabled: !!user });
  if (isPending) return <AppShell title="Me"><div className="h-24" /></AppShell>;
  if (!user) return <RedirectToSignIn />;
  if (q.data?.profile.handle) {
    return <Navigate to="/u/$handle" params={{ handle: q.data.profile.handle }} />;
  }
  return (
    <AppShell title="Me">
      <p className="px-4 py-12 text-center text-sm text-muted">Opening your profile…</p>
    </AppShell>
  );
}
