import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Compass, Loader2, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  applyCoachBeta,
  COACH_PRICE_BLURB,
  getCoachBetaStatus,
  getProtectStatus,
  protectPill,
  type CoachBetaStatus,
} from "@/lib/chaperon";
import type { ChaperonStartConfig } from "@/hooks/useChaperon";
import { cn } from "@/lib/utils";

const PREFS_KEY = "dr_chaperon_prefs";
const AUTOSTART_PREFIX = "dr_chaperon_autostart:";

export type Prefs = { protect: boolean; coach: boolean; announcePresence: boolean };

// Protect defaults OFF: a thing consciously turned on is a thing noticed and
// valued, and the sheet says what you have to spend ("1 free date").
// announcePresence defaults ON: the chaperon processes the other person's
// voice too, so the fair default is to let them know. See Privacy.
const DEFAULT_PREFS: Prefs = { protect: false, coach: false, announcePresence: true };

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

/** Pre-room "Save for this date" with Protect on means: start it on entry,
 *  once, for this room. Consumed by the in-room mount. */
export function setChaperonAutostart(roomId: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(AUTOSTART_PREFIX + roomId, "1");
    else localStorage.removeItem(AUTOSTART_PREFIX + roomId);
  } catch {
    /* ignore */
  }
}

export function takeChaperonAutostart(roomId: string): boolean {
  try {
    const key = AUTOSTART_PREFIX + roomId;
    const on = localStorage.getItem(key) === "1";
    if (on) localStorage.removeItem(key);
    return on;
  } catch {
    return false;
  }
}

/** Config for a live start. Protect is the baseline (`guardian`); Coach
 *  upgrades the same session to `coached` (Protect + coaching) when the user
 *  has beta calls. The server decides the data tier; `shadow` is the wire
 *  default older servers expect. */
export function prefsToStartConfig(p: Prefs, coachAvailable: boolean): ChaperonStartConfig {
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
  roomId,
  partnerName,
  active = false,
  busy = false,
  onStart,
  onStop,
  onOpenStatus,
}: {
  open: boolean;
  onClose: () => void;
  variant: "live" | "preferences";
  /** Needed by the preferences variant to arm the on-entry start. */
  roomId?: string;
  /** The other person's real name, from presence; falls back to "them". */
  partnerName?: string | null;
  active?: boolean;
  busy?: boolean;
  onStart?: (cfg: ChaperonStartConfig) => void | Promise<void>;
  onStop?: () => void | Promise<void>;
  /** Live variant: open the in-call status panel (rows + diagnostics). */
  onOpenStatus?: () => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(loadChaperonPrefs);

  // Entitlements — only fetched while the sheet is open.
  const { data: coach, refetch: refetchCoach } = useQuery({
    queryKey: ["coach-beta-status"],
    queryFn: getCoachBetaStatus,
    enabled: open,
  });
  const { data: protect } = useQuery({
    queryKey: ["protect-status"],
    queryFn: getProtectStatus,
    enabled: open,
  });
  const coachAvailable = (coach?.calls_remaining ?? 0) > 0;
  const pill = protectPill(protect);
  const them = partnerName?.trim() || "them";

  if (!open) return null;

  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  // Coach rides on Protect (coached = Protect + coaching); no Protect, no Coach.
  const protectOn = prefs.protect;
  const coachOn = protectOn && prefs.coach && coachAvailable;

  function handlePrimary() {
    saveChaperonPrefs(prefs);
    if (variant === "preferences") {
      if (roomId) setChaperonAutostart(roomId, protectOn);
      onClose();
      return;
    }
    if (active) {
      void onStop?.();
    } else if (protectOn) {
      void onStart?.(prefsToStartConfig(prefs, coachAvailable));
    }
    onClose();
  }

  const primaryLabel = active
    ? "Turn chaperon off"
    : !protectOn
      ? "Choose what you want"
      : variant === "preferences"
        ? pill.tone === "free" && !protect?.free_used
          ? "Use my free protected date"
          : "Save for this date"
        : pill.tone === "free" && !protect?.free_used
          ? "Use my free protected date"
          : "Turn chaperon on";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chaperon"
        className="max-h-[85dvh] w-full space-y-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-card/95 p-5 shadow-2xl backdrop-blur-xl sm:mx-4 sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl leading-tight text-cream">Want me in the room?</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              I never speak aloud. Everything I notice comes to you alone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -mr-1 -mt-1 rounded-full p-1 text-muted-foreground transition hover:text-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Protect — the safety baseline. Off until turned on; the pill says
            what there is to spend. */}
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
            protectOn
              ? "border-emerald-500/30 bg-emerald-500/[0.07]"
              : "border-white/[0.08] bg-white/[0.02]",
          )}
        >
          <ShieldCheck
            className={cn("mt-0.5 h-4 w-4", protectOn ? "text-emerald-400" : "text-cream/50")}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-cream">Protect</span>
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  pill.tone === "empty"
                    ? "bg-white/10 text-cream/60"
                    : "bg-emerald-500/15 text-emerald-300",
                )}
              >
                {pill.label}
              </span>
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
              Scams, pressure and money asks, caught as they happen. Off until you turn it on.
            </span>
          </span>
          <Toggle
            checked={protectOn}
            disabled={active}
            onChange={(v) => update({ protect: v })}
            label="Protect"
          />
        </label>

        {/* Coach — Protect plus coaching, gated beta. */}
        <CoachCard
          status={coach}
          enabled={coachOn}
          available={coachAvailable}
          disabled={!protectOn || active}
          onToggle={(v) => update({ coach: v })}
          onApplied={() => void refetchCoach()}
        />

        {/* Disclosure */}
        <label className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-cream">Tell {them} I'm here</span>
            <span className="block text-[11px] leading-relaxed text-muted-foreground">
              {prefs.announcePresence
                ? `${them === "them" ? "They" : them} will see a small badge. What I notice stays with you either way.`
                : "Off. They see only the standard call notice. What I notice stays with you."}
            </span>
          </span>
          <Toggle
            checked={prefs.announcePresence}
            onChange={(v) => update({ announcePresence: v })}
            label="Tell them a chaperon is on"
          />
        </label>

        {variant === "live" && active && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            I listen to the whole call from our server, both sides.{" "}
            {onOpenStatus ? (
              <button
                type="button"
                onClick={() => {
                  onOpenStatus();
                  onClose();
                }}
                className="text-primary hover:underline"
              >
                How I'm doing right now
              </button>
            ) : (
              "The status in the call shows, live, whether I am hearing each of you."
            )}
          </p>
        )}

        <button
          type="button"
          onClick={handlePrimary}
          disabled={busy || (!active && !protectOn)}
          className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-3.5 font-semibold disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {primaryLabel}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Calls may be processed by an AI safety layer.{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            What that means
          </Link>
        </p>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "focus-ring relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40",
        checked ? "bg-emerald-400" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all",
          checked ? "left-[23px]" : "left-[3px] opacity-80",
        )}
      />
    </button>
  );
}

/** Coach's states: available (toggle + calls left), applied (pending),
 *  and not-yet / used-up (apply, with the price and the tuning deal). */
function CoachCard({
  status,
  enabled,
  available,
  disabled,
  onToggle,
  onApplied,
}: {
  status: CoachBetaStatus | undefined;
  enabled: boolean;
  available: boolean;
  disabled: boolean;
  onToggle: (v: boolean) => void;
  onApplied: () => void;
}) {
  const appStatus = status?.application_status ?? null;
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);

  async function apply() {
    setApplying(true);
    try {
      await applyCoachBeta(reason.trim());
      toast.success("Applied. I'll let you know when there's a spot.");
      onApplied();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't apply just now");
    } finally {
      setApplying(false);
    }
  }

  const header = (
    <span className="flex items-center gap-2">
      <Compass className="h-4 w-4 text-amber-400" aria-hidden />
      <span className="text-sm font-semibold text-cream">Coach</span>
      <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        {available
          ? `${status?.calls_remaining} beta call${status?.calls_remaining === 1 ? "" : "s"}`
          : "Premium · beta"}
      </span>
    </span>
  );

  // Available → a real toggle with the remaining count.
  if (available) {
    return (
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
          enabled ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]",
          disabled && "opacity-60",
        )}
      >
        <span className="min-w-0 flex-1">
          {header}
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
            Private nudges on chemistry, pace and flow, on top of Protect. One call is used per
            date. Your reactions to cues help me tune it.
          </span>
        </span>
        <Toggle checked={enabled} disabled={disabled} onChange={onToggle} label="Coach" />
      </label>
    );
  }

  // Applied and waiting.
  if (appStatus === "pending") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        {header}
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Got it. I'll let you in as beta spots open; you'll see it here.
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
          : appStatus === "declined"
            ? "Not this time. You can ask again below."
            : "Private nudges on chemistry, pace and flow, on top of Protect."}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-300/80">
        {COACH_PRICE_BLURB} In exchange, your reactions to cues help me tune it.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="One line: why you'd like Coach…"
          aria-label="Why you'd like Coach"
          className="focus-ring min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px] placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          disabled={applying}
          onClick={() => void apply()}
          className="btn-primary focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {usedUp || appStatus === "declined" ? "Ask again" : "Apply"}
        </button>
      </div>
    </div>
  );
}
