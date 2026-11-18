/**
 * How many columns a call grid should use, given the shape of the
 * container and the shape of the feeds in it.
 *
 * The column count used to be a lookup on the number of people: two
 * across, four in a square, and so on. That is the right answer only
 * when the cells it produces happen to match the pictures going into
 * them. Four phones on a wide laptop became a 2x2 of wide cells holding
 * tall video, so every face was letterboxed with bars down both sides —
 * the grid was square and the people were not.
 *
 * So pick the arrangement whose CELLS are closest in shape to the FEEDS.
 * Nothing here crops or stretches anything; it chooses the layout that
 * leaves `videoFit` the least work to do.
 */

/** Fraction of a cell wasted when a feed of `feed` sits in it, 0..1. */
export function cellWaste(cellAspect: number, feedAspect: number): number {
  if (!isFinite(cellAspect) || !isFinite(feedAspect) || cellAspect <= 0 || feedAspect <= 0) {
    return 0;
  }
  const lo = Math.min(cellAspect, feedAspect);
  const hi = Math.max(cellAspect, feedAspect);
  return 1 - lo / hi;
}

/**
 * Columns for `count` tiles in a container of `containerAspect` (w/h),
 * holding feeds of `feedAspect`.
 *
 * Ties go to fewer columns: with nothing to choose between them, bigger
 * tiles beat a tidier rectangle.
 */
export function gridColumnsForShape(
  count: number,
  containerAspect: number,
  feedAspect: number,
): number {
  if (count <= 1) return 1;
  if (!isFinite(containerAspect) || containerAspect <= 0) return Math.min(2, count);
  if (!isFinite(feedAspect) || feedAspect <= 0) return Math.min(2, count);

  let best = 1;
  let bestWaste = Infinity;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    // A cell is the container divided by the arrangement.
    const cellAspect = (containerAspect * rows) / cols;
    const waste = cellWaste(cellAspect, feedAspect);
    // Strictly less, so the earliest (fewest columns) wins a tie.
    if (waste < bestWaste - 1e-9) {
      bestWaste = waste;
      best = cols;
    }
  }
  return best;
}

/** The shape most of the feeds are, so one grid suits the room. */
export function dominantAspect(aspects: number[]): number | null {
  const usable = aspects.filter((a) => isFinite(a) && a > 0);
  if (usable.length === 0) return null;
  // Median, not mean: one person on a laptop among four on phones
  // should not drag the whole grid towards landscape.
  const sorted = [...usable].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
