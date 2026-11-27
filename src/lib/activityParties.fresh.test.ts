// A notice is for an activity that has just STARTED.
//
// George: "Stop reshowing me that someone started a game. You can keep
// updating the list in ongoing activity.. but notification should only
// be when they just start the activity fresh.. not if they simply leave
// and join back."
//
// The announced set used to be keyed on what was joinable *for me*, so
// it was cleared the moment an activity stopped being joinable — which
// happens when the last other player steps out for a second, when I
// join, and when I leave again. Each of those re-armed the notice for a
// game that had been running the whole time.
import { describe, expect, it } from "vitest";
import { activeActivityIds, amIn, partiesFrom } from "@/lib/activityParties";
import type { PresenceState } from "@/lib/realtime/roomChannel";

const who = (id: string, activity: string | null): PresenceState =>
  ({
    user_id: id,
    display_name: id,
    activity_id: activity,
    last_seen: "2026-11-24T00:00:00.000Z",
  }) as unknown as PresenceState;

describe("activeActivityIds", () => {
  it("counts an activity that only I have open", () => {
    // partiesFrom drops a party that is only me, which is right for a
    // list of things to JOIN and wrong for "is this running".
    expect([...activeActivityIds([who("me", "imposter")])]).toEqual(["imposter"]);
    expect(partiesFrom([who("me", "imposter")], "me")).toEqual([]);
  });

  it("counts each activity once, however many are in it", () => {
    const ids = activeActivityIds([
      who("me", "imposter"),
      who("jun", "imposter"),
      who("tee", "watch"),
    ]);
    expect([...ids].sort()).toEqual(["imposter", "watch"]);
  });

  it("ignores anyone in the room itself", () => {
    expect(activeActivityIds([who("jun", null), who("tee", "")]).size).toBe(0);
  });
});

/** The announce rule, as the effect in RoomStage applies it. */
function announce(
  presence: PresenceState[],
  me: string,
  seen: Set<string>,
  openHere: string | null = null,
): string | null {
  const running = activeActivityIds(presence);
  for (const id of [...seen]) if (!running.has(id)) seen.delete(id);
  const joinable = partiesFrom(presence, me).filter(
    (p) => !amIn(presence, p.activityId, me, openHere),
  );
  const fresh = joinable.find((p) => !seen.has(p.activityId));
  if (!fresh) return null;
  seen.add(fresh.activityId);
  return fresh.activityId;
}

describe("the announce rule", () => {
  it("announces a game somebody starts", () => {
    const seen = new Set<string>();
    expect(announce([who("me", null), who("jun", "imposter")], "me", seen)).toBe("imposter");
  });

  it("does not announce it twice", () => {
    const seen = new Set<string>();
    const presence = [who("me", null), who("jun", "imposter")];
    expect(announce(presence, "me", seen)).toBe("imposter");
    expect(announce(presence, "me", seen)).toBeNull();
  });

  it("stays quiet when somebody leaves and comes back", () => {
    // THE regression. Jun and Tee are playing; Jun steps out and
    // rejoins. The game never stopped, so there is nothing to announce.
    const seen = new Set<string>();
    expect(announce([who("me", null), who("jun", "imposter"), who("tee", "imposter")], "me", seen))
      .toBe("imposter");
    expect(announce([who("me", null), who("jun", null), who("tee", "imposter")], "me", seen))
      .toBeNull();
    expect(announce([who("me", null), who("jun", "imposter"), who("tee", "imposter")], "me", seen))
      .toBeNull();
  });

  it("stays quiet when I join and leave again", () => {
    // Joining makes a party un-joinable and leaving makes it joinable
    // again, which is exactly the flip that used to re-announce.
    const seen = new Set<string>();
    expect(announce([who("me", null), who("jun", "imposter")], "me", seen)).toBe("imposter");
    expect(announce([who("me", "imposter"), who("jun", "imposter")], "me", seen)).toBeNull();
    expect(announce([who("me", null), who("jun", "imposter")], "me", seen)).toBeNull();
  });

  it("announces again only once the activity has genuinely emptied", () => {
    // Not a leak: a game that ends and is started again later is news.
    const seen = new Set<string>();
    expect(announce([who("me", null), who("jun", "imposter")], "me", seen)).toBe("imposter");
    expect(announce([who("me", null), who("jun", null)], "me", seen)).toBeNull();
    expect(announce([who("me", null), who("jun", "imposter")], "me", seen)).toBe("imposter");
  });

  it("never announces something I am already in", () => {
    const seen = new Set<string>();
    expect(announce([who("me", "imposter"), who("jun", "imposter")], "me", seen)).toBeNull();
  });

  it("never announces what I just opened, before my echo returns", () => {
    // The race: I open Imposter, and Jun's presence lands before my
    // own publish has come back. Presence still says I am nowhere.
    const seen = new Set<string>();
    const stale = [who("me", null), who("jun", "imposter")];
    expect(announce(stale, "me", seen, "imposter")).toBeNull();
  });

  it("still announces a different activity while I am in one", () => {
    const seen = new Set<string>();
    expect(announce([who("me", "imposter"), who("jun", "watch")], "me", seen, "imposter"))
      .toBe("watch");
  });
});
