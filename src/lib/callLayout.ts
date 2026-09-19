/**
 * Where the call sits in the room — a preference, not a consequence of the
 * viewport.
 *
 * Lives here rather than in RoomStage because two places need it: the room
 * (which does the laying out) and the in-call settings menu (which offers the
 * choice). They are in different trees, so the value is shared through
 * storage plus an event rather than props.
 */
import { useCallback, useEffect, useState } from "react";

/** `side` — call and stage as two panes, one tile each.
 *  `side-pip` — the pane stays, but the video inside it is one full-bleed
 *    feed with the other floating over it, the way a phone call looks.
 *  `float` — the call is a draggable window over the stage. */
export type CallLayout = "side" | "side-pip" | "float";

/** Which way round the camera captures. This is a capture-side choice, not a
 *  display one: the published stream really is this shape, so the other
 *  person sees the same framing you do. */
export type VideoOrientation = "portrait" | "landscape";

const KEY = "dr:call-layout:v1";
const EVENT = "dr:call-layout-changed";
const ORIENT_KEY = "dr:video-orientation:v1";
const ORIENT_EVENT = "dr:video-orientation-changed";

export function readCallLayout(): CallLayout {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "float" || saved === "side" || saved === "side-pip" ? saved : "side";
  } catch {
    return "side";
  }
}

/** True when the call gets its own pane beside the stage — both `side` and
 *  `side-pip` do; only the video inside the pane differs. */
export function isSidePane(layout: CallLayout): boolean {
  return layout === "side" || layout === "side-pip";
}

export function writeCallLayout(next: CallLayout): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable — the choice just doesn't outlive the tab */
  }
  // Same-tab listeners don't get `storage` events, so announce it ourselves.
  window.dispatchEvent(new CustomEvent<CallLayout>(EVENT, { detail: next }));
}

/** The current layout, kept in step across every component that asks. */
export function useCallLayout(): [CallLayout, (next: CallLayout) => void] {
  const [layout, setLayout] = useState<CallLayout>(readCallLayout);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<CallLayout>).detail;
      if (next === "side" || next === "side-pip" || next === "float") setLayout(next);
    };
    // `storage` covers the other-tab case; the custom event covers this one.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setLayout(readCallLayout());
    };
    window.addEventListener(EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const choose = useCallback((next: CallLayout) => {
    setLayout(next);
    writeCallLayout(next);
  }, []);

  return [layout, choose];
}

/** Desktop-wide viewport — whether a second pane is worth offering at all.
 *  Shared with the in-call settings menu so the room and the control that
 *  changes it agree on when "side by side" is possible. */
export function useWideViewport(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function readOrientation(): VideoOrientation {
  try {
    return localStorage.getItem(ORIENT_KEY) === "landscape" ? "landscape" : "portrait";
  } catch {
    return "portrait";
  }
}

/**
 * The camera's orientation preference, shared the same way the layout is.
 *
 * `side` pins portrait: that pane is a tall half-width column, so a landscape
 * capture would be letterboxed into a sliver. The caller passes the active
 * layout in and gets back the orientation actually in force, plus a setter
 * that is inert while it is being pinned.
 */
export function useVideoOrientation(
  layout: CallLayout,
): [VideoOrientation, (next: VideoOrientation) => void, boolean] {
  const [chosen, setChosen] = useState<VideoOrientation>(readOrientation);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<VideoOrientation>).detail;
      if (next === "portrait" || next === "landscape") setChosen(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ORIENT_KEY) setChosen(readOrientation());
    };
    window.addEventListener(ORIENT_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ORIENT_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const pinned = layout === "side";
  const choose = useCallback((next: VideoOrientation) => {
    setChosen(next);
    try {
      localStorage.setItem(ORIENT_KEY, next);
    } catch {
      /* storage unavailable — the choice just doesn't outlive the tab */
    }
    window.dispatchEvent(new CustomEvent<VideoOrientation>(ORIENT_EVENT, { detail: next }));
  }, []);

  return [pinned ? "portrait" : chosen, choose, pinned];
}
