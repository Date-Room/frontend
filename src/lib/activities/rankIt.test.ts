import { describe, expect, it } from "vitest";
import {
  RANK_ROUNDS,
  compareRankings,
  initialRankItState,
  rankItFromJson,
  rankItIsFinished,
  rankOf,
  reduceRankIt,
  type RankItState,
} from "./rankIt";

const A = "user-a";
const B = "user-b";

function submit(state: RankItState, userId: string, order: number[], round = state.round): RankItState {
  return reduceRankIt(state, { type: "submit_ranking", payload: { round, order }, userId });
}

describe("reduceRankIt", () => {
  it("reveals only after both players lock in", () => {
    let s = initialRankItState();
    s = submit(s, A, [0, 1, 2, 3, 4]);
    expect(s.phase).toBe("ranking");
    s = submit(s, B, [4, 3, 2, 1, 0]);
    expect(s.phase).toBe("revealing");
  });

  it("rejects non-permutations, resubmits, stale rounds, and third players", () => {
    let s = initialRankItState();
    expect(submit(s, A, [0, 1, 2, 3])).toBe(s);
    expect(submit(s, A, [0, 0, 2, 3, 4])).toBe(s);
    expect(submit(s, A, [0, 1, 2, 3, 9])).toBe(s);
    s = submit(s, A, [0, 1, 2, 3, 4]);
    expect(submit(s, A, [4, 3, 2, 1, 0])).toBe(s);
    expect(submit(s, B, [0, 1, 2, 3, 4], 2)).toBe(s);
    s = submit(s, B, [0, 1, 2, 3, 4]);
    expect(submit(s, "user-c", [0, 1, 2, 3, 4])).toBe(s);
  });

  it("advances only from revealing and finishes after the arc", () => {
    let s = initialRankItState();
    expect(reduceRankIt(s, { type: "next_round", payload: { round: 0 }, userId: A })).toBe(s);
    for (let r = 0; r < RANK_ROUNDS.length; r++) {
      s = submit(s, A, [0, 1, 2, 3, 4]);
      s = submit(s, B, [4, 3, 2, 1, 0]);
      s = reduceRankIt(s, { type: "next_round", payload: { round: r }, userId: B });
    }
    expect(rankItIsFinished(s)).toBe(true);
    expect(s.rounds_played).toBe(RANK_ROUNDS.length);
  });

  it("restart only works after the arc is finished", () => {
    let s = initialRankItState();
    expect(reduceRankIt(s, { type: "restart", payload: {}, userId: A })).toBe(s);
    s = { ...s, round: RANK_ROUNDS.length };
    expect(reduceRankIt(s, { type: "restart", payload: {}, userId: A })).toEqual(initialRankItState());
  });

  it("round-trips through json, dropping invalid rankings", () => {
    expect(rankItFromJson(null)).toEqual(initialRankItState());
    const s = rankItFromJson({
      round: 1,
      phase: "revealing",
      rankings: { [A]: [0, 1, 2, 3, 4], [B]: [0, 0, 1, 2, 3] },
      rounds_played: 1,
    });
    expect(s.rankings).toEqual({ [A]: [0, 1, 2, 3, 4] });
  });
});

describe("compareRankings", () => {
  it("finds the closest and furthest items", () => {
    const a = [0, 1, 2, 3, 4]; // item 0 at rank 1 … item 4 at rank 5
    const b = [4, 1, 2, 3, 0]; // items 0 and 4 swapped to the extremes
    const { closest, furthest, furthestGap } = compareRankings(a, b);
    expect(closest).toBe(1); // identical rank, earliest tie wins
    expect(furthest).toBe(0); // rank 1 vs rank 5
    expect(furthestGap).toBe(4);
  });

  it("reports zero gap for identical rankings", () => {
    const order = [2, 0, 1, 4, 3];
    const { furthestGap } = compareRankings(order, order);
    expect(furthestGap).toBe(0);
  });

  it("rankOf is 1-based by position", () => {
    expect(rankOf([2, 0, 1], 2)).toBe(1);
    expect(rankOf([2, 0, 1], 1)).toBe(3);
  });
});

describe("content", () => {
  it("every round has exactly five items", () => {
    expect(RANK_ROUNDS).toHaveLength(5);
    for (const round of RANK_ROUNDS) expect(round.items).toHaveLength(5);
  });
});
