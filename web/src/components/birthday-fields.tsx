import { checkBirthDate, MINIMUM_AGE } from "@/lib/kamino/age";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type Birthday = { month: string; day: string; year: string };
export const EMPTY_BIRTHDAY: Birthday = { month: "", day: "", year: "" };

/** Turns what was typed into a verdict the sign-up and age-gate screens can act on. */
export function judgeBirthday(b: Birthday): { kind: "ok"; year: number; month: number; day: number } | { kind: "young" } | { kind: "invalid"; message: string } {
  const year = Number(b.year);
  const month = Number(b.month);
  const day = Number(b.day);
  const result = checkBirthDate(year, month, day);
  if (!result.ok) return { kind: "invalid", message: "Enter your real birthday: month, day and a four-digit year." };
  if (result.age < MINIMUM_AGE) return { kind: "young" };
  return { kind: "ok", year, month, day };
}

export const YOUNG_MESSAGE = `Kamino is for people aged ${MINIMUM_AGE} and over, so we can't create an account for you. We don't keep the date you entered.`;

/** Month / day / year boxes. We only use the date to check the age; it is never saved. */
export function BirthdayFields({ value, onChange }: { value: Birthday; onChange: (next: Birthday) => void }) {
  return (
    <fieldset className="birthday-fields">
      <legend>Your birthday</legend>
      <div className="birthday-row">
        <select aria-label="Month" required value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })}>
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <input aria-label="Day" required inputMode="numeric" pattern="[0-9]*" maxLength={2} placeholder="Day" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value.replace(/\D/g, "") })} />
        <input aria-label="Year" required inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="Year" value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value.replace(/\D/g, "") })} />
      </div>
      <small>Used once to check your age, then thrown away. It is never saved or shown.</small>
    </fieldset>
  );
}
