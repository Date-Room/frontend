/**
 * How tall the bar pinned to the bottom of the room is, if any.
 *
 * The room seats the activity launcher directly above it, so it needs a real
 * height. Two different components can put a bar down there — the music
 * player and Watch — and each knows its own visibility and size, so each
 * reports for itself rather than the room trying to infer it. Inferring is
 * what broke this twice: the room's idea of "something is playing" flips at a
 * different moment than the element mounts, and stays true after the user
 * closes the bar.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const BOTTOM_BAR_HEIGHT_EVENT = "dr:bottom-bar-height";

type Report = { id: string; height: number };

/** Attach the returned ref to a bottom bar; it reports while `visible`. */
export function useReportBottomBarHeight(id: string, visible: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  const report = useCallback(
    (height: number) => {
      window.dispatchEvent(
        new CustomEvent<Report>(BOTTOM_BAR_HEIGHT_EVENT, { detail: { id, height } }),
      );
    },
    [id],
  );

  useEffect(() => {
    const el = ref.current;
    if (!visible || !el) {
      report(0);
      return;
    }
    const read = () => report(el.offsetHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      ro.disconnect();
      report(0);
    };
  }, [visible, report]);

  return ref;
}

/** The tallest bar currently reporting. Zero when the bottom is clear. */
export function useBottomBarHeight(): number {
  const [heights, setHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const on = (e: Event) => {
      const { id, height } = (e as CustomEvent<Report>).detail ?? { id: "", height: 0 };
      if (!id) return;
      setHeights((prev) => {
        const next = Math.max(0, height);
        if (prev[id] === next) return prev;
        return { ...prev, [id]: next };
      });
    };
    window.addEventListener(BOTTOM_BAR_HEIGHT_EVENT, on);
    return () => window.removeEventListener(BOTTOM_BAR_HEIGHT_EVENT, on);
  }, []);

  return Math.max(0, ...Object.values(heights), 0);
}
