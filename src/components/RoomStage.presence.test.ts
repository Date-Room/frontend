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
    // `openHere` IS the staged id with the lobby mapped to null, so
    // this still fires on every stage change — and the same value now
    // also tells the notice what I have open.
    expect(deps).toMatch(/\}, \[openHere, setPresence\]\)/);
  });

  it("merges rather than restating every field", () => {
    // Three callers each spelled out the whole object from memory,
    // which is how is_in_call and is_typing came to be asserted by
    // code with no idea whether either was true.
    expect(ctx).toContain("mergePresence(published.current, patch)");
    expect(ctx).toMatch(/setPresence: patchPresence/);
  });

  it("seeds what it merges onto, and sends exactly that", () => {
    // The merge is only safe if `published` already holds the whole
    // object. It did not: the initial track wrote its payload straight
    // to the channel, so the first patch replaced this tab's entire
    // presence record with `{ activity_id, last_seen }` — no user_id,
    // no name, no photo. On a wire that REPLACES rather than merges,
    // that is a person disappearing at the moment they opened
    // something. The shape of the payload is covered in
    // `presencePayload.test.ts`; this is the wiring.
    //
    // The base is now merged UNDER whatever has already been patched,
    // not assigned over it. `open()` is async and the stage restores
    // its activity from localStorage on mount, so a patch regularly
    // arrives first; assigning the base then republished
    // activity_id: null and the room never learned otherwise. See
    // presencePayload.test.ts, "seeding presence when the channel
    // finally opens".
    expect(ctx).toMatch(
      /published\.current = mergePresence\(\s*basePresence\(identity, TAB_DEVICE_ID\),\s*published\.current,?\s*\)/,
    );
    expect(ctx).toContain("channel.track(published.current)");
    // And nothing may be tracked EXCEPT that object, or it is the same
    // bug again through a different door. Counting the call sites was
    // the old way of saying this, and it just meant a third publisher
    // broke the test for being a third rather than for being wrong.
    const tracks = [...ctx.matchAll(/channel\.track\(([^)]*)\)/g)];
    expect(tracks.length).toBeGreaterThan(1);
    for (const [, arg] of tracks) expect(arg).toBe("published.current");
  });

  it("says again what it has open when somebody new walks in", () => {
    // The joiner is handed the whole presence snapshot, so in principle
    // it is already there — but that leaves every arrival at the mercy
    // of everyone else's last publish having been right, and one that
    // went wrong stays wrong all night. Re-announcing makes the room
    // repair itself. The rule is covered in `noteArrivals.test.ts`;
    // this is the wiring.
    expect(ctx).toContain("noteArrivals(p, seen.current");
    const at = ctx.indexOf("noteArrivals(p, seen.current");
    expect(ctx.slice(at, at + 400)).toContain("channel.track(published.current)");
    // Read through a ref: the presence callback outlives the render
    // that made it, and the effect is keyed on roomId alone, so a
    // closure over `identity` would be the first render's forever.
    expect(ctx).toContain("identityRef.current.senderId");
  });

  it("starts out in the room, not in something", () => {
    const payload = readFileSync("src/lib/presencePayload.ts", "utf8");
    expect(payload).toMatch(/activity_id: null/);
  });
});
