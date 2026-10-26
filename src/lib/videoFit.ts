/**
 * How to fit a video feed into a tile that is a different shape.
 *
 * Every tile used to be `object-fit: cover`, which fills the tile and
 * throws away whatever doesn't fit. That is right when the shapes are
 * close and badly wrong when they aren't: a phone publishes portrait
 * (540x960) and a laptop tile is landscape, so cover discarded 68% of
 * the frame — the top and bottom of the person. It read as the camera
 * being zoomed into their face.
 *
 * `contain` never crops but letterboxes, which looks worse than a small
 * trim. So the rule is a threshold, not a preference: fill while the
 * loss is modest, letterbox once it stops being modest.
 */

export type VideoFit = "cover" | "contain";

/**
 * How much of the source `cover` discards, 0..1.
 *
 * Cover scales until both axes are covered, so the overflow on the
 * longer axis is cut. The fraction kept is the ratio of the two aspect
 * ratios, smaller over larger — which is symmetric, because a portrait
 * feed in a landscape tile loses exactly what a landscape feed loses in
 * the same tile turned on its side.
 */
export function coverCrop(sourceAspect: number, tileAspect: number): number {
  if (!isFinite(sourceAspect) || !isFinite(tileAspect) || sourceAspect <= 0 || tileAspect <= 0) {
    return 0;
  }
  const lo = Math.min(sourceAspect, tileAspect);
  const hi = Math.max(sourceAspect, tileAspect);
  return 1 - lo / hi;
}

/**
 * The most of a frame we will throw away to fill a tile.
 *
 * A third. Below it sit the shapes that have always filled nicely — a
 * 4:3 webcam in a 16:9 tile loses 25% and should keep filling, because
 * letterboxing that would add bars for no reason. Above it sit the
 * mismatches: a phone in a laptop tile (68%), or either of them in a
 * square grid cell (44%), where what is being cut is a person's head.
 */
export const MAX_CROP = 1 / 3;

/** Pure: which object-fit a tile should use for this feed. */
export function videoFit(sourceAspect: number, tileAspect: number): VideoFit {
  return coverCrop(sourceAspect, tileAspect) > MAX_CROP ? "contain" : "cover";
}

/**
 * Convenience for callers holding elements rather than numbers.
 *
 * Returns `cover` until the video reports its intrinsic size — a feed
 * that has not arrived should not flash letterboxed first.
 */
export function videoFitFor(
  video: { videoWidth: number; videoHeight: number } | null | undefined,
  tile: { clientWidth: number; clientHeight: number } | null | undefined,
): VideoFit {
  if (!video?.videoWidth || !video?.videoHeight) return "cover";
  if (!tile?.clientWidth || !tile?.clientHeight) return "cover";
  return videoFit(video.videoWidth / video.videoHeight, tile.clientWidth / tile.clientHeight);
}
