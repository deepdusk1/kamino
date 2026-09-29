import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { glowShadow, radius, space, useTheme } from "@/theme";
import { Appear, PressableScale } from "./Motion";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Position in a list: the card floats in, slightly after the one above it. */
  index?: number;
};

/**
 * A frosted-glass card. The aurora behind it glows through; a bright top edge and a soft coloured
 * shadow make it look like a pane of glass. Tappable (with a springy press) when `onPress` is given.
 *
 * Cards are drawn without a live blur on purpose: long lists of blurred cards drain the battery.
 */
export function Card({ children, onPress, onLongPress, style, accessibilityLabel, index }: Props) {
  const theme = useTheme();
  const surface: ViewStyle = {
    backgroundColor: theme.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.hairline,
    padding: space.lg,
    gap: space.sm,
    ...glowShadow(theme.glow),
    // Android draws elevation shadows *through* see-through views (a grey smudge), so skip it there.
    ...(Platform.OS === "android" ? { elevation: 0 } : null),
  };
  const shine = (
    <LinearGradient
      colors={[theme.glassEdge, "rgba(255,255,255,0)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.shine, { opacity: theme.dark ? 0.35 : 0.55 }]}
    />
  );

  const body = onPress ? (
    <PressableScale onPress={onPress} onLongPress={onLongPress} accessibilityLabel={accessibilityLabel} style={[surface, style]} scaleTo={0.98}>
      {shine}
      {children}
    </PressableScale>
  ) : (
    <View style={[surface, style]}>
      {shine}
      {children}
    </View>
  );

  return index === undefined ? body : <Appear index={index}>{body}</Appear>;
}

const styles = StyleSheet.create({
  shine: { position: "absolute", left: 0, right: 0, top: 0, height: 36, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, pointerEvents: "none" },
});
