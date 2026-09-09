import { describe, expect, it } from "vitest";
import {
  TOT_ROUNDS_PER_RUN,
  TOT_SETS,
  initialTotState,
  reduceTot,
  totFromJson,
  totRunDone,
  totSetForRun,
  type TotState,
} from "./thisOrThat";

const A = "user-a";
const B = "user-b";

function play(s: TotState, type: string, userId: string, payload: Record<string, unknown> = {}): TotState {
  return reduceTot(s, { type, payload, userId });
}

describe("reduceTot (the run)", () => {
  it("reveals only when both have picked and predicted", () => {
    let s = initialTotState();
    s = play(s, "pick", A, { round: 0, side: "a", ms: 1200 });
    s = play(s, "predict", A, { round: 0, side: "b" });
    expect(s.phase).toBe("picking");
    s = play(s, "pick", B, { round: 0, side: "b", ms: 4000 });
    s = play(s, "predict", B, { round: 0, side: "a" });
    expect(s.phase).toBe("revealing");
    // A predicted B's side (b) right; B predicted A's side (a) right.
    expect(s.reads[A]).toBe(1);
    expect(s.reads[B]).toBe(1);
    expect(s.same_count).toBe(0);
  });

  it("counts same-side rounds and wrong reads", () => {
    let s = initialTotState();
    s = play(s, "pick", A, { round: 0, side: "a", ms: 100 });
    s = play(s, "predict", A, { round: 0, side: "b" });
    s = play(s, "pick", B, { round: 0, side: "a", ms: 100 });
    s = play(s, "predict", B, { round: 0, side: "a" });
    expect(s.same_count).toBe(1);
    expect(s.reads[A] ?? 0).toBe(0);
    expect(s.reads[B]).toBe(1);
  });

  it("cannot predict before picking, pick twice, or act on a stale round", () => {
    let s = initialTotState();
    expect(play(s, "predict", A, { round: 0, side: "a" })).toBe(s);
    s = play(s, "pick", A, { round: 0, side: "a", ms: 50 });
    expect(play(s, "pick", A, { round: 0, side: "b", ms: 50 })).toBe(s);
    expect(play(s, "pick", B, { round: 3, side: "b", ms: 50 })).toBe(s);
  });

  it("clamps decision time", () => {
    let s = initialTotState();
    s = play(s, "pick", A, { round: 0, side: "a", ms: 999999 });
    expect(s.ms[A]).toBe(60000);
  });

  it("logs rounds and finishes the run at five", () => {
    let s = initialTotState();
    for (let r = 0; r < TOT_ROUNDS_PER_RUN; r++) {
      s = play(s, "pick", A, { round: r, side: "a", ms: 500 });
      s = play(s, "predict", A, { round: r, side: "a" });
      s = play(s, "pick", B, { round: r, side: "a", ms: 700 });
      s = play(s, "predict", B, { round: r, side: "a" });
      s = play(s, "next_round", A, { round: r });
    }
    expect(totRunDone(s)).toBe(true);
    expect(s.log).toHaveLength(TOT_ROUNDS_PER_RUN);
    expect(s.same_count).toBe(TOT_ROUNDS_PER_RUN);
    const fresh = play(s, "new_run", B);
    expect(fresh.run).toBe(1);
    expect(fresh.round).toBe(0);
    expect(fresh.log).toHaveLength(0);
  });

  it("round-trips through json", () => {
    const s = totFromJson({
      run: 2,
      round: 1,
      phase: "revealing",
      picks: { [A]: "a", [B]: "b" },
      predictions: { [A]: "b" },
      ms: { [A]: 1234 },
      reads: { [B]: 3 },
      same_count: 1,
      log: [{ picks: { [A]: "a" }, predictions: {}, ms: { [A]: 900 } }],
    });
    expect(s.run).toBe(2);
    expect(s.picks[B]).toBe("b");
    expect(s.log).toHaveLength(1);
  });
});

describe("content", () => {
  it("every set has five pairs escalating to Loaded, with authored lines", () => {
    expect(TOT_SETS.length).toBeGreaterThanOrEqual(3);
    for (const set of TOT_SETS) {
      expect(set).toHaveLength(TOT_ROUNDS_PER_RUN);
      expect(set[4].tier).toBe("Loaded");
      for (const p of set) {
        expect(p.split.length).toBeGreaterThan(10);
        expect(p.together.length).toBeGreaterThan(5);
      }
    }
  });

  it("set rotation wraps", () => {
    expect(totSetForRun(0)).toBe(TOT_SETS[0]);
    expect(totSetForRun(TOT_SETS.length)).toBe(TOT_SETS[0]);
  });
});
