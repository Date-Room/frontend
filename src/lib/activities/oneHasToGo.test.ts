import { describe, expect, it } from "vitest";
import {
  OHTG_ROUNDS,
  initialOhtgState,
  ohtgFromJson,
  ohtgIsFinished,
  ohtgRevealSteps,
  reduceOhtg,
  type OhtgState,
} from "./oneHasToGo";

const A = "user-a";
const B = "user-b";

function cut(state: OhtgState, userId: string, option: number, round = state.round): OhtgState {
  return reduceOhtg(state, { type: "cut", payload: { round, option }, userId });
}
function guess(state: OhtgState, userId: string, option: number, round = state.round): OhtgState {
  return reduceOhtg(state, { type: "guess", payload: { round, option }, userId });
}

describe("reduceOhtg", () => {
  it("moves to guessing only after both players cut", () => {
    let s = initialOhtgState();
    s = cut(s, A, 0);
    expect(s.phase).toBe("cutting");
    expect(s.cuts[A]).toBe(0);
    s = cut(s, B, 2);
    expect(s.phase).toBe("guessing");
  });

  it("ignores a second cut from the same player and stale-round cuts", () => {
    let s = initialOhtgState();
    s = cut(s, A, 0);
    const again = cut(s, A, 3);
    expect(again).toBe(s);
    const stale = cut(s, B, 1, 4);
    expect(stale).toBe(s);
  });

  it("ignores out-of-range options", () => {
    const s = initialOhtgState();
    expect(cut(s, A, -1)).toBe(s);
    expect(cut(s, A, OHTG_ROUNDS[0].options.length)).toBe(s);
  });

  it("ignores a third player once both cuts are in", () => {
    let s = initialOhtgState();
    s = cut(s, A, 0);
    s = cut(s, B, 1);
    const intruder = cut(s, "user-c", 2);
    expect(intruder).toBe(s);
  });

  it("rejects guesses before the guessing phase and from non-players", () => {
    let s = initialOhtgState();
    expect(guess(s, A, 1)).toBe(s);
    s = cut(s, A, 0);
    s = cut(s, B, 2);
    expect(guess(s, "user-c", 1)).toBe(s);
  });

  it("scores a read for each correct guess on reveal", () => {
    let s = initialOhtgState();
    s = cut(s, A, 0);
    s = cut(s, B, 2);
    // A guesses B's cut correctly; B guesses wrong.
    s = guess(s, A, 2);
    expect(s.phase).toBe("guessing");
    s = guess(s, B, 3);
    expect(s.phase).toBe("revealing");
    expect(s.reads[A]).toBe(1);
    expect(s.reads[B] ?? 0).toBe(0);
  });

  it("allows guessing the option you cut yourself (same-cut rounds)", () => {
    let s = initialOhtgState();
    s = cut(s, A, 1);
    s = cut(s, B, 1);
    s = guess(s, A, 1);
    s = guess(s, B, 1);
    expect(s.reads[A]).toBe(1);
    expect(s.reads[B]).toBe(1);
  });

  it("advances rounds only from revealing and finishes after the arc", () => {
    let s = initialOhtgState();
    const early = reduceOhtg(s, { type: "next_round", payload: { round: 0 }, userId: A });
    expect(early).toBe(s);
    for (let r = 0; r < OHTG_ROUNDS.length; r++) {
      s = cut(s, A, 0);
      s = cut(s, B, 1);
      s = guess(s, A, 1);
      s = guess(s, B, 0);
      s = reduceOhtg(s, { type: "next_round", payload: { round: r }, userId: B });
    }
    expect(ohtgIsFinished(s)).toBe(true);
    expect(s.rounds_played).toBe(OHTG_ROUNDS.length);
    // Reads accumulate across rounds: both guessed right every round.
    expect(s.reads[A]).toBe(OHTG_ROUNDS.length);
    expect(s.reads[B]).toBe(OHTG_ROUNDS.length);
  });

  it("restart only works after the arc is finished and resets everything", () => {
    let s = initialOhtgState();
    expect(reduceOhtg(s, { type: "restart", payload: {}, userId: A })).toBe(s);
    s = { ...s, round: OHTG_ROUNDS.length };
    const fresh = reduceOhtg(s, { type: "restart", payload: {}, userId: A });
    expect(fresh).toEqual(initialOhtgState());
  });

  it("reveal pacing tightens as the arc deepens", () => {
    const early = ohtgRevealSteps(0);
    const mid = ohtgRevealSteps(4);
    const late = ohtgRevealSteps(9);
    expect(early.map((s) => s.id)).toEqual(["dim", "yours", "theirs", "verdict"]);
    const settleAt = (steps: { id: string; at: number }[]) => steps.find((s) => s.id === "verdict")!.at;
    expect(settleAt(mid)).toBeLessThan(settleAt(early));
    expect(settleAt(late)).toBeLessThan(settleAt(mid));
    for (const steps of [early, mid, late]) {
      for (let i = 1; i < steps.length; i++) expect(steps[i].at).toBeGreaterThan(steps[i - 1].at);
    }
  });

  it("every round has exactly four options and reveal lines", () => {
    expect(OHTG_ROUNDS).toHaveLength(10);
    for (const round of OHTG_ROUNDS) {
      expect(round.options).toHaveLength(4);
      expect(round.clashLine.length).toBeGreaterThan(0);
      expect(round.matchLine.length).toBeGreaterThan(0);
    }
  });

  it("round-trips through json with junk tolerated", () => {
    expect(ohtgFromJson(null)).toEqual(initialOhtgState());
    const s = ohtgFromJson({
      round: 2,
      phase: "guessing",
      cuts: { [A]: 1, [B]: "bad" },
      guesses: { [A]: 0 },
      reads: { [B]: 3 },
      rounds_played: 2,
    });
    expect(s.round).toBe(2);
    expect(s.phase).toBe("guessing");
    expect(s.cuts).toEqual({ [A]: 1 });
    expect(s.reads).toEqual({ [B]: 3 });
  });
});
