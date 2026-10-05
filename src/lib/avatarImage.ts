/**
 * Avatar image resizing — downscale any picked photo to a small square
 * JPEG data URL so there's no user-visible size limit (modern phone photos
 * are 2–8 MB). Matches the backend's `User.photo_url` intent: a compact
 * ~512px JPEG, tens of KB, stored inline.
 *
 * The canvas/decoding is browser-only; the crop math, byte-size math,
 * quality step-down loop and file validation are pulled out as pure
 * functions so they're unit-testable without a canvas.
 */

import type { SourceRect } from "./avatarCrop";

/** Output square edge in px — crisp at avatar sizes on retina. */
export const AVATAR_SIZE = 512;
/** Reject absurd inputs before decoding (a sanity cap, not the old limit). */
export const AVATAR_MAX_INPUT_BYTES = 15 * 1024 * 1024;
/** Step quality down until the encoded data URL is under this. */
export const AVATAR_TARGET_BYTES = 200 * 1024;
/** JPEG qualities tried in order (first that fits wins). */
export const AVATAR_QUALITIES = [0.85, 0.7, 0.55] as const;

/** Carries a user-facing message; callers surface `.message` in a toast. */
export class AvatarImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarImageError";
  }
}

/** Largest centered square source rect for a WxH image. Pure. */
export function squareCropRect(
  width: number,
  height: number,
): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  return {
    sx: Math.round((width - size) / 2),
    sy: Math.round((height - size) / 2),
    size,
  };
}

/** Approximate decoded byte size of a base64 data URL. Pure. */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  if (!b64) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Encode at successive qualities until the result is under `maxBytes`;
 * return the first that fits, else the smallest (last) attempt. Pure —
 * the encoder is injected so this is testable without a canvas.
 */
export function encodeUnderBudget(
  encode: (quality: number) => string,
  qualities: readonly number[],
  maxBytes: number,
): string {
  let last = "";
  for (const q of qualities) {
    last = encode(q);
    if (dataUrlByteSize(last) <= maxBytes) return last;
  }
  return last;
}

/** Validate the picked file before decoding. Throws AvatarImageError. Pure. */
export function assertValidAvatarFile(
  file: { type: string; size: number },
  maxBytes: number = AVATAR_MAX_INPUT_BYTES,
): void {
  if (!file.type.startsWith("image/")) {
    throw new AvatarImageError("Choose an image file.");
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new AvatarImageError(`That image is too large — pick one under ${mb} MB.`);
  }
}

export type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

/**
 * Decode a picked file, applying EXIF orientation where the browser offers
 * it. Exported so the cropper can preview the *same* bitmap it will cut
 * from — previewing an `<img>` instead risks the two disagreeing about
 * rotation, and the user then frames one photo and gets another.
 */
export async function decodeAvatarImage(file: File): Promise<DecodedImage> {
  return decodeImage(file);
}

async function decodeImage(file: File): Promise<DecodedImage> {
  // Preferred path — createImageBitmap applies EXIF orientation, so rotated
  // phone photos come out upright.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* fall back to <img> below (may not auto-rotate — acceptable) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new AvatarImageError("Couldn't load that image."));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Validate → decode → center-crop square → draw at AVATAR_SIZE → export a
 * JPEG data URL, stepping quality down if it's unexpectedly large. Rejects
 * non-images and absurdly large files with a user-facing message.
 */
export async function resizeAvatar(file: File): Promise<string> {
  assertValidAvatarFile(file);
  const decoded = await decodeImage(file);
  try {
    const { sx, sy, size } = squareCropRect(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarImageError("Couldn't process that image.");
    ctx.drawImage(decoded.source, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return encodeUnderBudget(
      (q) => canvas.toDataURL("image/jpeg", q),
      AVATAR_QUALITIES,
      AVATAR_TARGET_BYTES,
    );
  } finally {
    decoded.close();
  }
}

/**
 * Render a source rect of an already-decoded image as the square avatar
 * JPEG. This is the positioned-crop counterpart to `resizeAvatar`'s
 * centre-crop; the rect comes from `avatarCrop.ts`.
 */
export function renderAvatarCrop(decoded: DecodedImage, rect: SourceRect): string {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarImageError("Couldn't process that image.");
  // JPEG has no alpha, so paint white first: a transparent PNG, or a rect
  // that rounds a hair outside the bitmap, would otherwise come out black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(
    decoded.source,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  return encodeUnderBudget(
    (q) => canvas.toDataURL("image/jpeg", q),
    AVATAR_QUALITIES,
    AVATAR_TARGET_BYTES,
  );
}

/* ── General photos (vision board etc.) ─────────────────────────────────── */

/** Longest edge for a general photo — sharp full-screen, light to sync. */
export const PHOTO_MAX_EDGE = 1600;
/** Step quality down until the encoded data URL is under this. */
export const PHOTO_TARGET_BYTES = 400 * 1024;
/** JPEG qualities tried in order (first that fits wins). */
export const PHOTO_QUALITIES = [0.85, 0.75, 0.65, 0.5] as const;
/** Types kept byte-for-byte when already small (keeps PNG transparency, GIF motion). */
const PASSTHROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Scale WxH down (never up) so the longest edge is at most `maxEdge`,
 * keeping the aspect ratio. Pure.
 */
export function fitWithinEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new AvatarImageError("Couldn't read that image."));
    reader.onerror = () => reject(new AvatarImageError("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
}

/**
 * Like resizeAvatar but keeps the photo's shape: validate → decode → scale
 * the longest edge to PHOTO_MAX_EDGE → JPEG under PHOTO_TARGET_BYTES. Small,
 * already-web-friendly files pass through untouched. Throws AvatarImageError
 * with a user-facing message.
 */
export async function resizePhoto(file: File): Promise<string> {
  assertValidAvatarFile(file);
  const decoded = await decodeImage(file);
  try {
    const small =
      Math.max(decoded.width, decoded.height) <= PHOTO_MAX_EDGE &&
      file.size <= PHOTO_TARGET_BYTES;
    if (small && PASSTHROUGH_TYPES.has(file.type)) return readAsDataUrl(file);

    const { width, height } = fitWithinEdge(decoded.width, decoded.height, PHOTO_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarImageError("Couldn't process that image.");
    // JPEG has no alpha — paint white so transparent PNGs don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    return encodeUnderBudget(
      (q) => canvas.toDataURL("image/jpeg", q),
      PHOTO_QUALITIES,
      PHOTO_TARGET_BYTES,
    );
  } finally {
    decoded.close();
  }
}
