/**
 * The object-fit a video tile should use, measured from the feed and
 * the seat it lands in.
 *
 * One hook so every surface agrees. There were three answers before
 * this: `RoomVideo`'s tiles filled unconditionally, the squad stage
 * filled every small seat and only let the big one letterbox, and
 * mobile had its own rule. A portrait phone in a wide seat lost 68% of
 * the picture in two of the three.
 *
 * Put the ref on whatever element the <video> lives inside; the fit
 * follows the feed arriving, changing shape, or the seat resizing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { observeVideoFit } from "@/lib/observeVideoFit";
import type { VideoFit } from "@/lib/videoFit";

export function useVideoFit(): { ref: (el: HTMLElement | null) => void; fit: VideoFit } {
  const [fit, setFit] = useState<VideoFit>("cover");
  const stop = useRef<(() => void) | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const obs = observeVideoFit(el, setFit, {
      MutationObserver: window.MutationObserver,
      ResizeObserver: window.ResizeObserver,
    });
    stop.current = () => obs.stop();
  }, []);

  useEffect(() => () => stop.current?.(), []);

  return { ref, fit };
}
