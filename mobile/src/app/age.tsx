import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/auth/session";
import { BirthdayFields, EMPTY_BIRTHDAY, judgeBirthday, YOUNG_MESSAGE } from "@/components/BirthdayFields";
import { Appear, Button, Glass, LogoOrb, Screen, Txt } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { radius, space } from "@/theme";

/**
 * Shown to a signed-in person who has not passed the 18+ birthday check yet
 * (for example an account created before the check existed, or through another sign-in method).
 */
export default function AgeCheck() {
  const insets = useSafeAreaInsets();
  const { confirmAge, signOut } = useSession();
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const verdict = judgeBirthday(birthday);
    if (verdict.kind === "invalid") return setError(verdict.message);
    setBusy(true);
    setError(null);
    try {
      // Under-13 answers are sent too: the server then erases the account instead of keeping it.
      const allowed = await confirmAge({ year: Number(birthday.year), month: Number(birthday.month), day: Number(birthday.day) });
      if (!allowed) setError(YOUNG_MESSAGE);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: insets.top + space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Appear><LogoOrb size={64} /></Appear>
        <Appear index={1}><Txt variant="display">One quick thing</Txt></Appear>
        <Appear index={2}><Txt tone="muted">Kamino is for adults aged 18 and over. Tell us your birthday to continue.</Txt></Appear>
      </View>
      <Appear index={3} style={{ padding: space.lg, paddingTop: space.xl }}>
        <Glass intensity={70} style={{ borderRadius: radius.xl, padding: space.xl, gap: space.lg }}>
          <BirthdayFields value={birthday} onChange={setBirthday} />
          {error ? <Txt tone="danger" accessibilityLiveRegion="polite">{error}</Txt> : null}
          <Button label="Continue" onPress={submit} busy={busy} />
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </Glass>
      </Appear>
    </Screen>
  );
}
