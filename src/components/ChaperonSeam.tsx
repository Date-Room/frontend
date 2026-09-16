/**
 * The seam: a 3px edge on the call itself that encodes the chaperon's HEALTH
 * and nothing else. Green and breathing while listening, sky while
 * connecting, amber while degraded, absent when off. It flashes rose while a
 * Protect alert is on screen; Coach nudges never touch it. Discreet by
 * design: a badge that says "surveillance" is the one thing a date must not
 * carry, an edge that breathes is not.
 *
 * Renders inside the call frame (PiP or full); positioned by the parent.
 */
import { useChaperonController } from "@/context/ChaperonContext";
import { cn } from "@/lib/utils";

export type SeamTone = "off" | "listening" | "connecting" | "degraded" | "alert";

/** Pure: which tone the seam shows. */
export function seamTone(
  status: "off" | "connecting" | "watching" | "degraded",
  alertOnScreen: boolean,
): SeamTone {
  if (status === "off") return "off";
  if (alertOnScreen) return "alert";
  if (status === "watching") return "listening";
  return status;
}

const TONE_CLASS: Record<Exclude<SeamTone, "off">, string> = {
  listening: "bg-emerald-400 shadow-[0_0_14px_2px_rgba(52,211,153,0.55)] motion-safe:animate-pulse",
  connecting: "bg-sky-400 shadow-[0_0_12px_2px_rgba(56,189,248,0.5)] motion-safe:animate-pulse",
  degraded: "bg-amber shadow-[0_0_12px_2px_rgba(245,166,35,0.45)]",
  alert: "bg-rose-500 shadow-[0_0_22px_4px_rgba(244,63,94,0.6)]",
};

export function ChaperonSeam({ className }: { className?: string }) {
  const ctrl = useChaperonController();
  if (!ctrl || !ctrl.enabled) return null;
  const tone = seamTone(ctrl.status, ctrl.currentWhisper?.severity === "alert");
  if (tone === "off") return null;
  return (
    <span
      aria-hidden
      data-seam={tone}
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 z-20 w-[3px] rounded-l-xl transition-colors duration-500",
        TONE_CLASS[tone],
        className,
      )}
    />
  );
}
