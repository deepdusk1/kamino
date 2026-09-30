import type { Ionicons } from "@expo/vector-icons";
import type { Achievement } from "@/api/types";

type IconName = keyof typeof Ionicons.glyphMap;

/** The server sends a small icon word (see web/src/lib/kamino/achievements.ts); this is the phone's icon for it. */
const ICONS: Record<string, IconName> = {
  pen: "create-outline", chat: "chatbubble-outline", heart: "heart-outline", users: "people-outline", flame: "flame-outline",
  star: "star-outline", message: "chatbubbles-outline", sticker: "color-palette-outline", smile: "happy-outline",
  globe: "globe-outline", crown: "ribbon-outline", shield: "shield-checkmark-outline", brain: "bulb-outline",
  target: "locate-outline", puzzle: "extension-puzzle-outline", chart: "bar-chart-outline", check: "checkbox-outline",
  clock: "time-outline", book: "book-outline", image: "image-outline", mask: "color-wand-outline", film: "film-outline",
  calendar: "calendar-outline", trophy: "trophy-outline", note: "document-text-outline", bookmark: "bookmark-outline",
  sparkles: "sparkles-outline", cake: "gift-outline",
};

export function achievementIcon(icon: string): IconName {
  return ICONS[icon] ?? "medal-outline";
}

/** Banner colours per tier, and a text colour that reads well on them (dark on the light tiers, white on legend). */
export const TIER_LOOK: Record<Achievement["tier"], { colors: [string, string]; text: string; label: string }> = {
  bronze: { colors: ["#b87333", "#e0a574"], text: "#2a1606", label: "Bronze" },
  silver: { colors: ["#8e9aaf", "#dfe6ef"], text: "#1b2230", label: "Silver" },
  gold: { colors: ["#c9a227", "#f5d77a"], text: "#241a02", label: "Gold" },
  legend: { colors: ["#6a3de8", "#c2378f"], text: "#ffffff", label: "Legend" },
};

/** Share of the way to the target, 0 to 1 (for progress bars). */
export function progressShare(a: Pick<Achievement, "progress" | "target" | "unlocked">): number {
  if (a.unlocked) return 1;
  return Math.max(0, Math.min(1, a.progress / Math.max(1, a.target)));
}

/** Achievements grouped by category, in the order the server sends them. */
export function byCategory(list: Achievement[]): { category: string; items: Achievement[] }[] {
  const groups = new Map<string, Achievement[]>();
  for (const a of list) groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  return [...groups].map(([category, items]) => ({ category, items }));
}

/** Adds or removes an id from the showcase, keeping at most three (the newest choice wins). */
export function toggleShowcase(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-3);
}
