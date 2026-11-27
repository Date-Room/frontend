/**
 * How the squad call splits into rows, measured rather than looked up.
 *
 * George: "if the feed is coming from a mobile (portrait) then show
 * portrait on the web. Forcing landscape crops part of the call which
 * is bad UX. See how we are optimizing the layout on the mobile.. You
 * need to do same on the web."
 *
 * `useGridColumns` picks one column count from the MEDIAN feed shape,
 * so every cell in the grid is the same shape. A median cannot
 * represent two different answers: in a call holding a phone and a
 * laptop, whichever shape loses the vote gets cropped or letterboxed.
 *
 * This measures the stage and asks the ported planner — the same one
 * mobile uses — for rows and their heights, so a portrait feed's row
 * can be tall while a landscape feed's row is short.
 */
import { useEffect, useRef, useState } from "react";
import { squadRowPlan, squadRowShares } from "@/lib/squadRows";
import type { Shaped } from "@/hooks/useGridColumns";

export function useSquadRowPlan(feeds: Shaped[]): {
  ref: (el: HTMLElement | null) => void;
  rows: number[];
  shares: number[];
} {
  const [stageAspect, setStageAspect] = useState(0);
  const stop = useRef<(() => void) | null>(null);

  const ref = (el: HTMLElement | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setStageAspect(el.clientWidth / el.clientHeight);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    stop.current = () => ro.disconnect();
  };

  useEffect(() => () => stop.current?.(), []);

  // null, not a guess: the planner falls back to its table until a
  // feed says what shape it is, so nothing jumps before the first
  // frame lands.
  const aspects = feeds.map((f) =>
    f.dimensions && f.dimensions.height > 0 && f.dimensions.width > 0
      ? f.dimensions.width / f.dimensions.height
      : null,
  );

  const rows = squadRowPlan(aspects, stageAspect);
  const shares = squadRowShares(rows, aspects);
  return { ref, rows, shares };
}
