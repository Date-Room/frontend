import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Showing 1 to 25 of 138 · per page · Prev / Next". Pure over the numbers it is given. */
export function pagerLabel(from: number, to: number, total: number | null, noun = "rows"): string {
  if (to === 0) return `No ${noun}`;
  return total != null ? `Showing ${from} to ${to} of ${total}` : `Showing ${from} to ${to}`;
}

export function Pager({
  from,
  to,
  total,
  perPage,
  onPerPage,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  noun,
  busy = false,
}: {
  from: number;
  to: number;
  total: number | null;
  perPage: number;
  onPerPage: (n: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  noun?: string;
  busy?: boolean;
}) {
  const btn = "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.14] bg-card text-cream/80 transition hover:bg-white/[0.08] disabled:opacity-35";
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] px-4 py-2.5 text-xs text-muted-foreground">
      <span className="tabular-nums">{pagerLabel(from, to, total, noun)}</span>
      <label className="ml-auto flex items-center gap-1.5">
        Per page
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className="focus-ring h-8 rounded-lg border border-white/[0.14] bg-card px-2 text-xs text-cream"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <button type="button" aria-label="Previous page" disabled={!hasPrev || busy} onClick={onPrev} className={btn}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Next page" disabled={!hasNext || busy} onClick={onNext} className={cn(btn)}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
