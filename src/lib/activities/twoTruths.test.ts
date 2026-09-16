import { describe, expect, it } from "vitest";
import {
  initialTwoTruthsState,
  reduceTwoTruths,
  twoTruthsFromJson,
  type TwoTruthsState,
} from "./twoTruths";

const A = "user-a";
const B = "user-b";

function play(s: TwoTruthsState, type: string, userId: string, payload: Record<string, unknown> = {}): TwoTruthsState {
  return reduceTwoTruths(s, { type, payload, userId });
}

function upToGuessing(): TwoTruthsState {
  let s = play(initialTwoTruthsState(), "claim_turn", A);
  s = play(s, "submit_statements", A, { statements: ["one", "two", "three"], lie_index: 1 });
  return s;
}

describe("reduceTwoTruths (press and stakes)", () => {
  it("press spotlights one statement, once, guesser only", () => {
    let s = upToGuessing();
    expect(play(s, "press", A, { index: 0 })).toBe(s);
    s = play(s, "press", B, { index: 2 });
    expect(s.round?.pressed).toBe(2);
    expect(play(s, "press", B, { index: 0 })).toBe(s);
  });

  it("a right call pays the caller their stake", () => {
    let s = upToGuessing();
    s = play(s, "guess", B, { guess: 1, stake: 2 });
    expect(s.round?.phase).toBe("revealing");
    expect(s.round?.stake).toBe(2);
    expect(s.scores[B]).toBe(2);
    expect(s.scores[A] ?? 0).toBe(0);
  });

  it("a wrong call hands the stake to the liar", () => {
    let s = upToGuessing();
    s = play(s, "guess", B, { guess: 0, stake: 2 });
    expect(s.scores[B] ?? 0).toBe(0);
    expect(s.scores[A]).toBe(2);
  });

  it("stake defaults to 1 when missing or invalid", () => {
    let s = upToGuessing();
    s = play(s, "guess", B, { guess: 1, stake: 7 });
    expect(s.scores[B]).toBe(1);
  });

  it("the storyteller cannot guess their own round", () => {
    const s = upToGuessing();
    expect(play(s, "guess", A, { guess: 1, stake: 1 })).toBe(s);
  });

  it("reveal_and_swap clears the round and counts it", () => {
    let s = upToGuessing();
    s = play(s, "guess", B, { guess: 1 });
    s = play(s, "reveal_and_swap", B);
    expect(s.round).toBeNull();
    expect(s.rounds_played).toBe(1);
  });

  it("round-trips through json with the new fields", () => {
    const s = twoTruthsFromJson({
      scores: { [A]: 3 },
      rounds_played: 2,
      round: {
        storyteller_id: A,
        statements: ["x", "y", "z"],
        lie_index: 0,
        guess: null,
        pressed: 1,
        stake: null,
        phase: "guessing",
      },
    });
    expect(s.round?.pressed).toBe(1);
    expect(s.round?.stake).toBeNull();
    expect(s.scores[A]).toBe(3);
  });
});
