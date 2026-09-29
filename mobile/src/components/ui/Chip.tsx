import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { radius, space, useTheme } from "@/theme";
import { PressableScale } from "./Motion";
import { Txt } from "./Txt";

type Props = { label: string; selected?: boolean; onPress?: () => void; tone?: "default" | "danger" | "ok" };

/** A small pill: a filter, a tag, or a status. Selected filters light up with the brand gradient. */
export function Chip({ label, selected, onPress, tone = "default" }: Props) {
  const theme = useTheme();
  const bg = tone === "danger" ? (theme.dark ? "#3a1733" : "#fde6ef") : tone === "ok" ? (theme.dark ? "#10352f" : "#d7f6ec") : theme.tint;
  const textTone = selected ? "onAccent" : tone === "danger" ? "danger" : tone === "ok" ? "ok" : "accent";
  const body = (
    <View style={[styles.pill, { backgroundColor: selected ? "transparent" : bg, borderColor: selected ? "transparent" : theme.hairline }]}>
      {selected ? <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} /> : null}
      <Txt variant="caption" tone={textTone}>{label}</Txt>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.92} accessibilityState={{ selected: !!selected }} accessibilityLabel={label} hitSlop={6}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, borderWidth: 1, overflow: "hidden" },
});
