/**
 * A point that lands.
 *
 * Scores used to appear already changed: the league refetches after a
 * reveal and the number was simply different the next time you looked,
 * which is the one moment in a game that should feel like something.
 *
 * Deliberately small. DateRoom's rooms are lit and slow and the people
 * in them are grown-ups, so this is a brief tick and a few sparks on
 * your own point — not a cannon. Someone else's point ticks without
 * sparks: their win is information to me, not a celebration of mine.
 *
 * The pure parts live here so both the tick and the spark layout are
 * testable without a DOM, and so mobile can be the same animation
 * rather than a second guess at it (`widgets/score_pop.dart`).
 */

/** How long the number takes to travel, however far it has to go. */
export const TICK_MS = 520;

/** How long a spark lives. Slightly longer than the tick, so the burst
 *  is still fading as the number settles rather than ending first. */
export const SPARK_MS = 900;

/** Few enough to read as a flourish rather than as weather. */
export const SPARKS = 7;

/**
 * The number to show partway through a tick.
 *
 * Eased, so it slows into its final value instead of arriving at a
 * constant rate and stopping dead. Always an integer: a score of 3.4
 * is not a thing anyone has.
 */
export function tickValue(from: number, to: number, t: number): number {
  if (t <= 0) return from;
  if (t >= 1) return to;
  // easeOutCubic
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(from + (to - from) * eased);
}

export type Spark = {
  /** Degrees clockwise from straight up. */
  angle: number;
  /** How far it travels, in px. */
  distance: number;
  /** Fraction of SPARK_MS to wait before starting. */
  delay: number;
  /** Side of the square spark, in px. */
  size: number;
};

/**
 * Where the sparks go.
 *
 * Fanned upward rather than thrown in a full circle: a point is a
 * lift, and a ring of particles around a number reads as an error
 * badge. Spread over the top 200° so they clear the number, with the
 * angles jittered off the exact spokes — evenly spaced sparks look
 * like a loading spinner.
 *
 * Deterministic from `seed` so the same burst is the same shape in a
 * test, and so React re-renders mid-flight don't reshuffle it.
 */
export function sparksFor(seed: number, count = SPARKS): Spark[] {
  const out: Spark[] = [];
  for (let i = 0; i < count; i++) {
    // A cheap, stable hash: enough to look unplanned, no dependency.
    const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const jitter = n - Math.floor(n); // 0..1
    const spoke = -100 + (200 * i) / Math.max(1, count - 1);
    out.push({
      angle: spoke + (jitter - 0.5) * 22,
      distance: 18 + jitter * 16,
      delay: jitter * 0.18,
      size: jitter > 0.6 ? 4 : 3,
    });
  }
  return out;
}
