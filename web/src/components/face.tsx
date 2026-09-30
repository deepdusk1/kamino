import { cn, initials } from "@/lib/utils";

export function Face({
  name,
  hue,
  size = "md",
  className,
  level,
  ring,
  userId,
  version,
}: {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg" | "xl" | "hero" | "call";
  className?: string;
  level?: number;
  ring?: boolean;
  /** With `version` above 0, shows the person's profile photo instead of their initials. */
  userId?: string;
  version?: number;
}) {
  const dim = {
    sm: "size-8 text-[11px]",
    md: "size-10 text-xs",
    lg: "size-14 text-sm",
    xl: "size-20 text-lg",
    hero: "size-28 text-2xl",
    call: "size-36 text-4xl",
  }[size];
  return (
    <span className={cn("relative inline-grid shrink-0", className)}>
      <span
        className={cn(
          "grid place-items-center overflow-hidden rounded-full font-display font-bold tracking-tight text-fg",
          dim,
          ring && "outline-2 outline-offset-2 outline-accent",
        )}
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 48% 38%), hsl(${hue} 42% 18%))`,
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, white 16%, transparent)",
        }}
        aria-hidden
      >
        {userId && version ? (
          <img
            src={`/api/v1/media/avatar/${encodeURIComponent(userId)}?v=${version}`}
            alt=""
            className="size-full rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          initials(name)
        )}
      </span>
      {level != null && (
        <span className="absolute -right-0.5 -bottom-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-fg">
          {level}
        </span>
      )}
    </span>
  );
}
