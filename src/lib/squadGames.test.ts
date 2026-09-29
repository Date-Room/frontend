import { describe, expect, it } from "vitest";
import {
  isSquadGame,
  listNames,
  myTurn,
  secondsLeft,
  startBlocker,
  tallyRows,
  waitingOn,
  type Round,
} from "@/lib/squadGames";

const round = (over: Partial<Round>): Round => ({
  id: "r",
  game: "most_likely",
  number: 1,
  deck: "mild",
  stage: "vote",
  prompt: { id: "c", text: "?" },
  players: ["a", "b", "c"],
  lead_id: null,
  deadline_at: null,
  submitted: [],
  public: {},
  ...over,
});

describe("waitingOn", () => {
  it("lists players who haven't moved", () => {
    expect(waitingOn(round({ submitted: ["b"] }))).toEqual(["a", "c"]);
  });

  it("leaves the judge out of answers, and waits only on the judge to pick", () => {
    const tea = { game: "spill_tea" as const, lead_id: "a" };
    expect(waitingOn(round({ ...tea, stage: "answer", submitted: ["b"] }))).toEqual(["c"]);
    expect(waitingOn(round({ ...tea, stage: "pick" }))).toEqual(["a"]);
  });

  it("never waits on a reveal or on Heads up", () => {
    expect(waitingOn(round({ stage: "revealed" }))).toEqual([]);
    expect(waitingOn(round({ game: "heads_up", stage: "playing" }))).toEqual([]);
  });
});

describe("myTurn", () => {
  it("follows each game's rules", () => {
    expect(myTurn(round({}), "a")).toBe(true);
    expect(myTurn(round({}), "z")).toBe(false);
    expect(myTurn(round({}), null)).toBe(false);
    const tea = { game: "spill_tea" as const, lead_id: "a" };
    expect(myTurn(round({ ...tea, stage: "answer" }), "a")).toBe(false);
    expect(myTurn(round({ ...tea, stage: "pick" }), "a")).toBe(true);
    expect(myTurn(round({ ...tea, stage: "pick" }), "b")).toBe(false);
    expect(myTurn(round({ game: "heads_up", stage: "playing", lead_id: "a" }), "a")).toBe(false);
    expect(myTurn(round({ stage: "revealed" }), "a")).toBe(false);
  });
});

describe("helpers", () => {
  it("counts the clock down to zero", () => {
    const now = Date.parse("2026-09-29T10:00:00Z");
    expect(secondsLeft("2026-09-29T10:00:30.2Z", now)).toBe(31);
    expect(secondsLeft("2026-09-29T09:59:00Z", now)).toBe(0);
    expect(secondsLeft(null, now)).toBe(0);
  });

  it("sorts a tally by votes, then name", () => {
    const names: Record<string, string> = { a: "Amaka", b: "Bola", c: "Chi" };
    expect(tallyRows({ c: 1, a: 1, b: 2 }, (p) => names[p]).map((r) => r.name)).toEqual(["Bola", "Amaka", "Chi"]);
  });

  it("joins names", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });

  it("knows each game's minimum", () => {
    expect(startBlocker("imposter", 3)).toMatch(/at least 4/);
    expect(startBlocker("imposter", 4)).toBeNull();
    expect(startBlocker("heads_up", 2)).toBeNull();
  });

  it("recognises squad game ids", () => {
    expect(isSquadGame("imposter")).toBe(true);
    expect(isSquadGame("guacamole")).toBe(false);
  });
});
