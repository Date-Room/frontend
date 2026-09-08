import { describe, expect, it } from "vitest";
import {
  DOOR_ROUNDS,
  initialPickADoorState,
  pickADoorFromJson,
  pickADoorIsFinished,
  reducePickADoor,
  type PickADoorState,
} from "./pickADoor";

const A = "user-a";
const B = "user-b";

function pick(state: PickADoorState, userId: string, door: number, round = state.round): PickADoorState {
  return reducePickADoor(state, { type: "pick", payload: { round, door }, userId });
}

describe("reducePickADoor", () => {
  it("reveals only after both players pick", () => {
    let s = initialPickADoorState();
    s = pick(s, A, 0);
    expect(s.phase).toBe("picking");
    s = pick(s, B, 2);
    expect(s.phase).toBe("revealing");
    expect(s.picks).toEqual({ [A]: 0, [B]: 2 });
  });

  it("allows both players to pick the same door", () => {
    let s = initialPickADoorState();
    s = pick(s, A, 1);
    s = pick(s, B, 1);
    expect(s.phase).toBe("revealing");
    expect(s.picks[A]).toBe(1);
    expect(s.picks[B]).toBe(1);
  });

  it("ignores double picks, stale rounds, bad doors, and a third player", () => {
    let s = initialPickADoorState();
    s = pick(s, A, 0);
    expect(pick(s, A, 2)).toBe(s);
    expect(pick(s, B, 1, 3)).toBe(s);
    expect(pick(s, B, -1)).toBe(s);
    expect(pick(s, B, DOOR_ROUNDS[0].doors.length)).toBe(s);
    s = pick(s, B, 1);
    expect(pick(s, "user-c", 2)).toBe(s);
  });

  it("advances only from revealing and finishes after five rounds", () => {
    let s = initialPickADoorState();
    const early = reducePickADoor(s, { type: "next_round", payload: { round: 0 }, userId: A });
    expect(early).toBe(s);
    for (let r = 0; r < DOOR_ROUNDS.length; r++) {
      s = pick(s, A, 0);
      s = pick(s, B, 1);
      s = reducePickADoor(s, { type: "next_round", payload: { round: r }, userId: B });
    }
    expect(pickADoorIsFinished(s)).toBe(true);
    expect(s.rounds_played).toBe(DOOR_ROUNDS.length);
  });

  it("restart only works after the arc is finished", () => {
    let s = initialPickADoorState();
    expect(reducePickADoor(s, { type: "restart", payload: {}, userId: A })).toBe(s);
    s = { ...s, round: DOOR_ROUNDS.length };
    expect(reducePickADoor(s, { type: "restart", payload: {}, userId: A })).toEqual(
      initialPickADoorState(),
    );
  });

  it("round-trips through json with junk tolerated", () => {
    expect(pickADoorFromJson(null)).toEqual(initialPickADoorState());
    const s = pickADoorFromJson({
      round: 3,
      phase: "revealing",
      picks: { [A]: 2, [B]: "junk" },
      rounds_played: 3,
    });
    expect(s.round).toBe(3);
    expect(s.phase).toBe("revealing");
    expect(s.picks).toEqual({ [A]: 2 });
  });

  it("every round has exactly three doors with questions", () => {
    expect(DOOR_ROUNDS).toHaveLength(8);
    for (const round of DOOR_ROUNDS) {
      expect(round.doors).toHaveLength(3);
      for (const door of round.doors) {
        expect(door.question.length).toBeGreaterThan(10);
      }
    }
  });
});
