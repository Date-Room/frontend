import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stageAt, useCinematic, type CinematicStep } from "./cinematic";
import { useTypewriter } from "./typewriter";

const STEPS: CinematicStep[] = [
  { id: "dimming", at: 0 },
  { id: "opening", at: 1100 },
  { id: "question", at: 2700 },
];

describe("stageAt", () => {
  it("returns the stage active at a given elapsed time", () => {
    expect(stageAt(STEPS, -1)).toBe(null);
    expect(stageAt(STEPS, 0)).toBe("dimming");
    expect(stageAt(STEPS, 1100)).toBe("opening");
    expect(stageAt(STEPS, 2699)).toBe("opening");
    expect(stageAt(STEPS, 99999)).toBe("question");
  });
});

describe("useCinematic", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays the sequence when the threshold is crossed live", () => {
    const { result, rerender } = renderHook(({ active }) => useCinematic(active, STEPS), {
      initialProps: { active: false },
    });
    expect(result.current.stage).toBe(null);
    rerender({ active: true });
    expect(result.current.witnessed).toBe(true);
    expect(result.current.stage).toBe("dimming");
    act(() => vi.advanceTimersByTime(1100));
    expect(result.current.stage).toBe("opening");
    act(() => vi.advanceTimersByTime(1600));
    expect(result.current.stage).toBe("question");
  });

  it("skips the show when hydrated mid-moment", () => {
    const { result } = renderHook(() => useCinematic(true, STEPS));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.witnessed).toBe(false);
    expect(result.current.stage).toBe(null);
  });

  it("resets when active drops, and can replay on the next round", () => {
    const { result, rerender } = renderHook(({ active }) => useCinematic(active, STEPS), {
      initialProps: { active: false },
    });
    rerender({ active: true });
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.stage).toBe("question");
    rerender({ active: false });
    expect(result.current.stage).toBe(null);
    expect(result.current.witnessed).toBe(false);
    rerender({ active: true });
    expect(result.current.witnessed).toBe(true);
    expect(result.current.stage).toBe("dimming");
  });
});

describe("useTypewriter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("types the text in and reports completion", () => {
    const { result } = renderHook(() => useTypewriter("abc", true, 10));
    expect(result.current.shown).toBe("");
    act(() => vi.advanceTimersByTime(10));
    expect(result.current.shown).toBe("a");
    act(() => vi.advanceTimersByTime(30));
    expect(result.current.shown).toBe("abc");
    expect(result.current.complete).toBe(true);
  });

  it("stays empty while inactive", () => {
    const { result } = renderHook(() => useTypewriter("abc", false, 10));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.shown).toBe("");
    expect(result.current.complete).toBe(false);
  });
});
