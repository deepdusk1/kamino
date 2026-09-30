import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiBaseUrl } from "@/api/config";
import { BirthdayFields, EMPTY_BIRTHDAY, judgeBirthday, YOUNG_MESSAGE } from "@/components/BirthdayFields";
import { Appear, Button, Field, Glass, LogoOrb, Screen, Segmented, Sheet, Txt } from "@/components/ui";
import { useSession } from "@/auth/session";
import { errorMessage } from "@/lib/errors";
import { font, radius, space, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, requestPasswordReset } = useSession();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  // Validate up-front so people get a clear reason instead of a generic server error.
  function validate(): string | null {
    if (mode === "up" && name.trim().length < 2) return "Choose a display name (at least 2 characters).";
    if (!EMAIL.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Your password needs at least 8 characters.";
    if (mode === "up") {
      const verdict = judgeBirthday(birthday);
      if (verdict.kind === "young") return YOUNG_MESSAGE;
      if (verdict.kind === "invalid") return verdict.message;
    }
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const verdict = judgeBirthday(birthday);
      if (mode === "up" && verdict.kind === "ok") {
        await signUp(name, email, password, { year: verdict.year, month: verdict.month, day: verdict.day });
      } else {
        await signIn(email, password);
      }
      // On success the root layout swaps to the signed-in screens by itself.
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function sendReset() {
    if (!EMAIL.test(resetEmail.trim())) return setResetError("Enter the email you signed up with.");
    setResetState("sending");
    setResetError(null);
    try {
      await requestPasswordReset(resetEmail);
      setResetState("sent");
    } catch (e) {
      setResetError(errorMessage(e));
      setResetState("idle");
    }
  }

  const openWeb = (path: string) => void WebBrowser.openBrowserAsync(`${apiBaseUrl()}${path}`);

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, gap: space.md }}>
        <Appear style={{ marginLeft: -space.lg }}>
          <LogoOrb size={64} />
        </Appear>
        <Appear index={1}>
          <Txt variant="display" style={{ fontSize: 38, lineHeight: 44 }}>Find your people.{"\n"}<Txt variant="display" tone="accent" style={{ fontSize: 38, lineHeight: 44 }}>Feel at home.</Txt></Txt>
        </Appear>
        <Appear index={2}>
          <Txt tone="muted">Fandoms, friendships and late-night conversations, all in one little universe.</Txt>
        </Appear>
        <Appear index={3} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {(["No ads", "No spam"] as const).map((promise) => (
            <View key={promise} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.tint, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5, borderWidth: 1, borderColor: theme.hairline }}>
              <Ionicons name="checkmark-circle" size={14} color={theme.ok} />
              <Txt variant="caption" style={{ fontFamily: font.bold }}>{promise}</Txt>
            </View>
          ))}
        </Appear>
      </View>

      <Appear index={4} style={{ padding: space.lg, paddingTop: space.xl }}>
        <Glass intensity={70} style={{ borderRadius: radius.xl, padding: space.xl, gap: space.lg }}>
          <Segmented
            options={[{ key: "in", label: "Sign in" }, { key: "up", label: "Create account" }]}
            value={mode}
            onChange={(next) => { setMode(next); setError(null); }}
          />

          {mode === "up" ? <Field label="Display name" value={name} onChangeText={setName} autoComplete="nickname" maxLength={40} placeholder="What should we call you?" /> : null}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder="At least 8 characters" />

          {mode === "in" ? (
            <Pressable onPress={() => { setResetEmail(email); setResetState("idle"); setResetError(null); setResetOpen(true); }} accessibilityRole="button" style={{ alignSelf: "flex-end" }}>
              <Txt variant="small" tone="accent" style={{ fontFamily: font.bold }}>Forgot your password?</Txt>
            </Pressable>
          ) : null}
          {mode === "up" ? <BirthdayFields value={birthday} onChange={setBirthday} /> : null}

          {error ? <Txt tone="danger" accessibilityLiveRegion="polite">{error}</Txt> : null}
          <Button label={mode === "in" ? "Come on in" : "Create my account"} onPress={submit} busy={busy} />

          <Txt variant="caption" tone="subtle" style={{ textAlign: "center" }}>
            By continuing you agree to the{" "}
            <Txt variant="caption" tone="accent" onPress={() => openWeb("/terms")}>Terms</Txt> and{" "}
            <Txt variant="caption" tone="accent" onPress={() => openWeb("/privacy")}>Privacy policy</Txt>.
          </Txt>
        </Glass>
      </Appear>

      <Sheet visible={resetOpen} title="Reset your password" onClose={() => setResetOpen(false)}>
        {resetState === "sent" ? (
          <>
            <Txt>If an account exists for {resetEmail.trim()}, we’ve sent a link to choose a new password. It works for one hour.</Txt>
            <Button label="Done" onPress={() => setResetOpen(false)} />
          </>
        ) : (
          <>
            <Txt tone="muted">Enter your email and we’ll send you a reset link.</Txt>
            <Field label="Email" value={resetEmail} onChangeText={setResetEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={resetError} />
            <Button label="Send reset link" onPress={sendReset} busy={resetState === "sending"} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
