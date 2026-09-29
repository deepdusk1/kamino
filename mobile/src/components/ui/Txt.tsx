import { Text, type TextProps, type TextStyle } from "react-native";
import { font, useTheme } from "@/theme";

type Variant = "display" | "title" | "heading" | "body" | "small" | "caption" | "label";

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: font.heavy, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: font.heavy, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: font.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase" },
};

type Props = TextProps & {
  variant?: Variant;
  tone?: "default" | "muted" | "subtle" | "accent" | "danger" | "ok" | "onAccent";
};

/** The one text component: consistent font, size and colour everywhere. */
export function Txt({ variant = "body", tone = "default", style, ...rest }: Props) {
  const theme = useTheme();
  const color = {
    default: theme.fg,
    muted: theme.muted,
    subtle: theme.subtle,
    accent: theme.accent,
    danger: theme.danger,
    ok: theme.ok,
    onAccent: theme.accentFg,
  }[tone];
  return <Text {...rest} style={[variants[variant], { color }, style]} />;
}
