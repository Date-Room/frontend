/**
 * Web has to say what it has open, or mobile's "who is doing what" is
 * wrong whenever somebody is on a laptop.
 *
 * Mobile lists what is going on in a room by reading `activity_id` off
 * presence. Web published every other presence field and not that one,
 * so a person in the middle of a game on a laptop appeared to the
 * phones as idle in the room — and the list that exists to say "two of
 * them are in a game, go and join" quietly said nothing.
 *
 * Source-level: RoomStage needs a live room and a realtime channel to
 * render, and what matters here is the contract between the two
 * clients, not the pixels.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stage = readFileSync("src/components/RoomStage.tsx", "utf8");
const ctx = readFileSync("src/context/RoomSessionContext.tsx", "utf8");

describe("presence carries what this tab has open", () => {
  it("publishes the staged activity, and the lobby as nothing", () => {
    expect(stage).toMatch(/setPresence\(\{\s*activity_id:/);
    // The lobby is being in the room itself, not an activity to join.
    expect(stage).toMatch(/staged !== "lobby" \? staged : null/);
  });

  it("re-publishes whenever the stage changes", () => {
    const at = stage.indexOf("setPresence({ activity_id:");
    expect(at).toBeGreaterThan(0);
    const deps = stage.slice(at, at + 260);
    expect(deps).toMatch(/\}, \[staged, setPresence\]\)/);
  });

  it("merges rather than restating every field", () => {
    // Three callers each spelled out the whole object from memory,
    // which is how is_in_call and is_typing came to be asserted by
    // code with no idea whether either was true.
    expect(ctx).toContain("published.current = { ...published.current, ...patch");
    expect(ctx).toMatch(/setPresence: patchPresence/);
  });

  it("starts out in the room, not in something", () => {
    expect(ctx).toMatch(/activity_id: null/);
  });
});
