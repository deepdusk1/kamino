import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

/**
 * Kamino design tokens.
 *
 * The look: a soft, slowly moving "aurora" of colour behind everything, frosted-glass
 * surfaces on top, and bright violet → magenta gradients for the things you can press.
 * Every text colour was checked for contrast (WCAG AA, 4.5:1) on the background *and* on a
 * glass card sitting over the brightest part of the aurora, in both light and dark mode.
 */
export type Gradient = readonly [string, string, ...string[]];

export type Theme = {
  dark: boolean;
  /** Base colour behind the aurora (also the header colour). */
  bg: string;
  /** Solid surface, used where glass would be hard to read (inputs on Android, menus). */
  surface: string;
  elevated: string;
  fg: string;
  muted: string;
  subtle: string;
  accent: string;
  /** Text / icons placed on the accent colour or on a gradient. */
  accentFg: string;
  border: string;
  danger: string;
  ok: string;
  warn: string;
  /** Soft accent background (chips, selected rows). */
  tint: string;
  /** Brand gradient (lavender → violet → teal), same as the logo. */
  gradient: Gradient;
  /** Buttons, selected chips, your own chat bubbles. */
  gradPrimary: Gradient;
  /** Likes, streaks, celebrations. */
  gradWarm: Gradient;
  /** Secondary highlights. */
  gradCool: Gradient;
  /** Frosted card fill (see-through). */
  glass: string;
  /** Frosted fill used where there is no real blur (Android bars and sheets). */
  glassStrong: string;
  /** The bright inner edge that makes glass look like glass. */
  glassEdge: string;
  /** Hairline outside the glass so cards stay defined on light backgrounds. */
  hairline: string;
  /** Coloured shadow under floating things. */
  glow: string;
  /** The four aurora blob colours. */
  aurora: readonly [string, string, string, string];
  /** How strong the aurora blobs are (0–1). */
  auroraOpacity: number;
};

const light: Theme = {
  dark: false,
  bg: "#f6f2ff",
  surface: "#ffffff",
  elevated: "#efe8ff",
  fg: "#1d1433",
  muted: "#574d73",
  subtle: "#6a6189",
  accent: "#7c3aed",
  accentFg: "#ffffff",
  border: "#e4d9fb",
  danger: "#c81a60",
  ok: "#047857",
  warn: "#b45309",
  tint: "#efe7ff",
  gradient: ["#a78bfa", "#8b5cf6", "#22d3ee"],
  gradPrimary: ["#7c3aed", "#c026d3"],
  gradWarm: ["#e11d48", "#c2410c"],
  gradCool: ["#0891b2", "#7c3aed"],
  glass: "rgba(255,255,255,0.62)",
  glassStrong: "rgba(255,255,255,0.9)",
  glassEdge: "rgba(255,255,255,0.95)",
  hairline: "rgba(124,58,237,0.13)",
  glow: "#7c3aed",
  aurora: ["#c4b5fd", "#f9a8d4", "#67e8f9", "#fde68a"],
  auroraOpacity: 0.75,
};

const dark: Theme = {
  dark: true,
  bg: "#0b0820",
  surface: "#1a1438",
  elevated: "#241c4a",
  fg: "#f6f3ff",
  muted: "#c9bfe9",
  subtle: "#a298c8",
  accent: "#b39dff",
  accentFg: "#ffffff",
  border: "#322a5c",
  danger: "#ff6fa5",
  ok: "#5eead4",
  warn: "#fbbf24",
  tint: "#251d4b",
  gradient: ["#6d4de0", "#8b5cf6", "#0ea5b7"],
  gradPrimary: ["#7c3aed", "#c026d3"],
  gradWarm: ["#e11d48", "#c2410c"],
  gradCool: ["#0891b2", "#7c3aed"],
  glass: "rgba(30,22,64,0.55)",
  glassStrong: "rgba(24,18,52,0.9)",
  glassEdge: "rgba(255,255,255,0.14)",
  hairline: "rgba(255,255,255,0.07)",
  glow: "#8b5cf6",
  aurora: ["#7c3aed", "#db2777", "#0891b2", "#4f46e5"],
  auroraOpacity: 0.55,
};

/** A community can recolour the screens inside it (accent, buttons); everything else stays as it is. */
const OverrideContext = createContext<Partial<Theme> | null>(null);

export function ThemeOverride({ value, children }: { value: Partial<Theme> | null; children: ReactNode }) {
  return createElement(OverrideContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  const base = useColorScheme() === "dark" ? dark : light;
  const override = useContext(OverrideContext);
  return useMemo(() => (override ? { ...base, ...override } : base), [base, override]);
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** Font family names registered in `app/_layout.tsx` (Nunito, like the website). */
export const font = {
  regular: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  heavy: "Nunito_800ExtraBold",
} as const;

/** A community or member "hue" (0–360) becomes a friendly avatar colour. */
export function hueColor(hue: number, dark = false): string {
  return `hsl(${Math.round(hue) % 360}, ${dark ? 60 : 75}%, ${dark ? 48 : 60}%)`;
}

/** A lively two-colour gradient from a hue (avatars, community tiles without a cover). */
export function hueGradient(hue: number, dark = false): Gradient {
  const h = Math.round(hue) % 360;
  return [`hsl(${h}, ${dark ? 70 : 85}%, ${dark ? 55 : 66}%)`, `hsl(${(h + 45) % 360}, ${dark ? 65 : 75}%, ${dark ? 38 : 48}%)`];
}

/** A soft coloured shadow for floating things (iOS/web shadow + Android elevation). */
export function glowShadow(color: string, strength: "soft" | "strong" = "soft") {
  const strong = strength === "strong";
  return {
    shadowColor: color,
    shadowOpacity: strong ? 0.35 : 0.14,
    shadowRadius: strong ? 18 : 14,
    shadowOffset: { width: 0, height: strong ? 8 : 6 },
    elevation: strong ? 8 : 3,
  } as const;
}
