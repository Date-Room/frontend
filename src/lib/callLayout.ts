/**
 * Where the call sits in the room — a preference, not a consequence of the
 * viewport.
 *
 * Three ways the call can share the screen with the activity:
 *   `side`     — call and stage as two panes, one tile each
 *   `side-pip` — the pane stays, but the video inside it is one full-bleed
 *                feed with the other floating over it, the way a phone call
 *                looks
 *   `float`    — the call is a draggable window over the stage
 *
 * Shared through storage plus an event because the room does the laying out
 * while the switcher and the in-call settings menu offer the choice, and they
 * live in different trees.
 */
import { useCallback, useEffect, useState } from "react";

export type CallLayout = "side" | "side-pip" | "float";

const KEY = "dr:call-layout:v1";
const EVENT = "dr:call-layout-changed";

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
