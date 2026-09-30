import {
  Award,
  BarChart3,
  BookOpen,
  Bookmark,
  Brain,
  Cake,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Film,
  Flame,
  Globe,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MessagesSquare,
  PenLine,
  Puzzle,
  Shield,
  Smile,
  Sparkles,
  Star,
  Sticker,
  StickyNote,
  Target,
  Theater,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Achievement } from "@/lib/kamino/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  pen: PenLine,
  chat: MessageCircle,
  heart: Heart,
  users: Users,
  flame: Flame,
  star: Star,
  message: MessagesSquare,
  sticker: Sticker,
  smile: Smile,
  globe: Globe,
  crown: Crown,
  shield: Shield,
  brain: Brain,
  target: Target,
  puzzle: Puzzle,
  chart: BarChart3,
  check: CheckCircle2,
  clock: Clock,
  book: BookOpen,
  image: ImageIcon,
  mask: Theater,
  film: Film,
  calendar: Calendar,
  trophy: Trophy,
  note: StickyNote,
  bookmark: Bookmark,
  sparkles: Sparkles,
  cake: Cake,
};

/** Banner colours per tier. Text is dark on the light tiers and white on the dark one, so it always reads well. */
const TIER_STYLE: Record<
  Achievement["tier"],
  { banner: string; text: string; label: string }
> = {
  bronze: { banner: "from-[#b87333] to-[#e0a574]", text: "text-[#2a1606]", label: "Bronze" },
  silver: { banner: "from-[#8e9aaf] to-[#dfe6ef]", text: "text-[#1b2230]", label: "Silver" },
  gold: { banner: "from-[#c9a227] to-[#f5d77a]", text: "text-[#241a02]", label: "Gold" },
  legend: {
    banner: "from-[#6a3de8] via-[#c2378f] to-[#f08a4b]",
    text: "text-white",
    label: "Legend",
  },
};

export function AchievementIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Award;
  return <Icon className={className} aria-hidden="true" />;
}

/** A showcase banner: the big, colourful strip shown under someone's name. */
export function AchievementBanner({ achievement }: { achievement: Achievement }) {
  const style = TIER_STYLE[achievement.tier];
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl bg-gradient-to-r px-3 py-2 shadow-sm",
        style.banner,
        style.text,
      )}
      title={`${achievement.name}: ${achievement.desc}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/30">
        <AchievementIcon icon={achievement.icon} className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold">{achievement.name}</span>
        <span className="block text-[10px] font-bold tracking-wide uppercase opacity-80">
          {style.label}
        </span>
      </span>
    </div>
  );
}

/** One achievement in the full list: unlocked ones in colour, locked ones grey with a progress bar. */
export function AchievementTile({
  achievement,
  showcased,
  onToggleShowcase,
}: {
  achievement: Achievement;
  showcased?: boolean;
  onToggleShowcase?: () => void;
}) {
  const style = TIER_STYLE[achievement.tier];
  const pct = Math.round((100 * achievement.progress) / Math.max(1, achievement.target));
  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface p-3 shadow-border",
        !achievement.unlocked && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            achievement.unlocked
              ? cn("bg-gradient-to-br", style.banner, style.text)
              : "bg-elevated text-subtle",
          )}
        >
          <AchievementIcon icon={achievement.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">{achievement.name}</p>
          <p className="text-[11px] text-muted">{achievement.desc}</p>
        </div>
        {achievement.unlocked && onToggleShowcase ? (
          <button
            type="button"
            onClick={onToggleShowcase}
            aria-pressed={showcased}
            aria-label={
              showcased
                ? `Stop showing ${achievement.name} on your profile`
                : `Show ${achievement.name} on your profile`
            }
            className={cn(
              "rounded-full p-1",
              showcased ? "text-accent" : "text-subtle hover:text-fg",
            )}
          >
            <Star className={cn("size-4", showcased && "fill-current")} />
          </button>
        ) : null}
      </div>
      {!achievement.unlocked ? (
        <div className="mt-2">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-elevated"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={achievement.target}
            aria-valuenow={achievement.progress}
            aria-label={`${achievement.name} progress`}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-subtle tabular-nums">
            {achievement.progress.toLocaleString()} / {achievement.target.toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-[10px] font-bold tracking-wide text-subtle uppercase">
          {style.label}
        </p>
      )}
    </li>
  );
}
