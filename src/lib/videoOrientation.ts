/**
 * Which way round the camera captures.
 *
 * This is a CAPTURE choice, not a display one: the published stream really is
 * this shape, so the other person sees the framing you chose rather than
 * their own crop of it. Kept separate from `callLayout` because it is
 * orthogonal — how the call is arranged on your screen and what shape your
 * camera publishes are different questions, and only one of them is visible
 * to your date.
 */
import { useCallback, useEffect, useState } from "react";

export type VideoOrientation = "portrait" | "landscape";

const KEY = "dr:video-orientation:v1";
const EVENT = "dr:video-orientation-changed";

export function readVideoOrientation(): VideoOrientation {
  try {
    return localStorage.getItem(KEY) === "landscape" ? "landscape" : "portrait";
  } catch {
    return "portrait";
  }
}

/**
 * The orientation in force, plus a setter and whether it is currently pinned.
 *
 * `pinned` is for layouts that can only accommodate one shape — a tall
 * half-width pane letterboxes a landscape capture into a sliver — so the
 * caller can hide the control rather than leave a dead toggle on screen.
 */
export function useVideoOrientation(
  pinnedTo?: VideoOrientation,
): [VideoOrientation, (next: VideoOrientation) => void, boolean] {
  const [chosen, setChosen] = useState<VideoOrientation>(readVideoOrientation);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<VideoOrientation>).detail;
      if (next === "portrait" || next === "landscape") setChosen(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setChosen(readVideoOrientation());
    };
    window.addEventListener(EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const choose = useCallback((next: VideoOrientation) => {
    setChosen(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable — the choice just doesn't outlive the tab */
    }
    window.dispatchEvent(new CustomEvent<VideoOrientation>(EVENT, { detail: next }));
  }, []);

  return [pinnedTo ?? chosen, choose, Boolean(pinnedTo)];
}
