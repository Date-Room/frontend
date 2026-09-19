import { ChevronUp, Compass, Settings, ShieldCheck } from "lucide-react";
import type { ChaperonSeverity } from "@/lib/chaperon";
import type { WhisperLogEntry } from "@/hooks/useChaperon";
import { cn } from "@/lib/utils";
import { ChaperonReactions, familyOf, type ReactionDetail } from "@/components/ChaperonReactions";
import type { RailFilter } from "@/components/ChaperonChip";

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
  filter = "all",
  onFilter,
  onRate,
  onCollapse,
  onOpenSetup,
}: {
  entries: WhisperLogEntry[];
  ratings: Record<string, "up" | "down">;
  /** Which family to show; the header is the filter, with totals. */
  filter?: RailFilter;
  onFilter?: (f: RailFilter) => void;
  onRate: (eventId: string, helpful: boolean, detail?: ReactionDetail) => void;
  onCollapse: () => void;
  onOpenSetup: () => void;
}) {
  if (entries.length === 0) return null;
  const protectN = entries.filter((e) => familyOf(e.signal.severity) === "protect").length;
  const coachN = entries.length - protectN;
  const shown =
    filter === "all" ? entries : entries.filter((e) => familyOf(e.signal.severity) === filter);
  const seg = (on: boolean) =>
    cn(
      "focus-ring flex items-center gap-1 rounded-full px-2 py-0.5 text-label font-semibold tabular-nums transition",
      on ? "bg-white/15 text-cream" : "text-white/45 hover:text-white/80",
    );

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-1 px-1">
        <div className="flex flex-1 items-center gap-0.5" role="tablist" aria-label="Filter whispers">
          <button type="button" role="tab" aria-selected={filter === "all"} className={seg(filter === "all")} onClick={() => onFilter?.("all")}>
            All · {entries.length}
          </button>
          <button type="button" role="tab" aria-selected={filter === "protect"} aria-label={`Protect, ${protectN}`} className={seg(filter === "protect")} onClick={() => onFilter?.("protect")}>
            <ShieldCheck className="h-3 w-3 text-emerald-300" aria-hidden />
            {protectN}
          </button>
          {coachN > 0 && (
            <button type="button" role="tab" aria-selected={filter === "coach"} aria-label={`Coach, ${coachN}`} className={seg(filter === "coach")} onClick={() => onFilter?.("coach")}>
              <Compass className="h-3 w-3 text-amber" aria-hidden />
              {coachN}
            </button>
          )}
        </div>
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
        {shown.map((e, i) => {
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
                <span className="text-label font-medium tabular-nums text-white/40">
                  {formatElapsed(e.elapsedSec)}
                </span>
                {e.signal.probe && (
                  <span className="rounded-full bg-sky-400/15 px-1.5 py-px text-label font-semibold uppercase tracking-wide text-sky-300">
                    Your test
                  </span>
                )}
              </div>
              <p className="mt-1 text-label leading-snug text-cream/90">{e.signal.whisper}</p>
              {eventId && (
                <div className="mt-1.5">
                  <ChaperonReactions
                    signal={e.signal}
                    rated={rated}
                    size="sm"
                    onRate={(helpful, detail) => onRate(eventId, helpful, detail)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
