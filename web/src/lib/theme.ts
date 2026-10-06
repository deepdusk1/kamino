/**
 * Manual theme selection: "system" (default) follows the device colour scheme, "light" and
 * "dark" force it. The choice is stored in localStorage and applied as `<html data-theme>`,
 * which the stylesheet already honours (the system media query ignores its value when a manual
 * choice is present). Applied before first paint by the script in `__root.tsx` to avoid a flash.
 */

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "kamino.theme";

export function isThemeChoice(value: string | null | undefined): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export function readStoredTheme(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
  document.documentElement.style.colorScheme =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;
}

export function storeTheme(choice: ThemeChoice): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private browsing or storage disabled: the choice lasts for this visit only.
  }
  applyTheme(choice);
}

/** Inline script string for the document head: applies the stored theme before first paint. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}}catch(e){}})();`;

/** Keeps "system" in sync when the device scheme changes while the app is open. */
export function watchSystemTheme(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => applyTheme(readStoredTheme());
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
