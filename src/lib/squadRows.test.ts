// Portrait in, portrait out — on web too.
//
// George: "the layout on web for calls keeps driving me nuts. I've
// told you if the feed is coming from a mobile (portrait) then show
// portrait on the web. Forcing landscape crops part of the call which
// is bad UX. See how we are optimizing the layout on the mobile.. You
// need to do same on the web."
//
// Web picked ONE column count from the median feed shape, so every
// cell came out the same shape. A median cannot represent two
// different answers: put a phone and a laptop in a call and whichever
// loses the vote is cropped or letterboxed. Mobile gives each ROW its
// own height instead. This is that planner, and these are the
// properties that make it worth having.
import { describe, expect, it } from "vitest";
import { coverCrop, videoFit, MAX_CROP } from "@/lib/videoFit";
import {
  compositions,
  MAX_PER_ROW,
  scorePlan,
  shownFraction,
  squadRowPlan,
  squadRowShares,
  squadRows,
} from "@/lib/squadRows";

const PHONE = 9 / 16;
const LAPTOP = 16 / 9;
const LANDSCAPE_STAGE = 16 / 9;

/** What each tile actually gets, following the plan the way the DOM will. */
function cellsFor(aspects: (number | null)[], stage: number) {
  const rows = squadRowPlan(aspects, stage);
  const shares = squadRowShares(rows, aspects);
  const out: { feed: number | null; cell: number; fit: string }[] = [];
  let next = 0;
  rows.forEach((cells, r) => {
    for (let c = 0; c < cells; c++) {
      const feed = aspects[next++];
      const cell = stage / cells / shares[r];
      out.push({ feed, cell, fit: feed ? videoFit(feed, cell) : "cover" });
    }
  });
  return out;
}

describe("a phone and a laptop in the same call", () => {
  it("never crops the portrait feed to landscape", () => {
    // George's actual complaint: "Forcing landscape crops part of the
    // call." `contain` shows the whole phone frame; `cover` is only
    // chosen when the trim is under the threshold. Either way nothing
    // of the person is thrown away.
    for (const c of cellsFor([PHONE, LAPTOP], LANDSCAPE_STAGE)) {
      if (c.fit === "cover") {
        expect(coverCrop(c.feed as number, c.cell)).toBeLessThanOrEqual(MAX_CROP);
      }
    }
  });

  it("picks the arrangement that shows the most, not a fixed table", () => {
    // The search must actually find the best composition — this is
    // what a median column count could not do.
    const aspects = [PHONE, LAPTOP];
    const chosen = squadRowPlan(aspects, LANDSCAPE_STAGE);
    const best = Math.max(
      ...compositions(aspects.length, MAX_PER_ROW).map((r) =>
        scorePlan(r, aspects, LANDSCAPE_STAGE),
      ),
    );
    expect(scorePlan(chosen, aspects, LANDSCAPE_STAGE)).toBeCloseTo(best, 9);
  });

  it("and it follows the STAGE, which is the whole point", () => {
    // Wide stage: side by side, because stacking would make each cell
    // wider still and letterbox the phone harder. Narrow stage: stack,
    // so the phone's row can be tall. One rule, two answers — a fixed
    // table gives the same answer to both.
    expect(squadRowPlan([PHONE, LAPTOP], LANDSCAPE_STAGE)).toEqual([2]);
    expect(squadRowPlan([PHONE, LAPTOP], 0.5)).toEqual([1, 1]);
  });

  it("gives the portrait feed the taller row once they are stacked", () => {
    // "If the feed is coming from a mobile (portrait) then show
    // portrait on the web."
    const shares = squadRowShares([1, 1], [PHONE, LAPTOP]);
    expect(shares[0]).toBeGreaterThan(shares[1]);
  });

  it("which a single shared cell shape could not do, by construction", () => {
    const square = 1.0;
    expect(coverCrop(PHONE, square)).toBeGreaterThan(MAX_CROP);
    expect(coverCrop(LAPTOP, square)).toBeGreaterThan(MAX_CROP);
  });
});

describe("the arrangement itself", () => {
  it("never reorders anybody, only moves the row boundaries", () => {
    for (const rows of compositions(4, MAX_PER_ROW)) {
      expect(rows.reduce((a, b) => a + b, 0)).toBe(4);
      expect(rows.every((k) => k >= 1 && k <= MAX_PER_ROW)).toBe(true);
    }
  });

  it("falls back to the table while no feed has reported a shape", () => {
    // Guessing here would make the call jump when the first frame
    // lands.
    expect(squadRowPlan([null, null, null], LANDSCAPE_STAGE)).toEqual(squadRows(3));
    expect(squadRowPlan([null, null], LANDSCAPE_STAGE)).toEqual([1, 1]);
  });

  it("and when the stage has not been measured yet", () => {
    expect(squadRowPlan([PHONE, LAPTOP], 0)).toEqual(squadRows(2));
    expect(squadRowPlan([PHONE, LAPTOP], Number.NaN)).toEqual(squadRows(2));
  });

  it("puts one person on one row", () => {
    expect(squadRowPlan([PHONE], LANDSCAPE_STAGE)).toEqual([1]);
    expect(squadRowPlan([], LANDSCAPE_STAGE)).toEqual([0]);
  });

  it("keeps four phones out of one squashed row", () => {
    const rows = squadRowPlan([PHONE, PHONE, PHONE, PHONE], LANDSCAPE_STAGE);
    expect(rows.reduce((a, b) => a + b, 0)).toBe(4);
    expect(Math.max(...rows)).toBeLessThanOrEqual(MAX_PER_ROW);
  });
});

describe("row heights", () => {
  it("sum to the whole stage", () => {
    for (const aspects of [[PHONE, LAPTOP], [PHONE, PHONE, LAPTOP], [LAPTOP]]) {
      const rows = squadRowPlan(aspects, LANDSCAPE_STAGE);
      const total = squadRowShares(rows, aspects).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("are equal when the feeds are", () => {
    const shares = squadRowShares([1, 1], [LAPTOP, LAPTOP]);
    expect(shares[0]).toBeCloseTo(shares[1], 10);
  });

  it("are damped, not literal — the laptop is not starved", () => {
    // Undamped, the phone would claim ~76%. The damping lands it near
    // 72/28, enough to show a person without the laptop paying for it.
    const shares = squadRowShares([1, 1], [PHONE, LAPTOP]);
    expect(shares[0]).toBeGreaterThan(0.6);
    expect(shares[0]).toBeLessThan(0.8);
  });

  it("treat an unreported feed as square rather than guessing", () => {
    expect(squadRowShares([1, 1], [null, null])).toEqual([0.5, 0.5]);
  });
});

describe("shownFraction", () => {
  it("is 1 whenever the tile fills", () => {
    expect(shownFraction(LAPTOP, LAPTOP)).toBe(1);
    expect(shownFraction(null, 1)).toBe(1);
  });

  it("and the overlap once it has to letterbox", () => {
    // A phone in a wide cell shows the ratio of the two shapes.
    expect(shownFraction(PHONE, LANDSCAPE_STAGE)).toBeCloseTo(PHONE / LANDSCAPE_STAGE, 10);
  });
});
