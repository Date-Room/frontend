/**
 * "Right now" help bus — each game publishes a tiny snapshot of where the
 * player is ({ now: one imperative line, step: index into the game's help
 * steps }) computed from its reducer state, and the help overlay renders it
 * as the RIGHT NOW banner with a you-are-here highlight. Pure client-side:
 * a module store + useSyncExternalStore, no re-render cost for the games.
 */
import { useSyncExternalStore } from "react";

export type HelpNow = { now: string; step: number };

const store = new Map<string, HelpNow>();
const listeners = new Set<() => void>();

export function setHelpNow(activityId: string, snap: HelpNow | null): void {
  const prev = store.get(activityId);
  if (snap == null) {
    if (prev === undefined) return;
    store.delete(activityId);
  } else {
    if (prev && prev.now === snap.now && prev.step === snap.step) return;
    store.set(activityId, snap);
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useHelpNow(activityId: string | null): HelpNow | null {
  return useSyncExternalStore(
    subscribe,
    () => (activityId ? (store.get(activityId) ?? null) : null),
  );
}
