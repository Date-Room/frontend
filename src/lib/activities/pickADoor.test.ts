import { describe, expect, it } from "vitest";
import {
  DOOR_ROUNDS,
  initialPickADoorState,
  pickADoorFromJson,
  pickADoorIsFinished,
  pickADoorSameDoor,
  pickADoorStageOwner,
  reducePickADoor,
  type PickADoorState,
} from "./pickADoor";

const A = "user-a";
const B = "user-b";

function pick(state: PickADoorState, userId: string, door: number, round = state.round): PickADoorState {
  return reducePickADoor(state, { type: "pick", payload: { round, door }, userId });
}

function advance(state: PickADoorState, userId: string, stage: number, round = state.round): PickADoorState {
  return reducePickADoor(state, { type: "advance_stage", payload: { round, stage }, userId });
}

function next(state: PickADoorState, userId: string, round = state.round): PickADoorState {
  return reducePickADoor(state, { type: "next_round", payload: { round }, userId });
}

/** A picks first, B second, different doors — reveal at stage 0, A on stage. */
function reveal(): PickADoorState {
  let s = initialPickADoorState();
  s = pick(s, A, 0);
  s = pick(s, B, 1);
  return s;
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

  it("records the first picker and starts the reveal at stage 0", () => {
    const s = reveal();
    expect(s.first_picker).toBe(A);
    expect(s.stage).toBe(0);
    expect(pickADoorStageOwner(s)).toBe(A);
  });

  it("allows both players to pick the same door", () => {
    let s = initialPickADoorState();
    s = pick(s, A, 1);
    s = pick(s, B, 1);
    expect(s.phase).toBe("revealing");
    expect(s.picks[A]).toBe(1);
    expect(s.picks[B]).toBe(1);
    expect(pickADoorSameDoor(s)).toBe(true);
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

  it("only the staged door's owner can advance, one stage at a time", () => {
    let s = reveal();
    // B doesn't own stage 0-1, and skipping stages is refused.
    expect(advance(s, B, 1)).toBe(s);
    expect(advance(s, A, 2)).toBe(s);
    expect(advance(s, A, 0)).toBe(s);
    s = advance(s, A, 1); // A: "I'm ready to answer"
    expect(s.stage).toBe(1);
    expect(advance(s, B, 2)).toBe(s); // still A's turn to pass it over
    s = advance(s, A, 2); // A: "Pass it over"
    expect(s.stage).toBe(2);
    expect(pickADoorStageOwner(s)).toBe(B);
    expect(advance(s, A, 3)).toBe(s); // B's door now — A can't advance it
    s = advance(s, B, 3);
    expect(s.stage).toBe(3);
    expect(advance(s, B, 4)).toBe(s); // no stage past the last
  });

  it("ignores advance_stage outside revealing or for a stale round", () => {
    let s = initialPickADoorState();
    s = pick(s, A, 0);
    expect(advance(s, A, 1)).toBe(s);
    s = pick(s, B, 1);
    expect(advance(s, A, 1, 5)).toBe(s);
  });

  it("same-door rounds collapse to one stage either player can advance", () => {
    let s = initialPickADoorState();
    s = pick(s, A, 1);
    s = pick(s, B, 1);
    expect(next(s, A)).toBe(s); // not before the answering stage
    s = advance(s, B, 1); // either player may say "We're ready"
    expect(s.stage).toBe(1);
    expect(advance(s, A, 2)).toBe(s); // no second door when it's the same one
    s = next(s, B);
    expect(s.round).toBe(1);
  });

  it("next_round waits for the final stage, then resets the turn order", () => {
    let s = reveal();
    expect(next(s, A)).toBe(s);
    s = advance(s, A, 1);
    expect(next(s, B)).toBe(s);
    s = advance(s, A, 2);
    s = advance(s, B, 3);
    s = next(s, A); // either player closes the round
    expect(s.round).toBe(1);
    expect(s.phase).toBe("picking");
    expect(s.picks).toEqual({});
    expect(s.first_picker).toBeNull();
    expect(s.stage).toBe(0);
    expect(s.rounds_played).toBe(1);
  });

  it("walks the whole arc through the staged reveal and finishes", () => {
    let s = initialPickADoorState();
    const early = next(s, A);
    expect(early).toBe(s);
    for (let r = 0; r < DOOR_ROUNDS.length; r++) {
      s = pick(s, B, 0); // B first this time — B's door leads
      s = pick(s, A, 1);
      expect(pickADoorStageOwner(s)).toBe(B);
      s = advance(s, B, 1);
      s = advance(s, B, 2);
      s = advance(s, A, 3);
      s = next(s, B, r);
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
      first_picker: A,
      stage: 2,
      rounds_played: 3,
    });
    expect(s.round).toBe(3);
    expect(s.phase).toBe("revealing");
    expect(s.picks).toEqual({ [A]: 2 });
    expect(s.first_picker).toBe(A);
    expect(s.stage).toBe(2);
    // Missing or out-of-range stage fields fall back safely.
    const legacy = pickADoorFromJson({ round: 1, phase: "revealing", picks: { [A]: 0, [B]: 1 } });
    expect(legacy.first_picker).toBeNull();
    expect(legacy.stage).toBe(0);
    expect(pickADoorFromJson({ stage: 7 }).stage).toBe(0);
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
