import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  applyCoachBeta,
  COACH_PRICE_BLURB,
  getCoachBetaStatus,
  type ChaperonStartConfig,
  type CoachBetaStatus,
} from "@/lib/chaperon";

const PREFS_KEY = "dr_chaperon_prefs";

type Prefs = { coach: boolean; announcePresence: boolean };

// announcePresence defaults ON: Chaperon processes the other person's voice
// too, so the fair default is to let them know one may be on the call. The user
// can still turn it off. See the Privacy policy's "AI safety layer" section.
const DEFAULT_PREFS: Prefs = { coach: false, announcePresence: true };

function loadChaperonPrefs(): Prefs {
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

/** Config for a live start. Protect is always the baseline (`guardian`);
 *  Coach upgrades the same session to `coached` (Protect + coaching), but only
 *  when the user actually has beta calls. Data tier is `shadow` at launch. */
function prefsToStartConfig(p: Prefs, coachAvailable: boolean): ChaperonStartConfig {
  return {
    mode: p.coach && coachAvailable ? "coached" : "guardian",
    checks: [], // server fills the mode's default checks
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
  onStart,
  onStop,
}: {
  open: boolean;
  onClose: () => void;
  variant: "live" | "preferences";
  active?: boolean;
  busy?: boolean;
  onStart?: (cfg: ChaperonStartConfig) => void | Promise<void>;
  onStop?: () => void | Promise<void>;
}) {
  const [prefs, setPrefs] = useState<Prefs>(loadChaperonPrefs);

  // Coach entitlement — only fetched while the sheet is open.
  const { data: coach, refetch: refetchCoach } = useQuery({
    queryKey: ["coach-beta-status"],
    queryFn: getCoachBetaStatus,
    enabled: open,
  });
  const coachAvailable = (coach?.calls_remaining ?? 0) > 0;

  if (!open) return null;

  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  function handlePrimary() {
    saveChaperonPrefs(prefs);
    if (variant === "preferences") {
      onClose();
      return;
    }
    if (active) {
      void onStop?.();
    } else {
      void onStart?.(prefsToStartConfig(prefs, coachAvailable));
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

        {/* Protect — the free safety baseline, always on when the chaperon is on. */}
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
            <p className="text-sm font-semibold text-cream">Protect</p>
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Free · on
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Quietly watches for scams, pressure, and money asks, and whispers only
            to you. On for every date.
          </p>
        </div>

        {/* Coach — the gated premium layer. */}
        <CoachCard
          status={coach}
          enabled={prefs.coach}
          available={coachAvailable}
          onToggle={(v) => update({ coach: v })}
          onApplied={() => void refetchCoach()}
        />

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

        {variant === "live" && active && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            The chaperon listens to the whole call from our server (both sides).
            The status panel on the call shows, live, whether it's hearing each of
            you — no mic setup needed here.
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

/** Coach's four states: available (toggle + calls left), applied (pending),
 *  and not-yet (apply for beta, with the price and the labeling deal). */
function CoachCard({
  status,
  enabled,
  available,
  onToggle,
  onApplied,
}: {
  status: CoachBetaStatus | undefined;
  enabled: boolean;
  available: boolean;
  onToggle: (v: boolean) => void;
  onApplied: () => void;
}) {
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);
  const appStatus = status?.application_status ?? null;

  async function apply() {
    setApplying(true);
    try {
      await applyCoachBeta(reason.trim());
      toast.success("Application sent — we'll be in touch.");
      setReason("");
      onApplied();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't send your application.");
    } finally {
      setApplying(false);
    }
  }

  const header = (
    <div className="flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-amber-400" aria-hidden />
      <p className="text-sm font-semibold text-cream">Coach</p>
      <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        Premium · beta
      </span>
    </div>
  );

  // Available → a real toggle with the remaining count.
  if (available) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
        {header}
        <label className="mt-2 flex items-start gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-500"
          />
          <span>
            <span className="block text-sm text-cream">
              Add coaching cues to this date
            </span>
            <span className="block text-[11px] leading-relaxed text-muted-foreground">
              Reads chemistry and flow and nudges you, on top of Protect.{" "}
              {status?.calls_remaining} beta call{status?.calls_remaining === 1 ? "" : "s"} left
              · one is used per date.
            </span>
          </span>
        </label>
      </div>
    );
  }

  // Applied and waiting.
  if (appStatus === "pending") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        {header}
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Application received — we'll let you in as beta spots open. Thanks for
          helping us test it.
        </p>
      </div>
    );
  }

  // Not yet (never applied, declined, or used up) → apply / re-apply.
  const usedUp = appStatus === "granted";
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
      {header}
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {usedUp
          ? "You've used your beta Coach calls. Ask for more below."
          : "A private wing that reads chemistry and flow and coaches you, on top of Protect."}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-300/80">{COACH_PRICE_BLURB} In exchange, your 👍/👎 on cues helps train it.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="One line: why you'd like Coach…"
          className="focus-ring min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px] placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          disabled={applying}
          onClick={() => void apply()}
          className="btn-primary focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {usedUp ? "Request more" : "Apply"}
        </button>
      </div>
    </div>
  );
}
