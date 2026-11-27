/**
 * How a squad call splits into rows, and how tall each row is.
 *
 * George: "I've told you if the feed is coming from a mobile
 * (portrait) then show portrait on the web. Forcing landscape crops
 * part of the call which is bad UX. See how we are optimizing the
 * layout on the mobile.. You need to do same on the web."
 *
 * Web had `gridColumnsForShape`, which picks ONE column count from the
 * median feed shape. Every cell in that grid is therefore the same
 * shape, so a room holding a phone and a laptop gets cells that suit
 * neither: whichever feed loses the vote is cropped to the threshold
 * or letterboxed. A median cannot represent two different answers.
 *
 * Mobile solved it by giving each ROW its own height, so the portrait
 * feed's row is tall and the landscape feed's row is short and both
 * fill their cells outright. This is that planner, ported — same
 * damping, same cap, same scoring — so the two clients arrange a call
 * the same way. See mobile `apps/mobile/lib/features/squad/
 * squad_layout.dart`, which carries the original reasoning.
 */
import { videoFit } from "@/lib/videoFit";

/** At most three across: past that a face stops being a face. */
export const MAX_PER_ROW = 3;

/**
 * The fallback arrangement, by count, when no feed has reported a
 * shape yet. An odd one out takes a full-width row rather than leaving
 * a hole beside it.
 */
export function squadRows(remotes: number): number[] {
  if (remotes <= 1) return [Math.max(0, Math.min(1, remotes))];
  if (remotes === 2) return [1, 1];
  if (remotes === 3) return [2, 1];
  if (remotes === 4) return [2, 2];
  return [2, 2, 1];
}

/**
 * How tall each row should be, as shares summing to 1.
 *
 * Each row asks for the height its hungriest cell needs — a cell `1/k`
 * of the width at aspect `a` wants `(1/k)/a` of height — and the rows
 * are normalised to fill the stage. Taken literally that over-corrects,
 * so the demand is damped toward equal: a phone beside a laptop lands
 * at about 72/28, where both fill their cells rather than one being
 * starved to prove a point.
 *
 * A null aspect is a feed that has not reported its shape; it is
 * treated as square, the shape that asks for nothing in particular.
 */
export function squadRowShares(rows: number[], aspects: (number | null)[]): number[] {
  const DAMPING = 0.8;
  const SQUARE = 1;

  let next = 0;
  const demands: number[] = [];
  for (const cells of rows) {
    let need = 0;
    for (let i = 0; i < cells; i++) {
      const a = (next < aspects.length ? aspects[next] : null) ?? SQUARE;
      next++;
      const want = 1 / cells / (a > 0 ? a : SQUARE);
      if (want > need) need = want;
    }
    demands.push(Math.pow(need, DAMPING));
  }

  const total = demands.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return rows.map(() => 1 / rows.length);
  return demands.map((d) => d / total);
}

/** How much of a cell the feed covers once `videoFit` has chosen. */
export function shownFraction(feed: number | null, cell: number): number {
  if (feed === null || !isFinite(feed) || feed <= 0) return 1;
  if (videoFit(feed, cell) === "cover") return 1;
  return feed > cell ? cell / feed : feed / cell;
}

/** Every way to cut `n` tiles, IN ORDER, into rows of at most `maxPerRow`. */
export function compositions(n: number, maxPerRow: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let k = 1; k <= Math.min(maxPerRow, n); k++) {
    for (const rest of compositions(n - k, maxPerRow)) out.push([k, ...rest]);
  }
  return out;
}

/**
 * Stage shown + worst tile shown.
 *
 * Both are fractions, already on the same scale, so neither needs a
 * weight. Area alone would gladly ruin one small tile to gain a little
 * everywhere else — which is the very result this replaces.
 */
export function scorePlan(
  rows: number[],
  aspects: (number | null)[],
  stageAspect: number,
): number {
  const shares = squadRowShares(rows, aspects);
  let next = 0;
  let area = 0;
  let worst = 1;
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r];
    const rowHeight = shares[r];
    const cellWidth = stageAspect / cells;
    for (let c = 0; c < cells; c++) {
      const feed = next < aspects.length ? aspects[next] : null;
      next++;
      const cell = rowHeight > 0 ? cellWidth / rowHeight : 1;
      const shown = shownFraction(feed, cell);
      area += shown * cellWidth * rowHeight;
      if (shown < worst) worst = shown;
    }
  }
  return area / stageAspect + worst;
}

/**
 * The arrangement to draw: how many tiles on each row, top to bottom.
 *
 * A composition of the tiles IN ORDER, so no tile ever jumps across
 * the grid to suit the arithmetic — only the row boundaries move.
 */
export function squadRowPlan(aspects: (number | null)[], stageAspect: number): number[] {
  const n = aspects.length;
  if (n <= 1) return [Math.max(0, Math.min(1, n))];
  if (!isFinite(stageAspect) || stageAspect <= 0) return squadRows(n);
  // Nothing has reported a shape: there is nothing to arrange for, and
  // guessing would make the call jump when the first frame lands.
  if (aspects.every((a) => a === null)) return squadRows(n);

  let best: number[] | null = null;
  let bestScore = -Infinity;
  for (const rows of compositions(n, MAX_PER_ROW)) {
    const score = scorePlan(rows, aspects, stageAspect);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = rows;
    }
  }
  return best ?? squadRows(n);
}
