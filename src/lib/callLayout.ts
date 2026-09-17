/**
 * Desktop call layout — the person's choice of how the call shares the
 * screen with the activity. Two modes: `split` (the call in a resizable
 * side pane) and `bubble` (a small pair of round tiles floating over the
 * stage). Remembered per device, not per room: it is a preference about
 * your screen. Module store + useSyncExternalStore so the top-bar
 * switcher (LiveRoom) and the stage (RoomStage) read the same value.
 */
import { useSyncExternalStore } from "react";

export type CallMode = "split" | "bubble";

const MODE_KEY = "dr:call-layout";
const PANE_KEY = "dr:call-pane-width";

/** Narrowest useful pane: two stacked faces still read at this width. */
export const PANE_MIN_PX = 280;
/** The pane never takes more than half the row (the old 50/50). */
export const PANE_MAX_FRACTION = 0.5;

function readMode(): CallMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "bubble") return v;
  } catch {
    /* ignore */
  }
  // Includes the retired "corner" value from the first cut — it maps to split.
  return "split";
}

function readPaneWidth(): number | null {
  try {
    const v = Number(localStorage.getItem(PANE_KEY));
    return Number.isFinite(v) && v >= PANE_MIN_PX ? v : null;
  } catch {
    return null;
  }
}

let mode: CallMode = readMode();
let paneWidth: number | null = readPaneWidth();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function getCallMode(): CallMode {
  return mode;
}
export function setCallMode(m: CallMode): void {
  if (m === mode) return;
  mode = m;
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
  emit();
}
export function useCallMode(): CallMode {
  return useSyncExternalStore(subscribe, getCallMode, () => "split" as CallMode);
}

/** Pane width in px; null = the default (half the row). */
export function getPaneWidth(): number | null {
  return paneWidth;
}
export function setPaneWidth(px: number | null): void {
  const next = px == null ? null : Math.round(px);
  if (next === paneWidth) return;
  paneWidth = next;
  try {
    if (next == null) localStorage.removeItem(PANE_KEY);
    else localStorage.setItem(PANE_KEY, String(next));
  } catch {
    /* ignore */
  }
  emit();
}
export function usePaneWidth(): number | null {
  return useSyncExternalStore(subscribe, getPaneWidth, () => null);
}

/** Clamp a requested pane width to what the row allows. */
export function clampPaneWidth(px: number, rowWidth: number): number {
  const max = Math.max(PANE_MIN_PX, Math.floor(rowWidth * PANE_MAX_FRACTION));
  return Math.min(max, Math.max(PANE_MIN_PX, Math.round(px)));
}

/** Test seam: reset module state. */
export function __resetCallLayoutForTests(): void {
  mode = "split";
  paneWidth = null;
  emit();
}
