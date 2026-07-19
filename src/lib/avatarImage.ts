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

type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

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
