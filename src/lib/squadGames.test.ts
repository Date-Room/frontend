import { describe, expect, it } from "vitest";
import {
  canSkip,
  stageCueFor,
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

describe("canSkip", () => {
  it("only before anyone has played the card", () => {
    expect(canSkip(round({}), "a")).toBe(true);
    expect(canSkip(round({ submitted: ["b"] }), "a")).toBe(false);
    expect(canSkip(round({}), "z")).toBe(false);
    expect(canSkip(round({ stage: "revealed" }), "a")).toBe(false);
    expect(canSkip(round({ game: "who_said_it", stage: "guess" }), "a")).toBe(false);
    const hu = { game: "heads_up" as const, stage: "playing" as const };
    expect(canSkip(round({ ...hu, heads_up: { index: 0, total: 12 } }), "a")).toBe(true);
    expect(canSkip(round({ ...hu, heads_up: { index: 2, total: 12 } }), "a")).toBe(false);
  });
});

describe("stageCueFor", () => {
  it("makes faces the ballot, then waits", () => {
    const r = round({ submitted: [] });
    const deciding = stageCueFor(r, { playing: true }, "a", false);
    expect(deciding.mode).toBe("deciding");
    expect(deciding.vote).toBe(true);
    expect(deciding.faces.b.tappable).toBe(true);
    expect(deciding.faces.a.tappable).toBe(true); // you can pick yourself in Most Likely To
    const waiting = stageCueFor(round({ submitted: ["a"] }), { playing: true, my_move: "b" }, "a", false);
    expect(waiting.mode).toBe("waiting");
    expect(waiting.faces.b.picked).toBe(true);
    expect(waiting.faces.a.badge).toBe("in");
    expect(waiting.faces.c.badge).toBe("thinking");
  });

  it("never lets the imposter vote for themselves", () => {
    const c = stageCueFor(round({ game: "imposter" }), { playing: true }, "a", false);
    expect(c.faces.a.tappable).toBe(false);
    expect(c.faces.a.dim).toBe(true);
  });

  it("puts the winner forward at the reveal, or stays quiet on a tie", () => {
    const won = round({ stage: "revealed", public: { results: { top: ["b"], tally: { b: 2 } } } });
    expect(stageCueFor(won, null, "a", false)).toMatchObject({ mode: "spotlight", focus: "b" });
    const tie = round({ stage: "revealed", public: { results: { top: ["b", "c"] } } });
    expect(stageCueFor(tie, null, "a", false).mode).toBe("reading");
  });

  it("keeps the Clue Me In guesser big, and reading rounds as a strip", () => {
    expect(stageCueFor(round({ game: "heads_up", stage: "playing", lead_id: "c" }), null, "a", false)).toMatchObject({ mode: "hero", focus: "c" });
    expect(stageCueFor(round({ game: "heads_up", stage: "playing", lead_id: "a" }), null, "a", false).mode).toBe("deciding");
    const tea = stageCueFor(round({ game: "spill_tea", stage: "answer", lead_id: "a" }), null, "b", false);
    expect(tea.mode).toBe("reading");
    expect(tea.faces.a.ring).toBe(true);
    expect(stageCueFor(null, null, "a", false).mode).toBe("reading");
    expect(stageCueFor(round({}), null, "a", true).mode).toBe("reading");
  });
});
