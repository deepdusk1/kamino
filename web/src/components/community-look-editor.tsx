import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { communityColors } from "@/lib/kamino/theme";
import { PROFILE_COVERS } from "@/lib/kamino/titles";
import { getCommunityPage, updateCommunityLook } from "@/lib/kamino/server";
import { THEME_STYLES, type Community, type ThemeStyle } from "@/lib/kamino/types";
import { cn } from "@/lib/utils";

const STYLE_LABELS: Record<ThemeStyle, string> = {
  aurora: "Aurora",
  solid: "Solid",
  vivid: "Vivid",
  soft: "Soft",
  night: "Night",
};
const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Reads a chosen picture file as a data URL, or explains what is wrong with it. */
function readPicture(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!PICTURE_TYPES.includes(file.type))
      return reject(new Error("Choose a PNG, JPEG or WebP picture."));
    if (file.size > maxBytes)
      return reject(
        new Error(
          `That picture is too large (limit ${Math.round((maxBytes / 1024 / 1024) * 10) / 10} MB).`,
        ),
      );
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that picture."));
    reader.readAsDataURL(file);
  });
}

/** Leaders: name, words, colour, style, banner and icon of the community, with a live preview. */
export function CommunityLookEditor({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityPage({ data: { slug } }),
  });
  const c = q.data?.community;
  if (!c) return null;
  // Keyed by the saved values, so the form starts fresh after every save.
  return (
    <Editor
      key={`${c.name}|${c.hue}|${c.themeStyle}|${c.cover}|${c.icon}`}
      slug={slug}
      community={c}
    />
  );
}

function Editor({ slug, community: c }: { slug: string; community: Community }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(c.name);
  const [tagline, setTagline] = useState(c.tagline);
  const [description, setDescription] = useState(c.description);
  const [rules, setRules] = useState(c.rules);
  const [hue, setHue] = useState(c.hue);
  const [style, setStyle] = useState<ThemeStyle>(c.themeStyle);
  const [cover, setCover] = useState(c.cover);
  const [coverUpload, setCoverUpload] = useState<string | undefined>();
  const [iconUpload, setIconUpload] = useState<string | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colors = communityColors(hue, style);
  const shownCover = coverUpload ?? cover;
  const shownIcon = iconUpload === null ? "" : (iconUpload ?? c.icon);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateCommunityLook({
        data: {
          slug,
          name,
          tagline,
          description,
          rules,
          hue,
          themeStyle: style,
          ...(coverUpload !== undefined ? { coverUpload } : cover !== c.cover ? { cover } : {}),
          ...(iconUpload !== undefined ? { iconUpload } : {}),
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Saved. Your community looks new.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File | undefined, maxBytes: number, apply: (dataUrl: string) => void) {
    if (!file) return;
    try {
      apply(await readPicture(file, maxBytes));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that picture.");
    }
  }

  return (
    <section className="glass-card rounded-2xl p-4" aria-labelledby="look-title">
      <h2 id="look-title" className="font-display text-lg font-semibold">
        Community look
      </h2>
      <p className="mb-3 text-sm text-muted">
        Name, words, colour, banner and icon. Every option is free. Uploaded pictures are shown
        publicly on listings.
      </p>

      <div className="relative mb-4 overflow-hidden rounded-2xl" aria-label="Preview">
        {shownCover ? (
          <img src={shownCover} alt="" className="h-28 w-full object-cover" />
        ) : (
          <div className="h-28" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(120deg, ${colors.from}, ${colors.to})`,
            opacity: colors.tint,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
          {shownIcon ? (
            <img
              src={shownIcon}
              alt=""
              className="size-10 rounded-full object-cover outline outline-2 outline-white"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">{name || "Name"}</p>
            <p className="truncate text-xs opacity-90">{tagline}</p>
          </div>
          <span
            className="ml-auto rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: colors.accent, color: colors.accentFg }}
          >
            Join
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3"
          />
        </label>
        <label className="block text-sm">
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={120}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3"
          />
        </label>
        <label className="block text-sm">
          About
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            className="mt-1 w-full rounded-lg bg-elevated px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Rules
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={2000}
            rows={4}
            className="mt-1 w-full rounded-lg bg-elevated px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Colour
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="Community colour"
          />
        </label>
        <fieldset>
          <legend className="text-sm">Colour style</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEME_STYLES.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex h-10 cursor-pointer items-center gap-2 rounded-full bg-elevated px-4 text-sm",
                  style === s && "outline outline-2 outline-accent",
                )}
              >
                <input
                  type="radio"
                  name="themeStyle"
                  value={s}
                  checked={style === s}
                  onChange={() => setStyle(s)}
                  className="sr-only"
                />
                {STYLE_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm">Banner</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PROFILE_COVERS.map((b) => (
              <label key={b.id} className="block cursor-pointer">
                <input
                  type="radio"
                  name="banner"
                  checked={!coverUpload && cover === b.src}
                  onChange={() => {
                    setCover(b.src);
                    setCoverUpload(undefined);
                  }}
                  className="sr-only"
                />
                <img
                  src={b.src}
                  alt={b.label}
                  className={cn(
                    "h-14 w-full rounded-lg object-cover",
                    !coverUpload && cover === b.src && "outline outline-2 outline-accent",
                  )}
                />
              </label>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            Or upload your own (PNG, JPEG or WebP, up to 1.5 MB)
            <input
              type="file"
              accept={PICTURE_TYPES.join(",")}
              className="mt-1 w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void pick(f, 1.5 * 1024 * 1024, setCoverUpload);
              }}
            />
          </label>
        </fieldset>
        <div>
          <p className="text-sm">Icon</p>
          <div className="mt-2 flex items-center gap-3">
            {shownIcon ? (
              <img
                src={shownIcon}
                alt="Community icon"
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-14 place-items-center rounded-full bg-elevated text-xs text-subtle">
                None
              </span>
            )}
            <input
              aria-label="Upload an icon"
              type="file"
              accept={PICTURE_TYPES.join(",")}
              className="w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void pick(f, 220 * 1024, setIconUpload);
              }}
            />
            {shownIcon ? (
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => setIconUpload(null)}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button className="mt-4" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save look"}
      </Button>
    </section>
  );
}
