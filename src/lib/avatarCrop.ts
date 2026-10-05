/**
 * Geometry for positioning a photo inside a square avatar window.
 *
 * Kept pure and away from the component for the same reason the mobile
 * version is (`services/avatar_crop.dart`): an off-by-one in the mapping
 * between what the user framed and what gets cut shows up as a face
 * slightly off-centre — hard to spot in review, obvious on a profile.
 *
 * All offsets are in *viewport* pixels and measure how far the image's
 * centre has been dragged from the window's centre.
 */

export type Point = { x: number; y: number };
export type SourceRect = { left: number; top: number; width: number; height: number };

/** The largest zoom the user can reach. */
export const AVATAR_MAX_ZOOM = 4;

/**
 * The smallest scale that still covers a square viewport — the starting
 * zoom, and the floor the user cannot pan below.
 *
 * "Cover" rather than "contain": an avatar must not have empty bars in it,
 * so the short edge of the photo defines the fit.
 */
export function avatarBaseScale(imageWidth: number, imageHeight: number, viewport: number): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  return Math.max(viewport / imageWidth, viewport / imageHeight);
}

/**
 * Clamp to ±limit, normalising the negative zero that `Math.max(-0, …)`
 * produces at a zero limit. `-0` draws the same but compares unequal to `0`
 * under `Object.is`, which is a needless trap for anything downstream.
 */
function pin(value: number, limit: number): number {
  const clamped = Math.min(limit, Math.max(-limit, value));
  return clamped === 0 ? 0 : clamped;
}

/**
 * Keeps the image covering the viewport.
 *
 * Without this the photo can be dragged away from the window, leaving a gap
 * that would crop as blank. The clamp is per-axis because a landscape photo
 * has slack horizontally and none vertically (and the reverse for a
 * portrait), so a single limit would either over- or under-constrain one.
 */
export function clampAvatarOffset(args: {
  imageWidth: number;
  imageHeight: number;
  viewport: number;
  scale: number;
  offset: Point;
}): Point {
  const { imageWidth, imageHeight, viewport, scale, offset } = args;
  // How far the image may travel before an edge enters the viewport.
  const slackX = Math.max(0, (imageWidth * scale - viewport) / 2);
  const slackY = Math.max(0, (imageHeight * scale - viewport) / 2);
  return {
    x: pin(offset.x, slackX),
    y: pin(offset.y, slackY),
  };
}

/**
 * Where a pan/zoom gesture leaves the frame.
 *
 * `zoomAtStart` is the zoom when the gesture began and `scaleFactor` is the
 * gesture's cumulative pinch, so those multiply. `panDelta` is the movement
 * since the LAST event, so it accumulates onto the CURRENT offset — adding
 * it to the offset captured at gesture start instead is the bug this
 * function exists to stop: the frame then jumps back on every event and the
 * photo cannot be moved at all.
 */
export function applyAvatarGesture(args: {
  imageWidth: number;
  imageHeight: number;
  viewport: number;
  zoomAtStart: number;
  scaleFactor: number;
  offset: Point;
  panDelta: Point;
  maxZoom?: number;
}): { zoom: number; offset: Point } {
  const {
    imageWidth,
    imageHeight,
    viewport,
    zoomAtStart,
    scaleFactor,
    offset,
    panDelta,
    maxZoom = AVATAR_MAX_ZOOM,
  } = args;
  const zoom = Math.min(maxZoom, Math.max(1, zoomAtStart * scaleFactor));
  const scale = avatarBaseScale(imageWidth, imageHeight, viewport) * zoom;
  return {
    zoom,
    offset: clampAvatarOffset({
      imageWidth,
      imageHeight,
      viewport,
      scale,
      offset: { x: offset.x + panDelta.x, y: offset.y + panDelta.y },
    }),
  };
}

/**
 * The region of the ORIGINAL image that the viewport is showing.
 *
 * `scale` is the total scale actually applied (i.e. `avatarBaseScale` times
 * the user's zoom).
 */
export function avatarCropRect(args: {
  imageWidth: number;
  imageHeight: number;
  viewport: number;
  scale: number;
  offset: Point;
}): SourceRect {
  const { imageWidth, imageHeight, viewport, scale, offset } = args;
  if (scale <= 0) return { left: 0, top: 0, width: imageWidth, height: imageHeight };
  // Walk back from screen space into image space: the viewport's centre sits
  // at the image's centre, less however far it has been dragged.
  const centreX = imageWidth / 2 - offset.x / scale;
  const centreY = imageHeight / 2 - offset.y / scale;
  const side = viewport / scale;
  // A photo smaller than the window, or rounding at the extremes, can push
  // the rect a fraction outside — drawing from outside the bitmap yields a
  // transparent band.
  const left = Math.min(Math.max(0, imageWidth - 1), Math.max(0, centreX - side / 2));
  const top = Math.min(Math.max(0, imageHeight - 1), Math.max(0, centreY - side / 2));
  return {
    left,
    top,
    width: Math.min(side, imageWidth - left),
    height: Math.min(side, imageHeight - top),
  };
}
