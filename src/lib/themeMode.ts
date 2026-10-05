/**
 * Light / dark, persisted.
 *
 * Applied as `data-theme` on <html>, which flips every token in one go —
 * the same mechanism `.theme-admin` already uses for the admin palette.
 * Nothing component-level has to know about the mode.
 *
 * Worth recording what this does NOT buy: on an OLED phone, dark pixels are
 * switched off, so light mode draws MORE power and runs warmer. It is here
 * for daylight legibility and preference, not battery.
 */
export type ThemeMode = "dark" | "light" | "system";

const KEY = "dr_theme_mode";

export const THEME_MODES: ThemeMode[] = ["dark", "light", "system"];

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  system: "Match device",
};

/** Dark is the default: DateRoom is a candle-lit product by design. */
export function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "light" || raw === "system" ? raw : "dark";
  } catch {
    // Private mode / storage disabled — fall back rather than throw.
    return "dark";
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* best-effort */
  }
}

/** What the setting resolves to right now. */
export function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Puts the resolved theme on <html>.
 *
 * Only `light` sets the attribute; dark is the bare `:root`, so the absence
 * of the attribute is the dark theme rather than a third state to maintain.
 */
export function applyTheme(mode: ThemeMode): "dark" | "light" {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  if (resolved === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
  return resolved;
}
