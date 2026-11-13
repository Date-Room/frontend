/**
 * How many columns the friend grid should use, measured rather than
 * looked up.
 *
 * The column count was a function of headcount alone — two across, four
 * in a square — which is the right answer only when the cells it makes
 * happen to match the pictures going into them. Four phones in a wide
 * browser window became a 2x2 of wide cells holding tall video: bars
 * down both sides of every face. The grid was square and the people
 * were not.
 *
 * So the container measures itself, the feeds report their shape, and
 * `gridColumnsForShape` picks the arrangement whose cells come closest.
 * Nothing is cropped or stretched here; it leaves `videoFit` the least
 * work to do.
 */
import { useEffect, useRef, useState } from "react";
import { dominantAspect, gridColumnsForShape } from "@/lib/gridShape";

export interface Shaped {
  /** Whatever the feed has reported, if anything yet. */
  dimensions?: { width: number; height: number } | undefined;
}

export function useGridColumns(
  count: number,
  feeds: Shaped[],
): { ref: (el: HTMLElement | null) => void; columns: number } {
  const [containerAspect, setContainerAspect] = useState(0);
  const stop = useRef<(() => void) | null>(null);

  const ref = (el: HTMLElement | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setContainerAspect(el.clientWidth / el.clientHeight);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    stop.current = () => ro.disconnect();
  };

  useEffect(() => () => stop.current?.(), []);

  const aspects = feeds
    .map((f) => (f.dimensions && f.dimensions.height > 0 ? f.dimensions.width / f.dimensions.height : NaN))
    .filter((a) => Number.isFinite(a));
  const feedAspect = dominantAspect(aspects);

  // Until both are known, two across — the shape the grid has always
  // had, so nothing jumps when the first frame lands.
  if (!containerAspect || feedAspect === null) {
    return { ref, columns: Math.min(2, Math.max(1, count)) };
  }
  return { ref, columns: gridColumnsForShape(count, containerAspect, feedAspect) };
}
