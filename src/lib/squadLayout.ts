/**
 * How a squad call lays out faces when nothing is on stage, the viewer's
 * own choice (like Zoom's gallery / speaker view), remembered per device:
 *
 *   grid     everyone the same size
 *   speaker  whoever's talking big, the others small
 *   auto     grid when the window has room for it, speaker when it doesn't
 *
 * A game, a film or a tucked-away call still use their own layouts.
 */
import { useEffect, useState } from "react";

export type SquadLayoutPref = "auto" | "grid" | "speaker";

const KEY = "dr:squad-layout";
const EVENT = "dr:squad-layout";
/** Below this width (CSS px) "auto" shows the speaker view. A 3-4 person
 *  grid fits comfortably from here; it used to be 1024. */
export const AUTO_GRID_MIN_WIDTH = 768;

export function readSquadLayout(): SquadLayoutPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "grid" || v === "speaker" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function saveSquadLayout(pref: SquadLayoutPref): void {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* private mode: the choice lasts this session only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: pref }));
}

/** The viewer's choice, kept in sync across every place that shows it. */
export function useSquadLayout(): [SquadLayoutPref, (p: SquadLayoutPref) => void] {
  const [pref, setPref] = useState<SquadLayoutPref>(readSquadLayout);
  useEffect(() => {
    const on = () => setPref(readSquadLayout());
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return [
    pref,
    (p: SquadLayoutPref) => {
      setPref(p);
      saveSquadLayout(p);
    },
  ];
}

/** Pure: the hang-out layout to draw. A tucked-away, picture-in-picture or
 *  compact call is always the speaker view (there's no room for a grid). */
export function resolveSquadLayout(
  pref: SquadLayoutPref,
  ctx: { tucked: boolean; width: number },
): "grid" | "focus" {
  if (ctx.tucked) return "focus";
  if (pref === "grid") return "grid";
  if (pref === "speaker") return "focus";
  return ctx.width >= AUTO_GRID_MIN_WIDTH ? "grid" : "focus";
}
