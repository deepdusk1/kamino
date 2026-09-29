import { View } from "react-native";
import { checkBirthDate, MINIMUM_AGE } from "@/lib/age";
import { Field, Txt } from "@/components/ui";
import { space } from "@/theme";

export type Birthday = { month: string; day: string; year: string };
export const EMPTY_BIRTHDAY: Birthday = { month: "", day: "", year: "" };

export const YOUNG_MESSAGE = `Kamino is for people aged ${MINIMUM_AGE} and over, so we can't create an account for you. We don't keep the date you entered.`;

/** Turns what was typed into a verdict the sign-up and age screens can act on. */
export function judgeBirthday(b: Birthday): { kind: "ok"; year: number; month: number; day: number } | { kind: "young" } | { kind: "invalid"; message: string } {
  const year = Number(b.year);
  const month = Number(b.month);
  const day = Number(b.day);
  const result = checkBirthDate(year, month, day);
  if (!result.ok) return { kind: "invalid", message: "Enter your real birthday: month, day and a four-digit year." };
  if (result.age < MINIMUM_AGE) return { kind: "young" };
  return { kind: "ok", year, month, day };
}

const digits = (text: string) => text.replace(/\D/g, "");

/** Month / day / year boxes. The date is only used to check the age; it is never saved. */
export function BirthdayFields({ value, onChange }: { value: Birthday; onChange: (next: Birthday) => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="caption" tone="muted">Your birthday</Txt>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field value={value.month} onChangeText={(t) => onChange({ ...value, month: digits(t) })} placeholder="MM" keyboardType="number-pad" maxLength={2} accessibilityLabel="Birth month" />
        </View>
        <View style={{ flex: 1 }}>
          <Field value={value.day} onChangeText={(t) => onChange({ ...value, day: digits(t) })} placeholder="DD" keyboardType="number-pad" maxLength={2} accessibilityLabel="Birth day" />
        </View>
        <View style={{ flex: 1.4 }}>
          <Field value={value.year} onChangeText={(t) => onChange({ ...value, year: digits(t) })} placeholder="YYYY" keyboardType="number-pad" maxLength={4} accessibilityLabel="Birth year" />
        </View>
      </View>
      <Txt variant="caption" tone="subtle">Used once to check your age, then thrown away. Never saved or shown.</Txt>
    </View>
  );
}
