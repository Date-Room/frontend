import { useEffect, useState } from "react";
import { ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useChaperonController } from "@/context/ChaperonContext";
import { ChaperonSetupSheet } from "@/components/ChaperonSetupSheet";
import type { ChaperonSeverity } from "@/lib/chaperon";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<ChaperonSeverity, string> = {
  info: "border-white/15 bg-black/60",
  note: "border-emerald-400/30 bg-emerald-500/10",
  warn: "border-amber/40 bg-amber/10",
  alert: "border-rose-500/50 bg-rose-500/15",
};

/**
 * The single in-room chaperon surface: a discreet health dot + shield button
 * (opens setup) and the one-at-a-time whisper card. No sound, no vibration —
 * whispers are private to the user and safe if the other party sees the screen.
 * Renders nothing when the feature is off.
 */
export function ChaperonMount() {
  const ctrl = useChaperonController();
  const [setupOpen, setSetupOpen] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  // Reset the thumbs state whenever a new whisper appears.
  const whisperKey = ctrl?.currentWhisper?.event_id ?? ctrl?.currentWhisper?.whisper ?? null;
  useEffect(() => {
    setFeedbackGiven(null);
  }, [whisperKey]);

  if (!ctrl || !ctrl.enabled) return null;

  const { status, currentWhisper, active, dismiss, sendFeedback } = ctrl;

  const dotClass =
    status === "watching"
      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse"
      : status === "degraded"
        ? "bg-amber shadow-[0_0_10px_rgba(251,191,36,0.6)]"
        : "bg-white/30";
  const dotTitle =
    status === "watching"
      ? "Chaperon is watching"
      : status === "degraded"
        ? "Chaperon can't see right now"
        : "Chaperon is off";

  function onFeedback(helpful: boolean) {
    sendFeedback(helpful);
    setFeedbackGiven(helpful ? "up" : "down");
  }

  return (
    <>
      {/* Discreet control cluster — health dot + shield opens setup. */}
      <button
        type="button"
        onClick={() => setSetupOpen(true)}
        title={dotTitle}
        aria-label="Chaperon"
        className="pointer-events-auto fixed left-3 top-3 z-30 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/70"
      >
        <ShieldCheck className={cn("h-3.5 w-3.5", active ? "text-emerald-300" : "text-white/60")} />
        <span className={cn("h-2 w-2 rounded-full", dotClass)} aria-hidden />
      </button>

      {/* One whisper at a time. */}
      {currentWhisper && (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center px-4">
          <div
            className={cn(
              "pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-cream shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in",
              SEVERITY_STYLES[currentWhisper.severity],
            )}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cream/80" aria-hidden />
            <p className="min-w-0 flex-1 text-sm leading-snug">{currentWhisper.whisper}</p>
            {currentWhisper.event_id && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Helpful"
                  disabled={feedbackGiven !== null}
                  onClick={() => onFeedback(true)}
                  className={cn(
                    "rounded-full p-1 transition hover:bg-white/10 disabled:opacity-40",
                    feedbackGiven === "up" && "text-emerald-300",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Not helpful"
                  disabled={feedbackGiven !== null}
                  onClick={() => onFeedback(false)}
                  className={cn(
                    "rounded-full p-1 transition hover:bg-white/10 disabled:opacity-40",
                    feedbackGiven === "down" && "text-rose-300",
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                setFeedbackGiven(null);
                dismiss();
              }}
              className="shrink-0 rounded-full p-1 text-cream/60 transition hover:bg-white/10 hover:text-cream"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ChaperonSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        variant="live"
        active={active}
        transcriptSupported={ctrl.transcriptSupported}
        onStart={ctrl.start}
        onStop={ctrl.stop}
      />
    </>
  );
}
