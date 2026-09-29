export type ShelfKind = "mp4" | "youtube";

export type ShelfTitle = {
  id: string;
  title: string;
  year: string;
  tagline: string;
  kind: ShelfKind;
  url: string;
  poster: string;
};

/** Open movies we can actually stream. Locked catalogs (Netflix, etc.) cannot. */
export const SHELF: ShelfTitle[] = [
  {
    id: "bunny",
    title: "Big Buck Bunny",
    year: "2008",
    tagline: "Blender open movie",
    kind: "mp4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster: "/covers/starlight.jpg",
  },
  {
    id: "sintel",
    title: "Sintel",
    year: "2010",
    tagline: "Blender open movie",
    kind: "mp4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    poster: "/covers/nightwatch.jpg",
  },
  {
    id: "tears",
    title: "Tears of Steel",
    year: "2012",
    tagline: "Blender open movie",
    kind: "mp4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    poster: "/covers/keep.jpg",
  },
  {
    id: "elephants",
    title: "Elephants Dream",
    year: "2006",
    tagline: "The first open movie",
    kind: "mp4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster: "/covers/ink-lore.jpg",
  },
];

const LOCKED =
  /\b(netflix|disneyplus|disney\+|hulu|max\.com|primevideo|amazon\.com\/gp\/video|hbomax|crunchyroll|paramountplus)\b/i;

export function parseWatchInput(raw: string): { kind: ShelfKind; url: string; title: string } | { error: string } {
  const t = raw.trim();
  if (!t) return { error: "Paste a YouTube link or pick a film." };
  if (LOCKED.test(t)) {
    return {
      error: "Netflix and other locked catalogs won’t share playback. Paste a YouTube link or pick a film from the shelf.",
    };
  }
  const yt =
    t.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/) ??
    t.match(/^([A-Za-z0-9_-]{11})$/);
  if (yt) {
    const id = yt[1]!;
    return { kind: "youtube", url: `https://www.youtube.com/watch?v=${id}`, title: "YouTube" };
  }
  if (/^https?:\/\//i.test(t) && (/\.mp4(\?|$)/i.test(t) || /\.webm(\?|$)/i.test(t))) {
    return { kind: "mp4", url: t, title: "Direct video" };
  }
  if (/^https?:\/\//i.test(t)) {
    return { error: "Need a YouTube link or a direct .mp4. Locked apps won’t play here." };
  }
  return { error: "Need a YouTube link or a film from the shelf." };
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1] ?? null;
}
