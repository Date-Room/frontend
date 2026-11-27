/**
 * The call grid is for people, and it follows their feeds.
 *
 * Two things made the squad call look like a fixed board no matter who
 * was on it. The column count came from `gridColumnsFor`, measured
 * against a hardcoded 16:9 ideal rather than the shape of the video
 * actually arriving; and the cell count was `order.length + freeSeats`,
 * so a five-seat night with three people on it drew five cells — two
 * dashed empty chairs, and three real faces squeezed to fit beside
 * them. The feed-aware grid existed and was wired only to the game
 * layout, so every fix to it changed nothing for anyone in a plain
 * call.
 *
 * Source-level because the component needs a live LiveKit room to
 * render, and what broke is structural: which helper feeds the grid,
 * and what goes in it.
 *
 * The MECHANISM has since changed and this file follows it. A single
 * column count is a single cell shape, and one shape cannot suit a
 * phone and a laptop at the same time — George: "if the feed is coming
 * from a mobile (portrait) then show portrait on the web. Forcing
 * landscape crops part of the call." So the stage is now split into
 * rows whose heights follow the feeds in them (`useSquadRowPlan`,
 * ported from mobile). The intent these tests guard is unchanged: the
 * arrangement comes from the feeds that are actually on the call, and
 * nobody gets a cell for a seat they are not sitting in.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/squad/GroupStage.tsx", "utf8");

/** The plain call grid: the stage container near the end of the file. */
function callGridBlock(): string {
  const at = src.lastIndexOf("className=\"flex min-h-0 flex-1 flex-col gap-2 p-2");
  expect(at).toBeGreaterThan(0);
  return src.slice(at - 400, at + 900);
}

describe("the squad call grid", () => {
  it("is arranged from the feeds, not from a fixed ideal", () => {
    const block = callGridBlock();
    expect(block).toContain("callPlan.ref");
    expect(block).toContain("callPlan.rows");
    expect(src).not.toContain("gridColumnsFor(");
  });

  it("measures the feeds that are actually on the call", () => {
    expect(src).toMatch(/useSquadRowPlan\(\s*order\.map[\s\S]{0,200}?publication\?\.dimensions/);
  });

  it("and each row is as tall as its own feeds ask", () => {
    // The whole point of rows over columns: a portrait row can be
    // tall while a landscape row is short. Without the share driving
    // flexGrow this is just a stack of equal bands.
    const block = callGridBlock();
    expect(block).toContain("callPlan.shares[r]");
    expect(block).toContain("flexGrow");
    expect(block).toContain("flexBasis: 0");
  });

  it("keeps everyone in the order they were in", () => {
    // Row boundaries move; people do not. A tile that jumped across
    // the stage to suit the arithmetic would be worse than bars.
    const block = callGridBlock();
    expect(block).toContain("order.slice(from, from + cells)");
  });

  it("gives no cell to a seat nobody is sitting in", () => {
    expect(src).not.toContain("freeSeats");
    expect(src).not.toContain("A free seat");
    expect(src).not.toContain("Armchair");
  });
});
