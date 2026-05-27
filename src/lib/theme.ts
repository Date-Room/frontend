/** Applies appearance from persisted profile (`theme_preference`). Default palette matches `:root` (dark). */

export type ThemePreference = "dark" | "light" | "system";

let mqCleanup: (() => void) | null = null;

export function detachThemePreferenceListener(): void {
  mqCleanup?.();
  mqCleanup = null;
}

export function applyThemePreference(pref?: string | null): void {
  if (typeof document === "undefined") return;

  detachThemePreferenceListener();

  const root = document.documentElement;
  root.classList.remove("light");

  const normalized =
    pref === "light" || pref === "dark" || pref === "system"
      ? pref
      : ("dark" satisfies ThemePreference);

  if (normalized === "light") {
    root.classList.add("light");
    return;
  }

  if (normalized === "dark") {
    return;
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    root.classList.toggle("light", !mq.matches);
  };
  sync();
  mq.addEventListener("change", sync);
  mqCleanup = () => mq.removeEventListener("change", sync);
}
