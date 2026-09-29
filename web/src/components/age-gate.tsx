import { useState } from "react";
import { signOut } from "@/lib/auth/client";
import { confirmMinimumAge } from "@/lib/kamino/extras";
import { BirthdayFields, EMPTY_BIRTHDAY, judgeBirthday, YOUNG_MESSAGE, type Birthday } from "./birthday-fields";

/**
 * Shown over the app to a signed-in person who has not passed the 13+ birthday check yet
 * (for example, someone who signed up with a social account, which skips our sign-up form).
 */
export function AgeGate({ onDone }: { onDone: () => void }) {
  const [birthday, setBirthday] = useState<Birthday>(EMPTY_BIRTHDAY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const verdict = judgeBirthday(birthday);
    if (verdict.kind === "invalid") return setError(verdict.message);
    setBusy(true);
    setError("");
    try {
      // Under-13 answers are sent too: the server then erases the account instead of keeping it.
      const answer = await confirmMinimumAge({ data: { year: Number(birthday.year), month: Number(birthday.month), day: Number(birthday.day) } });
      if (!answer.ok) {
        setError(YOUNG_MESSAGE);
        await signOut().catch(() => undefined);
        return;
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <form className="age-gate-card suite-form" onSubmit={submit}>
        <h2 id="age-gate-title">One quick thing</h2>
        <p>Kamino is for people aged 13 and over. Tell us your birthday to continue.</p>
        <BirthdayFields value={birthday} onChange={setBirthday} />
        {error && <p role="alert" className="error-text">{error}</p>}
        <button type="submit" className="solid-button" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
      </form>
    </div>
  );
}
