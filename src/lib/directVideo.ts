/**
 * Direct video links — the third Watch source class after YouTube (and the
 * cheapest): a plain MP4/WebM/OGG/MOV (or natively-supported HLS) URL played
 * in a <video> element. currentTime/play/pause ARE the sync API, so the
 * shared-watch protocol drives it directly. This is also the "our own
 * videos" feature: a couple can watch a personal clip together without it
 * touching any platform.
 */

const FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;
const HLS_RE = /\.(m3u8)(\?|#|$)/i;

/** A playable direct-video URL, or null. */
export function extractDirectVideoUrl(raw: string): string | null {
  const input = raw.trim();
  if (!/^https?:\/\//i.test(input)) return null;
  try {
    const u = new URL(input);
    if (FILE_RE.test(u.pathname)) return u.toString();
    if (HLS_RE.test(u.pathname) && hlsSupported()) return u.toString();
    return null;
  } catch {
    return null;
  }
}

export function isHlsUrl(url: string): boolean {
  try {
    return HLS_RE.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Native HLS support (Safari; some Android browsers). No hls.js fallback —
 *  a dependency we can add if direct HLS sees real use. */
export function hlsSupported(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return Boolean(v.canPlayType("application/vnd.apple.mpegurl"));
}

/** A human name for the control bar: the file name, de-slugged. */
export function directVideoTitle(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    const stem = last.replace(/\.[a-z0-9]+$/i, "");
    const words = decodeURIComponent(stem).replace(/[-_+.]+/g, " ").trim();
    return words || "A video of yours";
  } catch {
    return "A video of yours";
  }
}
