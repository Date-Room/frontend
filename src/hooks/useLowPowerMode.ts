import { useEffect, useState } from "react";

/**
 * Heuristic "should we cut expensive GPU effects?" signal, to keep phones from
 * overheating during a call with media playing. Combines:
 *   - static device hints (low memory / few cores / coarse pointer = phone)
 *   - prefers-reduced-motion
 *   - the Compute Pressure API (Chrome) — escalates live when the CPU/thermal
 *     state hits "serious"/"critical"
 * Returns true when we should render the cheaper path (no live-video blur /
 * blend overlays / heavy backdrop filters).
 *
 * The Compute Pressure observer is a module singleton so many tiles calling
 * this hook share one observer.
 */

let staticLowPowerCache: boolean | null = null;
function computeStaticLowPower(): boolean {
  if (staticLowPowerCache !== null) return staticLowPowerCache;
  let result = false;
  if (typeof navigator !== "undefined") {
    const mem = (navigator as { deviceMemory?: number }).deviceMemory;
    const cores = navigator.hardwareConcurrency;
    const mm = typeof window !== "undefined" && typeof window.matchMedia === "function";
    const coarse = mm && window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = mm && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) result = true;
    else if (typeof mem === "number" && mem <= 4) result = true;
    else if (typeof cores === "number" && cores <= 4 && coarse) result = true;
  }
  staticLowPowerCache = result;
  return result;
}

type PressureRecord = { state: string };
type PressureObserverLike = {
  observe: (source: string) => Promise<void>;
  disconnect: () => void;
};

let pressured = false;
const subscribers = new Set<(v: boolean) => void>();
let sharedObserver: PressureObserverLike | null = null;
let observerStarted = false;

function ensureObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const PO = (window as unknown as {
    PressureObserver?: new (cb: (records: PressureRecord[]) => void) => PressureObserverLike;
  }).PressureObserver;
  if (!PO) return;
  try {
    sharedObserver = new PO((records) => {
      const latest = records[records.length - 1];
      if (!latest) return;
      const next = latest.state === "serious" || latest.state === "critical";
      if (next === pressured) return;
      pressured = next;
      subscribers.forEach((fn) => fn(pressured));
    });
    void sharedObserver.observe("cpu").catch(() => undefined);
  } catch {
    sharedObserver = null;
  }
}

export function useLowPowerMode(): boolean {
  const [live, setLive] = useState(pressured);

  useEffect(() => {
    ensureObserver();
    subscribers.add(setLive);
    setLive(pressured);
    return () => {
      subscribers.delete(setLive);
    };
  }, []);

  return computeStaticLowPower() || live;
}
