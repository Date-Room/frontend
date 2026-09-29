import { describe, expect, it } from "vitest";
import { gridColumns, liveVideoFor, localClock, nearTheEnd, placeLine, speakerFirst, timeLeft } from "./squadCall";

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

  it("puts the speaker first", () => {
    expect(speakerFirst(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(speakerFirst(["a", "b"], null, "b")).toEqual(["b", "a"]);
  });

  it("picks grid columns", () => {
    expect([1, 2, 4, 5, 6].map(gridColumns)).toEqual([1, 2, 2, 3, 3]);
  });
});
