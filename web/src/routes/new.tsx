import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createCommunity } from "@/lib/kamino/server";
import { CATEGORIES } from "@/lib/kamino/types";

export const Route = createFileRoute("/new")({ component: NewCommunity });

function NewCommunity() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (isPending) return <AppShell title="Create"><div className="h-24" /></AppShell>;
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell title="Create a community">
      <form
        className="mx-auto max-w-lg space-y-3 px-4 py-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          void createCommunity({
            data: {
              name: String(fd.get("name")),
              tagline: String(fd.get("tagline")),
              description: String(fd.get("description")),
              category: String(fd.get("category")),
              visibility: String(fd.get("visibility")) as "public" | "private" | "unlisted",
              ageGate: Number(fd.get("ageGate")),
              rules: String(fd.get("rules")),
            },
          })
            .then((r) => navigate({ to: "/c/$slug", params: { slug: r.id } }))
            .catch((err) => setError(err instanceof Error ? err.message : "Could not create"))
            .finally(() => setBusy(false));
        }}
      >
        <p className="text-sm text-muted">
          You become the agent. Public halls are listed. Private halls require a join request. Unlisted halls are link-only.
        </p>
        <input name="name" required placeholder="Name" className="h-12 w-full rounded-xl bg-surface px-4 text-sm shadow-border" />
        <input name="tagline" placeholder="Tagline" className="h-12 w-full rounded-xl bg-surface px-4 text-sm shadow-border" />
        <textarea name="description" placeholder="What happens here" rows={4} className="w-full rounded-xl bg-surface px-4 py-3 text-sm shadow-border" />
        <select name="category" className="h-12 w-full rounded-xl bg-surface px-4 text-sm shadow-border" defaultValue="Anime">
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="visibility" className="h-12 w-full rounded-xl bg-surface px-4 text-sm shadow-border" defaultValue="public">
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private (join requests)</option>
        </select>
        <select name="ageGate" className="h-12 w-full rounded-xl bg-surface px-4 text-sm shadow-border" defaultValue="13">
          <option value="13">13+</option>
          <option value="16">16+</option>
        </select>
        <textarea name="rules" placeholder="House rules" rows={4} className="w-full rounded-xl bg-surface px-4 py-3 text-sm shadow-border" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Opening…" : "Open the hall"}
        </Button>
      </form>
    </AppShell>
  );
}
