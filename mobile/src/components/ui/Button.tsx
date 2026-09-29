import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { font, glowShadow, radius, space, useTheme } from "@/theme";
import { PressableScale } from "./Motion";
import { Txt } from "./Txt";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The app's button. `primary` is a glowing violet → magenta gradient; `secondary` is soft glass;
 * `ghost` is text only; `danger` is for destructive actions. Presses spring and vibrate lightly.
 */
export function Button({ label, onPress, variant = "primary", busy, disabled, small, style, accessibilityHint }: Props) {
  const theme = useTheme();
  const inactive = !!(disabled || busy);
  const height = small ? 40 : 54;
  const primary = variant === "primary";

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      scaleTo={0.95}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!busy }}
      style={[
        styles.base,
        { height, opacity: inactive ? 0.55 : 1 },
        primary && !inactive && glowShadow(theme.glow, "strong"),
        variant === "secondary" && { backgroundColor: theme.tint, borderWidth: 1, borderColor: theme.hairline },
        variant === "danger" && { backgroundColor: theme.dark ? "#3a1733" : "#fde6ef" },
        variant === "ghost" && { backgroundColor: "transparent" },
        style,
      ]}
    >
      {primary ? (
        <>
          <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
          {/* Glassy highlight across the top half. */}
          <LinearGradient colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} style={[styles.gloss, { height: height / 2 }]} />
        </>
      ) : null}
      <View style={styles.inner}>
        {busy ? (
          <ActivityIndicator color={primary ? theme.accentFg : theme.accent} />
        ) : (
          <Txt variant={small ? "small" : "body"} style={{ fontFamily: font.heavy }} tone={primary ? "onAccent" : variant === "danger" ? "danger" : "accent"}>
            {label}
          </Txt>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { minWidth: 96, borderRadius: radius.pill, justifyContent: "center" },
  inner: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  gloss: { position: "absolute", left: 0, right: 0, top: 0, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill },
});
