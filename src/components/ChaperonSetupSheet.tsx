import { useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import {
  CHAPERON_MODE_META,
  CHAPERON_PRESETS,
  type ChaperonMode,
  type ChaperonStartConfig,
} from "@/lib/chaperon";
import { cn } from "@/lib/utils";

const PREFS_KEY = "dr_chaperon_prefs";

type Prefs = { mode: ChaperonMode; presetId: string; announcePresence: boolean };

const DEFAULT_PREFS: Prefs = { mode: "guardian", presetId: "safety", announcePresence: false };

export function loadChaperonPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

function saveChaperonPrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Config for a live start, from the current form. Data tier is `shadow` at
 *  launch (spec §7) — not user-facing in this slice. */
export function prefsToStartConfig(p: Prefs): ChaperonStartConfig {
  const preset =
    CHAPERON_PRESETS[p.mode].find((x) => x.id === p.presetId) ?? CHAPERON_PRESETS[p.mode][0];
  return {
    mode: p.mode,
    checks: preset.checks,
    announcePresence: p.announcePresence,
    dataTier: "shadow",
  };
}

export function ChaperonSetupSheet({
  open,
  onClose,
  variant,
  active = false,
  busy = false,
  transcriptSupported = true,
  onStart,
  onStop,
}: {
  open: boolean;
  onClose: () => void;
  variant: "live" | "preferences";
  active?: boolean;
  busy?: boolean;
  transcriptSupported?: boolean;
  onStart?: (cfg: ChaperonStartConfig) => void | Promise<void>;
  onStop?: () => void | Promise<void>;
}) {
  const [prefs, setPrefs] = useState<Prefs>(loadChaperonPrefs);

  if (!open) return null;

  const presets = CHAPERON_PRESETS[prefs.mode];
  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  function pickMode(mode: ChaperonMode) {
    // Reset the preset to the first of the new mode.
    update({ mode, presetId: CHAPERON_PRESETS[mode][0].id });
  }

  function handlePrimary() {
    saveChaperonPrefs(prefs);
    if (variant === "preferences") {
      onClose();
      return;
    }
    if (active) {
      void onStop?.();
    } else {
      void onStart?.(prefsToStartConfig(prefs));
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full space-y-5 overflow-y-auto rounded-t-3xl border border-white/10 bg-card/95 p-5 shadow-2xl backdrop-blur-xl sm:mx-4 sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
            <h2 className="font-serif text-lg text-cream">Chaperon</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground transition hover:text-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CHAPERON_MODE_META) as ChaperonMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pickMode(m)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition",
                prefs.mode === m
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
              )}
            >
              <p className="text-sm font-semibold text-cream">{CHAPERON_MODE_META[m].name}</p>
              <p className="text-[11px] text-muted-foreground">{CHAPERON_MODE_META[m].tagline}</p>
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            What it watches
          </p>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => update({ presetId: preset.id })}
              className={cn(
                "flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition",
                prefs.presetId === preset.id
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
              )}
            >
              <span className="text-sm font-medium text-cream">{preset.label}</span>
              <span className="text-[11px] text-muted-foreground">{preset.description}</span>
            </button>
          ))}
        </div>

        {/* Announce presence */}
        <label className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <input
            type="checkbox"
            checked={prefs.announcePresence}
            onChange={(e) => update({ announcePresence: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-emerald-500"
          />
          <span>
            <span className="block text-sm text-cream">Tell them a chaperon is on</span>
            <span className="block text-[11px] leading-relaxed text-muted-foreground">
              {prefs.announcePresence
                ? "They'll see a small badge. Safety cues stay private either way."
                : "Off — they see only the standard call notice. Safety cues are always private."}
            </span>
          </span>
        </label>

        {!transcriptSupported && variant === "live" && (
          <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2 text-[11px] leading-relaxed text-amber/90">
            This browser can't listen to the call, so cues will be limited. The
            native app hears the whole conversation.
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          DateRoom calls may be processed by an AI safety layer. Whispers are
          private to you — never shown to the other person.
        </p>

        <button
          type="button"
          onClick={handlePrimary}
          disabled={busy}
          className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-3.5 font-semibold disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {variant === "preferences"
            ? "Save for this date"
            : active
              ? "Turn chaperon off"
              : "Turn chaperon on"}
        </button>
      </div>
    </div>
  );
}
