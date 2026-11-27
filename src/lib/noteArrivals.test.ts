/**
 * Somebody walks in; the room says what is going on.
 *
 * George: "I just started a night, joined the squad room, the host
 * already had the most likely to game opened.. but it doesn't show as
 * ongoing activity on the users who also just joined the night. I guess
 * the event only fires when the host manually joins. But at the start of
 * the call, we need to check what's opened and share that.."
 *
 * The server really does hand a joiner the full presence snapshot, so
 * "what is open" should already be in it. The weakness is that this
 * leaves every arrival at the mercy of everyone else's LAST publish
 * having been correct — and when one is wrong it stays wrong for the
 * whole night. So each client re-announces on an arrival.
 *
 * These are the rules that makes safe: it has to fire for a newcomer,
 * stay quiet otherwise (or the re-announcements answer each other
 * forever), and never mistake this tab for a newcomer.
 */
import { describe, expect, it } from "vitest";
import { noteArrivals } from "@/lib/presencePayload";

const who = (user: string, device = `${user}-tab`, activity: string | null = null) => ({
  user_id: user,
  sender_id: user,
  device_id: device,
  activity_id: activity,
});

const ME = { senderId: "me", deviceId: "me-tab" };

describe("noteArrivals", () => {
  it("treats the first snapshot as everyone arriving at once", () => {
    const seen = new Set<string>();
    expect(noteArrivals([who("host", "host-tab", "most_likely"), who("me")], seen, ME)).toBe(true);
  });

  it("says nothing when the same room comes round again", () => {
    const seen = new Set<string>();
    const room = [who("host", "host-tab", "most_likely"), who("me")];
    noteArrivals(room, seen, ME);
    // This is what stops a storm: my own re-announcement reaches
    // everyone else as a presence update, and if that counted as an
    // arrival they would answer it, and so would I.
    expect(noteArrivals(room, seen, ME)).toBe(false);
    // Including when what somebody has open changes. A presence update
    // is not an arrival.
    expect(noteArrivals([who("host", "host-tab", "imposter"), who("me")], seen, ME)).toBe(false);
  });

  it("fires when a third person walks in", () => {
    const seen = new Set<string>();
    const room = [who("host", "host-tab", "most_likely"), who("me")];
    noteArrivals(room, seen, ME);
    expect(noteArrivals([...room, who("tee")], seen, ME)).toBe(true);
  });

  it("never treats me as my own arrival", () => {
    const seen = new Set<string>();
    expect(noteArrivals([who("me")], seen, ME)).toBe(false);
  });

  it("treats my second tab as somebody to tell", () => {
    const seen = new Set<string>();
    noteArrivals([who("me")], seen, ME);
    // Same account, another connection, holding its own stage.
    expect(noteArrivals([who("me"), who("me", "me-other-tab")], seen, ME)).toBe(true);
  });

  it("tells somebody again after they drop and come back", () => {
    const seen = new Set<string>();
    const full = [who("me"), who("host", "host-tab", "most_likely")];
    noteArrivals(full, seen, ME);
    expect(noteArrivals([who("me")], seen, ME)).toBe(false);
    expect(noteArrivals(full, seen, ME)).toBe(true);
  });

  it("reads a mobile entry that only carries user_id", () => {
    // Mobile publishes the canonical names; web's legacy sender_id is
    // absent there, and a key of "|" for everyone would make the whole
    // room one connection.
    const seen = new Set<string>();
    const a = { user_id: "host", device_id: "host-phone" };
    const b = { user_id: "tee", device_id: "tee-phone" };
    expect(noteArrivals([a], seen, ME)).toBe(true);
    expect(noteArrivals([a, b], seen, ME)).toBe(true);
    expect(noteArrivals([a, b], seen, ME)).toBe(false);
  });

  it("settles even before this tab knows its own id", () => {
    const seen = new Set<string>();
    const room = [who("me"), who("host", "host-tab", "most_likely")];
    expect(noteArrivals(room, seen)).toBe(true);
    expect(noteArrivals(room, seen)).toBe(false);
  });
});
