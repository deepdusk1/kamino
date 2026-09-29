import { Link } from "@tanstack/react-router";
import { Lock, Users } from "lucide-react";
import type { Community } from "@/lib/kamino/types";

export function CommunityCard({ community }: { community: Community }) {
  return (
    <Link
      to="/c/$slug"
      params={{ slug: community.id }}
      className="group block overflow-hidden rounded-3xl bg-surface shadow-border transition-transform duration-200 ease-out hover:-translate-y-0.5"
    >
      <div className="relative h-28">
        {community.cover ? (
          <img src={community.cover} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-elevated" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
        {community.visibility !== "public" && (
          <span className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-bg/70 text-fg">
            <Lock className="size-3.5" />
          </span>
        )}
        <img
          src={community.cover}
          alt=""
          className="absolute -bottom-7 left-1/2 size-14 -translate-x-1/2 rounded-full object-cover outline outline-4 outline-surface"
        />
      </div>
      <div className="space-y-1 px-4 pt-9 pb-4 text-center">
        <p className="font-display text-base font-extrabold tracking-tight">{community.name}</p>
        <p className="line-clamp-2 text-sm text-muted">{community.tagline}</p>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-subtle">
          <Users className="size-3.5" />
          {community.memberCount} · {community.category}
        </p>
      </div>
    </Link>
  );
}
