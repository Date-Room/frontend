import { useEffect, useState } from "react";

/**
 * Heuristic "should we cut expensive GPU effects?" signal, to keep phones from
 * overheating during a call with media playing. Combines:
 *   - static device hints (touch-only device = phone/tablet; low memory; few cores)
 *   - prefers-reduced-motion
 *   - the Compute Pressure API (Chrome) — escalates live when the CPU/thermal
 *     state hits "serious"/"critical"
 * Returns true when we should render the cheaper path (no live-video blur /
 * blend overlays / heavy backdrop filters / ambient backdrop animation).
 *
 * Any touch-only device counts as low-power. The earlier memory/core checks
 * alone missed the phones that actually overheat: iPhones report no
 * deviceMemory and 6 cores, mid-range Androids report 8 cores and 6 GB, so
 * neither ever took the cheap path. A phone has no fan and shares one thermal
 * budget between the video encode and the GPU, and that is true regardless of
 * how many cores it advertises. "hover: none" keeps touchscreen laptops (whose
 * primary pointer still hovers) on the full path.
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
    const touchOnly = coarse && mm && window.matchMedia("(hover: none)").matches;
    const reducedMotion = mm && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) result = true;
    else if (touchOnly) result = true;
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
