import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listFavorites, toggleFavorite, toggleLike } from "@/lib/kamino/server";

export const Route = createFileRoute("/saved")({ component: Saved });

function Saved() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({ queryKey: ["saved"], queryFn: () => listFavorites(), enabled: !!user });
  if (isPending) return <AppShell title="Saved"><div className="h-24" /></AppShell>;
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell title="Saved">
      <p className="px-4 pt-4 text-sm text-muted">Your favourite finds, all in one place. Only posts you can still access appear here.</p>
      <div className="mt-3">
        {(q.data ?? []).map((post) => (
          <PostCard
            key={post.id}
            post={post}
            communityName={post.communityName}
            onLike={async (id) => {
              await toggleLike({ data: id });
              void q.refetch();
            }}
            onSave={async (id) => {
              await toggleFavorite({ data: id });
              void q.refetch();
            }}
          />
        ))}
      </div>
      {(q.data ?? []).length === 0 && <p className="px-4 py-12 text-center text-sm text-muted">Nothing saved yet.</p>}
    </AppShell>
  );
}
