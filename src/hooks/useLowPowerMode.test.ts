import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

/** Pretend to be a device: which media queries match, plus the nav hints. */
function mockDevice(opts: {
  matches: string[];
  deviceMemory?: number;
  hardwareConcurrency?: number;
}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({ matches: opts.matches.includes(q) })),
  );
  Object.defineProperty(navigator, "deviceMemory", {
    value: opts.deviceMemory,
    configurable: true,
  });
  Object.defineProperty(navigator, "hardwareConcurrency", {
    value: opts.hardwareConcurrency,
    configurable: true,
  });
}

/** The static answer is cached per module, so each case gets a fresh import. */
async function lowPower(): Promise<boolean> {
  vi.resetModules();
  const { useLowPowerMode } = await import("./useLowPowerMode");
  return renderHook(() => useLowPowerMode()).result.current;
}

describe("useLowPowerMode", () => {
  beforeEach(() => {
    vi.stubGlobal("PressureObserver", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a touch-only device as low-power however many cores it advertises", async () => {
    // A recent iPhone: no deviceMemory, 6 cores. Used to take the full path.
    mockDevice({ matches: ["(pointer: coarse)", "(hover: none)"], hardwareConcurrency: 6 });
    expect(await lowPower()).toBe(true);
    // A mid-range Android: 8 cores, 6 GB.
    mockDevice({
      matches: ["(pointer: coarse)", "(hover: none)"],
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    expect(await lowPower()).toBe(true);
  });

  it("keeps a laptop on the full path", async () => {
    mockDevice({ matches: [], hardwareConcurrency: 8, deviceMemory: 8 });
    expect(await lowPower()).toBe(false);
  });

  it("keeps a touchscreen laptop on the full path (its primary pointer still hovers)", async () => {
    mockDevice({ matches: ["(pointer: coarse)"], hardwareConcurrency: 8, deviceMemory: 8 });
    expect(await lowPower()).toBe(false);
  });

  it("still catches a low-memory desktop and honours reduced motion", async () => {
    mockDevice({ matches: [], hardwareConcurrency: 8, deviceMemory: 4 });
    expect(await lowPower()).toBe(true);
    mockDevice({ matches: ["(prefers-reduced-motion: reduce)"], hardwareConcurrency: 16, deviceMemory: 16 });
    expect(await lowPower()).toBe(true);
  });
});
