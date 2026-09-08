/**
 * Stagecraft — shared theatrical-reveal machinery for date games.
 *
 * A cinematic is a short timed sequence of named stages (dim the room, open
 * the doors, raise the plaque) that plays when a game's shared state crosses
 * a threshold (e.g. both players locked in). Two rules keep it honest:
 *
 *  1. Play only what you witnessed. If the component mounts with the game
 *     already past the threshold (reload, late join), the cinematic is
 *     skipped and the caller shows the settled view — replaying the drama
 *     out of sync with your date is worse than none.
 *  2. Respect prefers-reduced-motion: the sequence jumps straight to its
 *     final stage.
 */
import { useEffect, useRef, useState } from "react";

export type CinematicStep = { id: string; at: number };

/** The stage active at `elapsedMs`, or null before the first step. */
export function stageAt(steps: CinematicStep[], elapsedMs: number): string | null {
  let current: string | null = null;
  for (const s of steps) {
    if (elapsedMs >= s.at) current = s.id;
  }
  return current;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export type Cinematic = {
  /** Current stage id, or null (not started / skipped via hydrate). */
  stage: string | null;
  /** True when the threshold was crossed live in this mount. */
  witnessed: boolean;
};

/**
 * Steps through `steps` when `active` flips false→true during this mount.
 * `active` true on first render means the moment already happened elsewhere:
 * stage stays null and `witnessed` is false. `active` going false resets.
 */
export function useCinematic(active: boolean, steps: CinematicStep[]): Cinematic {
  const [stage, setStage] = useState<string | null>(null);
  const [witnessed, setWitnessed] = useState(false);
  const sawInactive = useRef(!active);
  const timers = useRef<number[]>([]);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    if (!active) {
      sawInactive.current = true;
      clear();
      setStage(null);
      setWitnessed(false);
      return;
    }
    if (!sawInactive.current) return; // hydrated mid-moment — skip the show
    setWitnessed(true);
    const seq = stepsRef.current;
    if (prefersReducedMotion()) {
      setStage(seq[seq.length - 1]?.id ?? null);
      return clear;
    }
    for (const s of seq) {
      if (s.at <= 0) setStage(s.id);
      else timers.current.push(window.setTimeout(() => setStage(s.id), s.at));
    }
    return clear;
  }, [active]);

  return { stage, witnessed };
}
