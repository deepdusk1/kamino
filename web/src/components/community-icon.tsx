import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { Community } from "@/lib/kamino/types";
import { cn } from "@/lib/utils";

export function CommunityIcon({
  community,
  size = "md",
}: {
  community: Pick<Community, "id" | "name" | "cover">;
  size?: "sm" | "md" | "lg";
}) {
  const dim = { sm: "size-12", md: "size-16", lg: "size-20" }[size];
  return (
    <Link
      to="/c/$slug"
      params={{ slug: community.id }}
      className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5"
    >
      <img
        src={community.cover}
        alt=""
        className={cn("rounded-full object-cover outline outline-2 outline-elevated", dim)}
      />
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">{community.name}</span>
    </Link>
  );
}

export function ExploreIcon() {
  return (
    <Link to="/explore" className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5">
      <span className="grid size-16 place-items-center rounded-full bg-accent text-accent-fg">
        <Plus className="size-7" strokeWidth={2.2} />
      </span>
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">Explore</span>
    </Link>
  );
}
