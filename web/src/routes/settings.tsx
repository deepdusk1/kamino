import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { blockUser, exportMyData, getMe, updateSettings } from "@/lib/kamino/server";
import { deleteMyAccount } from "@/lib/kamino/extras";
import { importMyData } from "@/lib/kamino/library";
import { signOut } from "@/lib/auth/client";
import { PROFILE_COVERS } from "@/lib/kamino/titles";
import { BUBBLE_STYLES, MOOD_PRESETS } from "@/lib/kamino/types";
import { PROFILE_FRAMES } from "@/components/avatar-frame";
import { BUBBLE_STYLE_LABELS } from "@/lib/kamino/cosmetics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({ queryKey: ["me"], queryFn: () => getMe(), enabled: !!user });
  const [msg, setMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  if (isPending) return <AppShell title="Safety"><div className="h-24" /></AppShell>;
  if (!user) return <RedirectToSignIn />;
  const p = q.data?.profile;

  return (
    <AppShell title="Safety & account">
      <div className="space-y-8 px-4 py-5">
        <section className="rounded-2xl bg-surface p-5 shadow-border">
          <h2 className="font-display text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted">{user.primaryEmail ?? user.displayName}</p>
          <div className="mt-3">
            <UserButton />
          </div>
        </section>

        {p && (
          <form
            className="space-y-3 rounded-2xl bg-surface p-5 shadow-border"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void updateSettings({
                data: {
                  displayName: String(fd.get("displayName")),
                  bio: String(fd.get("bio")),
                  dmPrivacy: String(fd.get("dmPrivacy")),
                  hideJoined: fd.get("hideJoined") === "on",
                  showOnline: fd.get("showOnline") === "on",
                  ageConfirmed: fd.get("ageConfirmed") === "on",
                  cover: String(fd.get("cover") || p.cover || ""),
                  mood: String(fd.get("mood") || ""),
                  status: String(fd.get("status") || ""),
                  frame: String(fd.get("frame") || p.frame),
                  bubbleHue: Number(fd.get("bubbleHue") || p.bubbleHue),
                  bubbleStyle: String(fd.get("bubbleStyle") || p.bubbleStyle),
                  notifyLikes: fd.get("notifyLikes") === "on",
                  notifyComments: fd.get("notifyComments") === "on",
                  notifyFollows: fd.get("notifyFollows") === "on",
                  notifyChat: fd.get("notifyChat") === "on",
                  notifyWall: fd.get("notifyWall") === "on",
                },
              }).then(() => {
                setMsg("Saved.");
                void q.refetch();
              });
            }}
          >
            <h2 className="font-display text-lg font-semibold">Profile & privacy</h2>
            <label className="block text-sm">
              Display name
              <input name="displayName" defaultValue={p.displayName} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
            </label>
            <label className="block text-sm">
              Bio
              <textarea name="bio" defaultValue={p.bio} rows={3} className="mt-1 w-full rounded-lg bg-elevated px-3 py-2" />
            </label>
            <label className="block text-sm">
              Mood
              <input name="mood" defaultValue={p.mood} list="moods" placeholder="watching, drawing…" className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
              <datalist id="moods">
                {MOOD_PRESETS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm">
              Status
              <input name="status" defaultValue={p.status} placeholder="A one-line status" className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
            </label>
            <fieldset>
              <legend className="text-sm">Avatar frame</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PROFILE_FRAMES.map((f) => (
                  <label key={f.id} className="flex h-11 items-center gap-2 rounded-lg bg-elevated px-3 text-sm">
                    <input type="radio" name="frame" value={f.id} defaultChecked={p.frame === f.id} />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              Chat bubble hue
              <input type="range" name="bubbleHue" min={0} max={360} defaultValue={p.bubbleHue} className="mt-2 w-full" />
            </label>
            <fieldset>
              <legend className="text-sm">Chat bubble style</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {BUBBLE_STYLES.map((style) => (
                  <label key={style} className="flex h-11 items-center gap-2 rounded-lg bg-elevated px-3 text-sm">
                    <input type="radio" name="bubbleStyle" value={style} defaultChecked={p.bubbleStyle === style} />
                    {BUBBLE_STYLE_LABELS[style]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm">Profile cover</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PROFILE_COVERS.map((c) => (
                  <label key={c.id} className="block cursor-pointer">
                    <input type="radio" name="cover" value={c.src} defaultChecked={p.cover === c.src} className="sr-only" />
                    <img
                      src={c.src}
                      alt={c.label}
                      className={cn("h-14 w-full rounded-lg object-cover", p.cover === c.src && "outline outline-2 outline-accent")}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              Who can DM you
              <select name="dmPrivacy" defaultValue={p.dmPrivacy} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
                <option value="everyone">Everyone</option>
                <option value="members">People who share a community</option>
                <option value="none">No one</option>
              </select>
            </label>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="hideJoined" defaultChecked={p.hideJoined} />
              Hide joined communities on my public profile
            </label>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="showOnline" defaultChecked={p.showOnline} />
              Show online status in voice rooms
            </label>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="ageConfirmed" defaultChecked={p.ageConfirmed} />
              I confirm I am 16+ (required for 16+ halls)
            </label>
            <fieldset className="space-y-1">
              <legend className="text-sm font-bold">Notifications</legend>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="notifyLikes" defaultChecked={p.notifyLikes} /> Likes
              </label>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="notifyComments" defaultChecked={p.notifyComments} /> Comments
              </label>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="notifyFollows" defaultChecked={p.notifyFollows} /> Follows
              </label>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="notifyChat" defaultChecked={p.notifyChat} /> Chat
              </label>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="notifyWall" defaultChecked={p.notifyWall} /> Wall notes
              </label>
            </fieldset>
            {msg ? <p className="text-sm text-ok">{msg}</p> : null}
            <Button type="submit">Save</Button>
          </form>
        )}

        <section className="rounded-2xl bg-surface p-5 shadow-border">
          <h2 className="font-display text-lg font-semibold">Blocked</h2>
          <ul className="mt-3 space-y-2">
            {(q.data?.blocked ?? []).map((b) => (
              <li key={b.blocked_id} className="flex items-center justify-between text-sm">
                <span>
                  {b.display_name} · @{b.handle}
                </span>
                <Button size="sm" variant="secondary" onClick={() => void blockUser({ data: b.blocked_id }).then(() => q.refetch())}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
          {(q.data?.blocked ?? []).length === 0 && <p className="mt-2 text-sm text-muted">No one blocked.</p>}
        </section>

        <section className="rounded-2xl bg-surface p-5 shadow-border">
          <h2 className="font-display text-lg font-semibold">Your archive</h2>
          <p className="mt-1 text-sm text-muted">
            Take your writing with you. Download your full posts, wiki pages, quiz questions, drafts,
            characters, comments, your own chat messages, wall posts, and shared links as a JSON archive.
            Linked media stays linked; externally hosted files are not downloaded into the archive.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try { const payload = await exportMyData();
                const blob = new Blob([payload.json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "kamino-export.json";
                a.click();
                window.setTimeout(() => URL.revokeObjectURL(url),1000);
              } catch(e) {toast.error(e instanceof Error ? e.message : "Could not export your data");}
              finally {setExporting(false);}
            }}
          >
            {exporting ? "Preparing your archive…" : "Export my data"}
          </Button>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-bold">Bring your archive back</h3>
            <p className="mt-1 text-sm text-muted">
              Choose a file you exported before. Your posts and drafts come back as private drafts in the
              communities you are in, so nothing is published without you. Importing the same file twice is safe.
            </p>
            <input
              aria-label="Choose an archive file to import"
              type="file"
              accept="application/json,.json"
              disabled={importing}
              className="mt-3 w-full text-xs"
              onChange={async (e) => {
                const input = e.target;
                const file = input.files?.[0];
                input.value = "";
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) {
                  toast.error("That file is too large to import.");
                  return;
                }
                setImporting(true);
                try {
                  const result = await importMyData({ data: { json: await file.text() } });
                  toast.success(`Imported ${result.imported} draft${result.imported === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped}` : ""}.`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not import that file");
                } finally {
                  setImporting(false);
                }
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-5 shadow-border">
          <h2 className="font-display text-lg font-semibold">Delete account</h2>
          <p className="mt-1 text-sm text-muted">
            This permanently removes your profile, posts, comments, messages and follows. It cannot
            be undone. Download your archive first if you want a copy. Type DELETE to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="Type DELETE to confirm"
              className="rounded-xl bg-bg px-3 py-2 text-sm shadow-border"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="DELETE"
            />
            <Button
              variant="secondary"
              disabled={confirmDelete !== "DELETE"}
              onClick={async () => {
                try {
                  await deleteMyAccount({ data: { confirm: confirmDelete } });
                  await signOut("/");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not delete your account");
                }
              }}
            >
              Delete my account
            </Button>
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-5 text-sm text-muted shadow-border">
          <h2 className="font-display text-lg font-semibold text-fg">House laws</h2>
          <ul className="mt-3 list-disc space-y-1 pl-4">
            <li>13+ globally. Some halls are 16+.</li>
            <li>No harassment, hate, sexual content involving minors, or scams.</li>
            <li>Reports go to human leaders. No mystery auto-bans.</li>
            <li>Each community has its own persona. Don’t dox the person behind it.</li>
            <li>Private rooms stay private. Screenshots of reports are a ban.</li>
          </ul>
          <p className="mt-3">
            <a className="underline" href="/privacy">Privacy policy</a> ·{" "}
            <a className="underline" href="/terms">Terms of use</a>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
