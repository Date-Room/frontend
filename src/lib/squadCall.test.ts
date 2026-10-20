import { describe, expect, it } from "vitest";
import { friendGridClass, gridColumns, gridColumnsFor, joinNames, liveVideoFor, squadHereLine, localClock, nearTheEnd, placeLine, speakerFirst, timeLeft , readSeats, saveSeats, swapSeats, tableFaceShare, tableSeats, tableTile } from "./squadCall";

const at = new Date("2026-09-29T17:30:00Z");

describe("squad call helpers", () => {
  it("shows each person's own clock", () => {
    expect(localClock("Africa/Nairobi", at)).toBe("8:30 PM");
    expect(localClock("Africa/Lagos", at)).toBe("6:30 PM");
    expect(localClock("America/Chicago", at)).toBe("12:30 PM");
    expect(localClock(null, at)).toBeNull();
    expect(localClock("Mars/Base", at)).toBeNull();
    expect(placeLine("Nairobi", "Africa/Nairobi", at)).toBe("Nairobi · 8:30 PM");
    expect(placeLine(null, null, at)).toBe("");
  });

  it("counts down the night", () => {
    expect(timeLeft("2026-09-29T18:54:00Z", at)).toBe("1h 24m left");
    expect(timeLeft("2026-09-29T17:42:00Z", at)).toBe("12m left");
    expect(timeLeft("2026-09-29T17:00:00Z", at)).toBe("Time's up");
    expect(nearTheEnd("2026-09-29T17:38:00Z", at)).toBe(true);
    expect(nearTheEnd("2026-09-29T18:38:00Z", at)).toBe(false);
  });

  it("keeps weak phones to the speaker and yourself", () => {
    const all = ["a", "b", "c", "d"];
    expect(liveVideoFor(all, { speaker: "c", self: "a", lowPower: false }).size).toBe(4);
    expect([...liveVideoFor(all, { speaker: "c", self: "a", lowPower: true })].sort()).toEqual(["a", "c"]);
  });

  it("orders faces: grid starts with you, focus with the speaker and ends with you", () => {
    expect(speakerFirst(["a", "b", "c"], "c", "a")).toEqual(["a", "b", "c"]);
    expect(speakerFirst(["a", "b", "c"], "c", "a", true)).toEqual(["c", "b", "a"]);
    expect(speakerFirst(["a", "b"], null, "a", true)).toEqual(["b", "a"]);
    // You talking doesn't put you big on your own phone.
    expect(speakerFirst(["a", "b"], "a", "a", true)).toEqual(["b", "a"]);
  });

  it("names who's here", () => {
    expect(joinNames(["Amaka"])).toBe("Amaka");
    expect(joinNames(["Amaka", "Salma", "Nia"])).toBe("Amaka, Salma and Nia");
    expect(squadHereLine([])).toBe("Waiting for the squad…");
    expect(squadHereLine(["Amaka"])).toBe("Amaka is here");
    expect(squadHereLine(["Amaka", "Salma"])).toBe("Amaka and Salma are here");
  });

  it("picks grid columns", () => {
    expect([1, 2, 3, 4, 5, 6].map(gridColumns)).toEqual([1, 2, 2, 2, 3, 3]);
  });
});

describe("friendGridClass", () => {
  it("never needs more than a 2 by 2 for friends", () => {
    expect(friendGridClass(1)).toContain("grid-cols-1");
    expect(friendGridClass(2)).toContain("grid-rows-2");
    expect(friendGridClass(3)).toContain("col-span-2");
    expect(friendGridClass(4)).toBe("grid-cols-2 grid-rows-2");
  });
});

describe("the table", () => {
  const ids = ["me", "a", "k", "s", "t"];
  it("seats friends left then right, you under them, and keeps both sides even", () => {
    expect(tableSeats(ids.slice(0, 1), "me", null)).toEqual({ left: [], right: ["me"] });
    expect(tableSeats(ids.slice(0, 2), "me", null)).toEqual({ left: ["a"], right: ["me"] });
    expect(tableSeats(ids.slice(0, 3), "me", null)).toEqual({ left: ["a", "k"], right: ["me", null] });
    expect(tableSeats(ids.slice(0, 4), "me", null)).toEqual({ left: ["a", "k"], right: ["s", "me"] });
    expect(tableSeats(ids, "me", null)).toEqual({ left: ["a", "k", "s"], right: ["t", "me", null] });
    expect(tableSeats([...ids, "z"], "me", null)).toEqual({ left: ["a", "k", "s"], right: ["t", "z", "me"] });
  });

  it("keeps a saved arrangement, drops who left and adds who arrived", () => {
    expect(tableSeats(["me", "a", "k", "s"], "me", ["me", "s", "gone", "a"])).toEqual({
      left: ["me", "s"],
      right: ["a", "k"],
    });
  });

  it("sizes seats to the camera's shape and the rows", () => {
    expect(tableTile(458, 748, 2)).toEqual({ w: 458, h: 257 });
    expect(tableTile(458, 748, 3)).toEqual({ w: 429, h: 241 });
  });

  it("gives the middle to a face only at a reveal or for the guesser", () => {
    expect(tableFaceShare("spotlight", true)).toBeGreaterThan(0.5);
    expect(tableFaceShare("hero", true)).toBe(0.5);
    expect(tableFaceShare("spotlight", false)).toBe(0);
    expect(tableFaceShare("deciding", true)).toBe(0);
  });

  it("swaps two seats and remembers the arrangement", () => {
    expect(swapSeats(["a", "b", "c"], "a", "c")).toEqual(["c", "b", "a"]);
    expect(swapSeats(["a", "b"], "a", "x")).toEqual(["a", "b"]);
    localStorage.clear();
    expect(readSeats("r")).toBeNull();
    saveSeats("r", ["b", "a"]);
    expect(readSeats("r")).toEqual(["b", "a"]);
    saveSeats("r", null);
    expect(readSeats("r")).toBeNull();
  });
});


describe("gridColumnsFor", () => {
  it("keeps tiles close to a camera's shape for the stage it has", () => {
    // A laptop stage (about 1220 x 830): three is 2 x 2, not tall slivers.
    expect(gridColumnsFor(3, 1220, 830)).toBe(2);
    expect(gridColumnsFor(4, 1220, 830)).toBe(2);
    // Six: three rows of two keeps wide tiles; two rows of three would be square.
    expect(gridColumnsFor(6, 1220, 830)).toBe(2);
    expect(gridColumnsFor(6, 1900, 830)).toBe(3);
    // A very wide, short stage can take a row of three.
    expect(gridColumnsFor(3, 2400, 500)).toBe(3);
    // A tall phone stage stacks them.
    expect(gridColumnsFor(2, 390, 700)).toBe(1);
    // Not measured yet: the simple rule.
    expect(gridColumnsFor(5, 0, 0)).toBe(3);
  });
});
