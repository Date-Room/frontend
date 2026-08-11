import { ChevronUp, Settings, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChaperonSeverity } from "@/lib/chaperon";
import type { WhisperLogEntry } from "@/hooks/useChaperon";
import { cn } from "@/lib/utils";

/** Left dot per severity — matches the toast's colour language. */
const DOT: Record<ChaperonSeverity, string> = {
  info: "bg-white/40",
  note: "bg-emerald-400",
  warn: "bg-amber",
  alert: "bg-rose-500",
};

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The running whisper rail: every whisper this call, newest at top, older
 * ones fading back so they're reviewable but don't read as the live signal.
 * Rendered inside ChaperonMount's left column (normal flow — the parent
 * positions it, so the status card above can never overlap it). Each entry is
 * rateable if it carries an event_id.
 */
export function ChaperonRail({
  entries,
  ratings,
  onRate,
  onCollapse,
  onOpenSetup,
}: {
  entries: WhisperLogEntry[];
  ratings: Record<string, "up" | "down">;
  onRate: (eventId: string, helpful: boolean) => void;
  onCollapse: () => void;
  onOpenSetup: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <p className="flex flex-1 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Chaperon · {entries.length}
        </p>
        <button
          type="button"
          aria-label="Chaperon settings"
          onClick={onOpenSetup}
          className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <Settings className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Collapse whisper rail"
          onClick={onCollapse}
          className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {entries.map((e, i) => {
          // Age the list: newest full, older progressively dimmer (floor ~0.45).
          const opacity = Math.max(0.45, 1 - i * 0.14);
          const eventId = e.signal.event_id;
          const rated = eventId ? ratings[eventId] : undefined;
          return (
            <div
              key={e.id}
              style={{ opacity }}
              className={cn(
                "rounded-xl border px-3 py-2 backdrop-blur-md transition",
                e.signal.severity === "alert"
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-white/10 bg-black/50",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[e.signal.severity])}
                  aria-hidden
                />
                <span className="text-[10px] font-medium tabular-nums text-white/40">
                  {formatElapsed(e.elapsedSec)}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-cream/90">{e.signal.whisper}</p>
              {eventId && (
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Helpful"
                    disabled={rated !== undefined}
                    onClick={() => onRate(eventId, true)}
                    className={cn(
                      "rounded-full p-0.5 text-cream/50 transition hover:bg-white/10 hover:text-cream disabled:opacity-40",
                      rated === "up" && "text-emerald-300",
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Not helpful"
                    disabled={rated !== undefined}
                    onClick={() => onRate(eventId, false)}
                    className={cn(
                      "rounded-full p-0.5 text-cream/50 transition hover:bg-white/10 hover:text-cream disabled:opacity-40",
                      rated === "down" && "text-rose-300",
                    )}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
