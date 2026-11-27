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
