import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listRooms } from "@/lib/kamino/server";
import { timeAgo } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { Face } from "@/components/face";
import { parseSticker } from "@/lib/kamino/stickers";
import { Pin } from "lucide-react";

export const Route = createFileRoute("/chats/")({ component: Chats });

function Chats() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["rooms"],
    queryFn: () => listRooms(),
    enabled: !!user,
  });
  if (isPending)
    return (
      <AppShell title="Chats">
        <div className="h-40" />
      </AppShell>
    );
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell title="Chats">
      <ul className="divide-y divide-border">
        {(q.data ?? []).map((r) => {
          const preview = r.lastMessage && parseSticker(r.lastMessage) ? "Sticker" : r.lastMessage;
          const hue = r.kind === "dm" ? r.peerHue : 220 + ((r.id * 37) % 80);
          const label = r.kind === "dm" ? (r.peerName ?? r.name) : r.name;
          return (
            <li key={r.id}>
              <Link
                to="/chats/$roomId"
                params={{ roomId: String(r.id) }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface"
              >
                {r.kind === "dm" ? (
                  <span className="relative shrink-0">
                    <Face name={label} hue={hue} size="lg" />
                    {r.voiceCount > 0 ? (
                      <span className="absolute right-0 bottom-0 size-3 rounded-full bg-ok outline-2 outline-bg" />
                    ) : null}
                  </span>
                ) : (
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
                    style={{
                      background: `linear-gradient(145deg, hsl(${hue} 48% 38%), hsl(${hue} 42% 18%))`,
                    }}
                  >
                    {r.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      r.kind === "dm"
                        ? "flex items-center gap-1 font-extrabold"
                        : "flex items-center gap-1 font-extrabold capitalize"
                    }
                  >
                    {r.pinned && <Pin className="size-3.5 text-accent" aria-label="Pinned" />}
                    {label}
                  </p>
                  <p className="truncate text-sm text-muted">{preview ?? "No messages yet"}</p>
                </div>
                <span className="flex flex-col items-end gap-1 text-xs font-semibold text-subtle">
                  {r.lastAt ? timeAgo(r.lastAt) : ""}
                  {r.unread > 0 && (
                    <span
                      className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-fg"
                      aria-label={`${r.unread} unread`}
                    >
                      {r.unread}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {(q.data ?? []).length === 0 && (
        <p className="px-4 py-12 text-center text-sm text-muted">
          Join a community to inherit its lobby.
        </p>
      )}
    </AppShell>
  );
}
