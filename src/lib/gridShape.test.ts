import { describe, expect, it } from "vitest";
import { cellWaste, dominantAspect, gridColumnsForShape } from "./gridShape";

const PHONE = 9 / 16;
const LAPTOP = 16 / 9;
const WIDE_SCREEN = 16 / 9;

describe("gridColumnsForShape", () => {
  it("gives a lone feed the whole box", () => {
    expect(gridColumnsForShape(1, WIDE_SCREEN, PHONE)).toBe(1);
  });

  it("stands phones side by side on a wide screen", () => {
    // Four portrait feeds in a 16:9 window: 2x2 makes wide cells holding
    // tall video — bars down both sides of every face. One row of four
    // gives each cell 4:9*... a far closer match.
    const cols = gridColumnsForShape(4, WIDE_SCREEN, PHONE);
    expect(cols).toBe(4);
  });

  it("keeps laptops in a square-ish grid", () => {
    // Four landscape feeds: 2x2 cells are 16:9 each, which is exactly
    // the feed — nothing to improve on.
    expect(gridColumnsForShape(4, WIDE_SCREEN, LAPTOP)).toBe(2);
  });

  it("never leaves a cell emptier than the fixed layout would", () => {
    // The property that matters: for every count and both feed shapes,
    // the chosen arrangement wastes no more than a hardcoded 2-up.
    for (let n = 2; n <= 6; n++) {
      for (const feed of [PHONE, LAPTOP, 1, 4 / 3]) {
        const chosen = gridColumnsForShape(n, WIDE_SCREEN, feed);
        const chosenWaste = cellWaste((WIDE_SCREEN * Math.ceil(n / chosen)) / chosen, feed);
        const fixedWaste = cellWaste((WIDE_SCREEN * Math.ceil(n / 2)) / 2, feed);
        expect(chosenWaste).toBeLessThanOrEqual(fixedWaste + 1e-9);
      }
    }
  });

  it("falls back sanely when nothing is measured yet", () => {
    expect(gridColumnsForShape(4, NaN, PHONE)).toBe(2);
    expect(gridColumnsForShape(4, WIDE_SCREEN, 0)).toBe(2);
  });

  it("adapts to a tall window too", () => {
    // A narrow portrait browser window with landscape feeds wants them
    // stacked, not side by side.
    expect(gridColumnsForShape(2, 9 / 16, LAPTOP)).toBe(1);
  });
});

describe("dominantAspect", () => {
  it("takes the median so one laptop does not swing the room", () => {
    expect(dominantAspect([PHONE, PHONE, PHONE, LAPTOP])).toBeCloseTo(PHONE, 3);
  });

  it("is null until something has been measured", () => {
    expect(dominantAspect([])).toBeNull();
    expect(dominantAspect([0, NaN])).toBeNull();
  });
});
