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
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/squad/GroupStage.tsx", "utf8");

/** The plain call grid: the last `grid` container in the file. */
function callGridBlock(): string {
  const at = src.lastIndexOf("className=\"grid min-h-0 flex-1 gap-2 p-2");
  expect(at).toBeGreaterThan(0);
  return src.slice(at - 400, at + 700);
}

describe("the squad call grid", () => {
  it("is arranged from the feeds, not from a fixed ideal", () => {
    const block = callGridBlock();
    expect(block).toContain("callGrid.ref");
    expect(block).toContain("callGrid.columns");
    expect(src).not.toContain("gridColumnsFor(");
  });

  it("measures the feeds that are actually on the call", () => {
    expect(src).toMatch(/useGridColumns\(\s*order\.length,[\s\S]{0,200}?publication\?\.dimensions/);
  });

  it("gives no cell to a seat nobody is sitting in", () => {
    expect(src).not.toContain("freeSeats");
    expect(src).not.toContain("A free seat");
    expect(src).not.toContain("Armchair");
  });
});
