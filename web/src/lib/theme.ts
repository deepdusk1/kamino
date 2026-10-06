/**
 * Manual light/dark theme override. The stylesheet already honours
 * `data-theme="dark"` / `data-theme="light"` on <html> (see styles.css);
 * without the attribute the OS colour-scheme preference applies.
 * The choice lives in localStorage so it works signed-out and applies
 * before first paint via the inline script in __root.tsx.
 */

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "kamino-theme";

export function getThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage unavailable (private mode etc.): fall through to system */
  }
  return "system";
}

/** Applies the choice to <html> immediately (no waiting for React). */
export function applyThemeChoice(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* ignore: the in-memory apply below still works for this visit */
  }
  applyThemeChoice(choice);
}
