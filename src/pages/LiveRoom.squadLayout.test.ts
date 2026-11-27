/**
 * The stage knows it is a squad room before it draws anything.
 *
 * George: "Even how it loads up when I refresh the page, it's first a
 * split layout, then it becomes a grid layout with the game at the
 * middle and the people around it.. this isn't bad.. but make it more
 * proper. Loading animations should flow nicely.. instead of glitching
 * and then trying to regularise."
 *
 * `room` comes from the my-rooms query, so `room.room_kind === "squad"`
 * is false for the first frames of every reload. The stage read that as
 * "a two-person room, on a call", drew the split pane — and then undid
 * the entire arrangement when the list landed. The package arrives with
 * the room session, and the file already had a value that says so
 * (`squadRoom`, used by the menu for exactly this reason); the layout
 * simply wasn't using it.
 *
 * Source-level: the page needs a room, a channel and LiveKit to render,
 * and what was wrong is which value a prop was wired to.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/pages/LiveRoom.tsx", "utf8");

describe("the squad layout does not wait on the rooms list", () => {
  it("passes the value that is known on the first frame", () => {
    expect(src).toContain("squad={squadRoom}");
    expect(src).not.toContain("squad={isSquad}");
  });

  it("and that value does not depend on the query", () => {
    expect(src).toContain('const squadRoom = isSquad || roomPackage === "squad"');
  });

  it("including the names in the top bar, which sit in the same layout", () => {
    // Left on `isSquad`, the bar would arrive a beat after the layout it
    // sits in — the same flicker, one element smaller.
    const at = src.indexOf("const squadNames = useMemo(");
    expect(at).toBeGreaterThan(0);
    const body = src.slice(at, at + 600);
    expect(body).toContain("squadRoom");
    expect(body).not.toMatch(/\bisSquad\b/);
  });
});
