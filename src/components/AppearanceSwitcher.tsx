import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  THEME_MODES,
  THEME_MODE_LABELS,
  applyTheme,
  loadThemeMode,
  saveThemeMode,
  type ThemeMode,
} from "@/lib/themeMode";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemeMode, typeof Sun> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

/**
 * Light / dark picker, beside the language switcher in Settings.
 *
 * Writes straight to <html> rather than through React state: every colour in
 * the app comes from CSS tokens, so flipping the attribute repaints
 * everything without a single component re-rendering. The local state here
 * exists only to show which option is selected.
 */
export function AppearanceSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(() => loadThemeMode());

  const pick = (next: ThemeMode) => {
    setMode(next);
    saveThemeMode(next);
    applyTheme(next);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Appearance
      </p>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="flex gap-1.5 rounded-2xl border border-white/[0.06] bg-secondary p-1.5"
      >
        {THEME_MODES.map((m) => {
          const Icon = ICONS[m];
          const selected = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(m)}
              className={cn(
                "focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] transition-colors",
                selected
                  ? "bg-primary/[0.16] font-semibold text-cream ring-1 ring-primary/50"
                  : "text-muted-foreground hover:text-cream",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {THEME_MODE_LABELS[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
