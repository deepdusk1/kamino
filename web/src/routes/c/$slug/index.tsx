import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Composer } from "@/components/composer";
import { Face } from "@/components/face";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCommunityPage, toggleFavorite, toggleLike, updatePersona } from "@/lib/kamino/server";
import { cn, levelFromRep } from "@/lib/utils";

export const Route = createFileRoute("/c/$slug/")({ component: CommunityFeed });

function CommunityFeed() {
  const { slug } = Route.useParams();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"featured" | "latest" | "following">("featured");
  const [open, setOpen] = useState(false);
  const page = useQuery({
    queryKey: ["community", slug, tab],
    queryFn: () => getCommunityPage({ data: { slug, tab } }),
  });
  const data = page.data;

  if (!data) {
    return <p className="px-4 py-12 text-center text-sm text-muted">Loading this hall…</p>;
  }

  const member = data.member?.status === "active" ? data.member : null;

  return (
    <div className="relative pb-24">
      <p className="px-4 pt-4 text-sm text-muted">{data.community.description}</p>

      {data.community.contentWarnings.length > 0 && (
        <p className="mx-4 mt-3 rounded-2xl bg-elevated px-3 py-2 text-xs text-warn">
          Content notes: {data.community.contentWarnings.join(" · ")} · Age {data.community.ageGate}+
        </p>
      )}

      {member && (
        <form
          className="mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 shadow-border"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void updatePersona({
              data: {
                slug,
                nickname: String(fd.get("nickname") || member.nickname),
                personaBio: String(fd.get("bio") || member.personaBio),
              },
            }).then(() => page.refetch());
          }}
        >
          <Face name={member.nickname} hue={member.personaHue} size="sm" level={levelFromRep(member.rep)} ring />
          <input
            name="nickname"
            defaultValue={member.nickname}
            className="h-10 min-w-0 flex-1 rounded-full bg-elevated px-3 text-sm"
            aria-label="Persona name"
          />
          <input
            name="bio"
            defaultValue={member.personaBio}
            placeholder="Persona bio — only in this community"
            className="h-10 min-w-0 flex-[2] rounded-full bg-elevated px-3 text-sm"
          />
          <Button size="sm" variant="secondary" type="submit">
            Save persona
          </Button>
        </form>
      )}

      {(data.broadcasts ?? []).length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl bg-elevated px-4 py-3">
          <p className="text-[11px] font-extrabold tracking-wide text-accent uppercase">Broadcast</p>
          <p className="text-sm">{data.broadcasts[0]!.body}</p>
        </div>
      )}

      {(data.announcements ?? []).length > 0 && (
        <div className="mt-3">
          {data.announcements.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onLike={async (id) => {
                await toggleLike({ data: id });
                void page.refetch();
              }}
              onSave={async (id) => {
                await toggleFavorite({ data: id });
                void page.refetch();
              }}
            />
          ))}
        </div>
      )}

      {(data.events ?? []).length > 0 && (
        <div className="mt-3 flex gap-3 overflow-x-auto px-4 k-scroll">
          {data.events.map((ev) => (
            <Link
              key={ev.id}
              to="/c/$slug/events"
              params={{ slug }}
              className="w-44 shrink-0 rounded-2xl bg-surface p-3 shadow-border"
            >
              <p className="text-[11px] font-extrabold tracking-wide text-accent uppercase">{ev.kind}</p>
              <p className="mt-1 line-clamp-2 text-sm font-bold">{ev.title}</p>
              <p className="mt-1 text-[11px] text-subtle">{ev.rsvpCount} going</p>
            </Link>
          ))}
        </div>
      )}

      {data.stories.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto px-4 pb-1 k-scroll">
          {data.stories.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate({ to: "/c/$slug/p/$postId", params: { slug, postId: String(s.id) } })}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span className="rounded-full bg-gradient-to-br from-accent to-[#d46cff] p-[2px]">
                {s.cover ? (
                  <img src={s.cover} alt="" className="size-14 rounded-full object-cover outline outline-2 outline-bg" />
                ) : (
                  <Face name={s.author.nickname} hue={s.author.hue} size="lg" className="outline outline-2 outline-bg" />
                )}
              </span>
              <p className="w-full truncate text-center text-[11px] font-semibold">{s.author.nickname}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-0 border-b border-border px-2">
        {(["featured", "latest", "following"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "h-11 px-3.5 text-sm font-extrabold capitalize",
              tab === t ? "amino-tab-active text-accent" : "text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {data.posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onLike={async (id) => {
              await toggleLike({ data: id });
              void page.refetch();
            }}
            onSave={async (id) => {
              await toggleFavorite({ data: id });
              void page.refetch();
            }}
          />
        ))}
      </div>
      {data.posts.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          {tab === "following" ? "Follow members to build this feed." : "No posts yet."}
        </p>
      )}

      <details className="mx-4 mt-6 mb-4 rounded-2xl bg-surface p-4 shadow-border">
        <summary className="cursor-pointer text-sm font-bold">House rules</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{data.community.rules}</p>
      </details>

      {member && user && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-24 z-20 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_8px_24px_color-mix(in_oklab,var(--color-accent)_45%,transparent)] md:bottom-8"
          aria-label="New post"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </button>
      )}

      {open && (
        <Composer
          slug={slug}
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false);
            void navigate({ to: "/c/$slug/p/$postId", params: { slug, postId: String(id) } });
          }}
        />
      )}
    </div>
  );
}
