// A point that lands.
//
// The score used to be simply different the next time you looked,
// which is the one moment in a game that should feel like something.
import { describe, expect, it } from "vitest";
import { SPARKS, sparksFor, tickValue } from "@/lib/scorePop";

describe("tickValue", () => {
  it("starts where it was and ends where it is going", () => {
    expect(tickValue(3, 5, 0)).toBe(3);
    expect(tickValue(3, 5, 1)).toBe(5);
  });

  it("clamps outside the run rather than overshooting", () => {
    expect(tickValue(3, 5, -1)).toBe(3);
    expect(tickValue(3, 5, 2)).toBe(5);
  });

  it("only ever shows whole points", () => {
    for (let i = 0; i <= 20; i++) {
      const v = tickValue(0, 7, i / 20);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("never goes backwards on the way up", () => {
    let last = -Infinity;
    for (let i = 0; i <= 40; i++) {
      const v = tickValue(2, 9, i / 40);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("eases, so it is more than half way at the half way point", () => {
    // A linear tick reads as a counter; an eased one reads as a
    // number settling.
    expect(tickValue(0, 100, 0.5)).toBeGreaterThan(50);
  });

  it("counts down too, for a correction", () => {
    expect(tickValue(5, 2, 0)).toBe(5);
    expect(tickValue(5, 2, 1)).toBe(2);
  });
});

describe("sparksFor", () => {
  it("makes the asked-for number of sparks", () => {
    expect(sparksFor(1)).toHaveLength(SPARKS);
    expect(sparksFor(1, 3)).toHaveLength(3);
  });

  it("is deterministic, so a re-render does not reshuffle a burst", () => {
    expect(sparksFor(7)).toEqual(sparksFor(7));
  });

  it("gives different bursts different shapes", () => {
    expect(sparksFor(1)).not.toEqual(sparksFor(2));
  });

  it("fans upward and never straight down", () => {
    // A full ring around a number reads as an error badge. These clear
    // the number instead.
    for (const s of sparksFor(3, 12)) {
      expect(Math.abs(s.angle)).toBeLessThan(125);
    }
  });

  it("keeps every spark small, close and brief", () => {
    for (const s of sparksFor(4, 12)) {
      expect(s.distance).toBeGreaterThan(0);
      expect(s.distance).toBeLessThan(40);
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThan(0.25);
      expect(s.size).toBeGreaterThan(0);
      expect(s.size).toBeLessThanOrEqual(5);
    }
  });

  it("survives a single spark without dividing by zero", () => {
    const [only] = sparksFor(5, 1);
    expect(Number.isFinite(only.angle)).toBe(true);
    expect(Number.isFinite(only.distance)).toBe(true);
  });
});
