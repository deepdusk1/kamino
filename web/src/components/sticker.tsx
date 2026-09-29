import { Flame, Gamepad2, Heart, Leaf, Moon, Music2, Sparkles, Star } from "lucide-react";
import { stickerEmoji, type StickerId } from "@/lib/kamino/stickers";
import { cn } from "@/lib/utils";

// The original eight keep their line-art look; every newer sticker is drawn as a large emoji.
const ICONS: Partial<Record<StickerId, typeof Heart>> = {
  heart: Heart,
  star: Star,
  spark: Sparkles,
  moon: Moon,
  fire: Flame,
  music: Music2,
  game: Gamepad2,
  leaf: Leaf,
};

export function StickerMark({ id, className }: { id: StickerId; className?: string }) {
  const Icon = ICONS[id];
  return (
    <span className={cn("grid size-14 place-items-center rounded-2xl bg-accent/20 text-accent", className)}>
      {Icon ? <Icon className="size-7" strokeWidth={1.8} /> : <span className="text-3xl leading-none" aria-hidden>{stickerEmoji(id)}</span>}
    </span>
  );
}
