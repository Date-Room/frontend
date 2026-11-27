// Presence is published as one whole object, because the server
// REPLACES the snapshot for a connection rather than merging into it
// (`channel.update_presence`: `self._presence_snapshot[sub_id] = state`).
//
// `published.current` used to start as `{}` while the initial track
// wrote its payload straight to the channel, so the first patch
// replaced the tab's entire presence record with `{ activity_id,
// last_seen }`. The only caller of the patch is "I opened an activity",
// so a web user stopped being a identifiable person at the exact
// moment they became interesting to everyone else.
import { describe, expect, it } from "vitest";
import {
  IDENTIFYING_KEYS,
  basePresence,
  mergePresence,
} from "@/lib/presencePayload";

const identity = {
  senderId: "u1",
  slot: "a",
  isHost: true,
  displayName: "Jun",
  photoUrl: "data:image/jpeg;base64,abc",
  participantId: "p1",
};

describe("basePresence", () => {
  it("says who this is, in both schemas", () => {
    const base = basePresence(identity, "dev1", "2026-11-24T00:00:00.000Z");
    // Canonical (what mobile reads)…
    expect(base.user_id).toBe("u1");
    expect(base.display_name).toBe("Jun");
    expect(base.photo_url).toBe("data:image/jpeg;base64,abc");
    // …and web-legacy, for the code that still reads these.
    expect(base.sender_id).toBe("u1");
    expect(base.name).toBe("Jun");
  });

  it("carries the flags and handles the rest of the app depends on", () => {
    const base = basePresence(identity, "dev1");
    expect(base.is_host).toBe(true);
    expect(base.is_ready).toBe(true);
    expect(base.is_in_call).toBe(false);
    expect(base.is_typing).toBe(false);
    expect(base.device_id).toBe("dev1");
    // The host's handle to kick a guest by.
    expect(base.participant_id).toBe("p1");
  });

  it("opens in the room itself, not in an activity", () => {
    expect(basePresence(identity, "dev1").activity_id).toBeNull();
  });

  it("writes an absent photo as null rather than leaving it out", () => {
    // Omission and null are different on a replacing wire: a missing
    // key is still a missing key to every reader.
    const base = basePresence({ ...identity, photoUrl: undefined }, "dev1");
    expect("photo_url" in base).toBe(true);
    expect(base.photo_url).toBeNull();
  });
});

describe("mergePresence", () => {
  it("keeps the person while changing the moment", () => {
    // THE regression. A patch of one field must not take the identity
    // with it.
    const base = basePresence(identity, "dev1");
    const next = mergePresence(base, { activity_id: "imposter" });
    expect(next.activity_id).toBe("imposter");
    for (const key of IDENTIFYING_KEYS) {
      expect(next[key], `${key} was lost by the patch`).toEqual(base[key]);
    }
  });

  it("keeps every other field too, not just the identifying ones", () => {
    const base = basePresence(identity, "dev1");
    const next = mergePresence(base, { activity_id: "watch" });
    for (const key of Object.keys(base)) {
      if (key === "activity_id" || key === "last_seen") continue;
      expect(next[key], `${key} was lost`).toEqual(base[key]);
    }
  });

  it("survives repeated patches without eroding", () => {
    const base = basePresence(identity, "dev1");
    let state = base;
    state = mergePresence(state, { activity_id: "watch" });
    state = mergePresence(state, { is_in_call: true });
    state = mergePresence(state, { activity_id: null });
    state = mergePresence(state, { is_typing: true });
    expect(state.user_id).toBe("u1");
    expect(state.display_name).toBe("Jun");
    expect(state.photo_url).toBe(base.photo_url);
    expect(state.participant_id).toBe("p1");
    expect(state.is_in_call).toBe(true);
    expect(state.activity_id).toBeNull();
    expect(state.is_typing).toBe(true);
  });

  it("can clear a field with an explicit null", () => {
    // Leaving an activity has to be publishable. On a replacing wire,
    // dropping the key would read as "still in there".
    const next = mergePresence({ activity_id: "watch" }, { activity_id: null });
    expect("activity_id" in next).toBe(true);
    expect(next.activity_id).toBeNull();
  });

  it("moves last_seen on every update, patch or not", () => {
    const next = mergePresence(
      { last_seen: "2020-01-01T00:00:00.000Z" },
      {},
      "2026-11-24T00:00:00.000Z",
    );
    expect(next.last_seen).toBe("2026-11-24T00:00:00.000Z");
  });

  it("merging onto nothing is still visibly incomplete", () => {
    // Not a behaviour we want — a guard rail. If a future caller
    // patches before the base is seeded, this is what the room sees,
    // and the test says so out loud rather than letting it look fine.
    const next = mergePresence({}, { activity_id: "watch" });
    expect(next.user_id).toBeUndefined();
    expect(next.display_name).toBeUndefined();
  });
});

// The base goes underneath, never over.
//
// George: "I joined the squad room later than the web on mobile with
// my 2 phones.. They aren't even aware of the ongoing Most likely
// game... I shouldn't have to always refresh, rejoin, join at the same
// time to re-establish sync."
//
// `channel.open()` is async, and the stage restores what it had open
// from localStorage the moment it mounts — so "I am in Most Likely To"
// routinely reached `published` BEFORE the base record was assigned.
// Assigning the base outright threw it away and published
// activity_id: null.
//
// Nothing put it back. The patch only fires when the staged activity
// CHANGES, and it had not changed — it was restored. So the tab spent
// the night telling the room it was in nothing, every phone that
// walked in was handed that in its presence snapshot, and even
// re-announcing on arrival re-sent the same wiped record.
describe("seeding presence when the channel finally opens", () => {
  const identity = {
    senderId: "u-1",
    slot: "a",
    isHost: true,
    displayName: "George",
    photoUrl: null,
    participantId: null,
  };

  it("keeps an activity that was staged before the socket was ready", () => {
    // The exact race: a patch lands, then open() resolves.
    const early = mergePresence({}, { activity_id: "most_likely" });
    const seeded = mergePresence(basePresence(identity, "dev-1"), early);
    expect(seeded.activity_id).toBe("most_likely");
  });

  it("and still fills in everything the patch could not know", () => {
    // The early patch is {activity_id, last_seen} and nothing else —
    // the base has to supply the person.
    const early = mergePresence({}, { activity_id: "most_likely" });
    const seeded = mergePresence(basePresence(identity, "dev-1"), early);
    for (const key of IDENTIFYING_KEYS) {
      expect(seeded[key], `${key} missing — nobody can tell who this is`).toBeDefined();
    }
    expect(seeded.device_id).toBe("dev-1");
    expect(seeded.is_host).toBe(true);
  });

  it("is unchanged for the ordinary case, where nothing was staged first", () => {
    const seeded = mergePresence(basePresence(identity, "dev-1"), {});
    expect(seeded.activity_id).toBeNull();
    expect(seeded.display_name).toBe("George");
  });

  it("the other order is the bug, and loses the game", () => {
    // Kept as the counter-example: this is what the code used to do.
    const early = mergePresence({}, { activity_id: "most_likely" });
    const wrong = mergePresence(early, basePresence(identity, "dev-1"));
    expect(wrong.activity_id).toBeNull();
  });
});
