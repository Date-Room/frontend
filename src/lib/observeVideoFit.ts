/**
 * Keep a tile's object-fit in step with the feed inside it.
 *
 * Split out of the component because the first version was wrong in a
 * way a component test would not have caught: it looked for the <video>
 * in an effect and attached listeners to it. LiveKit mounts that element
 * itself, a beat later, so the lookup returned null, `video?.addEventListener`
 * did nothing, and the tile sat on `cover` forever — exactly the crop the
 * fit was meant to remove.
 *
 * So the element is never assumed to exist. The observer watches the
 * container for it arriving, and re-attaches if it is swapped out.
 */
import { videoFitFor, type VideoFit } from "./videoFit";

export interface FitObserver {
  stop(): void;
}

/**
 * Watch `tile` and report the fit its video should use.
 *
 * Calls `onFit` immediately and on anything that can change the answer:
 * the video appearing, reporting its size, changing shape (a phone
 * rotating mid-call), or the tile being resized.
 */
export function observeVideoFit(
  tile: HTMLElement,
  onFit: (fit: VideoFit) => void,
  deps: {
    MutationObserver: typeof globalThis.MutationObserver;
    ResizeObserver?: typeof globalThis.ResizeObserver;
  },
): FitObserver {
  let video: HTMLVideoElement | null = null;

  const measure = () => onFit(videoFitFor(video, tile));

  const attach = () => {
    const found = tile.querySelector("video");
    if (found === video) return;
    if (video) {
      video.removeEventListener("loadedmetadata", measure);
      video.removeEventListener("resize", measure);
    }
    video = found;
    // `resize` is the one that matters after the first frame: a phone
    // turned sideways mid-call changes the shape without remounting.
    video?.addEventListener("loadedmetadata", measure);
    video?.addEventListener("resize", measure);
    measure();
  };

  attach();
  // `attach` only reports when the element changed, and on the first run
  // there is usually nothing there yet — but the caller still needs a
  // value to render with, so say so explicitly.
  measure();

  const mo = new deps.MutationObserver(attach);
  mo.observe(tile, { childList: true, subtree: true });

  const ro = deps.ResizeObserver ? new deps.ResizeObserver(measure) : null;
  ro?.observe(tile);

  return {
    stop() {
      mo.disconnect();
      ro?.disconnect();
      if (video) {
        video.removeEventListener("loadedmetadata", measure);
        video.removeEventListener("resize", measure);
      }
      video = null;
    },
  };
}
