// A reload must not make a tab a stranger to itself.
//
// George: "I refreshed, and now I can't rejoin the room on any of the
// users." And, on the same cause from the other side: "I start a call,
// it doesn't work.. cos others can't join. Keeps saying waiting."
//
// The marker was minted per page LOAD while the doc comment claimed
// per tab. A reload opens the new socket before the old one closes, so
// the server's snapshot briefly holds both connections for the
// account; the reloaded tab saw its own ghost under a different id,
// decided the call was on another device, and took RoomVideo's "move
// it here?" branch — which returns before the LiveKit token is ever
// requested. The backend log showed it plainly: three users on the
// room channel, one token request between them.
import { beforeEach, describe, expect, it } from "vitest";
import type { PresenceState } from "@/lib/realtime/roomChannel";
import { TAB_DEVICE_ID, iAmOnTheCall, otherDeviceOnCall, tabDeviceId } from "@/lib/deviceId";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe("the tab's own marker", () => {
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
  });

  it("is the same id after a reload of the same tab", () => {
    // The whole bug in one line: these used to differ.
    const first = tabDeviceId(store);
    const afterReload = tabDeviceId(store);
    expect(afterReload).toBe(first);
  });

  it("but a second tab is its own device", () => {
    // sessionStorage is per tab, so this is what a new tab sees. Two
    // tabs ARE two places the call could be and must stay tellable
    // apart, or "move the call here?" could never be asked at all.
    const tabA = tabDeviceId(store);
    const tabB = tabDeviceId(new MemoryStorage());
    expect(tabB).not.toBe(tabA);
  });

  it("still returns an id when storage throws", () => {
    // Private mode, or blocked site data. Degrades to the old
    // per-load behaviour rather than to undefined.
    const hostile = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(tabDeviceId(hostile)).toMatch(/\S/);
  });
});

// The original suite, kept whole: these are the rules the fix must not
// have changed.
describe("otherDeviceOnCall", () => {
  const me = "user-1";
  it("spots the same account on the call from another device", () => {
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: true, device_id: "other-tab" }], me, "this-tab")).toBe(true);
  });
  it("ignores this device, other people, and my devices that aren't on the call", () => {
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: true, device_id: "this-tab" }], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([{ user_id: "user-2", is_in_call: true, device_id: "x" }], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: false, device_id: "x" }], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: true }], "", "this-tab")).toBe(false);
  });
  it("counts an older app without a device marker as another device", () => {
    expect(otherDeviceOnCall([{ sender_id: me, is_in_call: true }], me, "this-tab")).toBe(true);
  });
  it("gives each tab its own marker", () => {
    expect(TAB_DEVICE_ID).toMatch(/.{8,}/);
  });
});

describe("and what it protects", () => {
  const entry = (over: Partial<PresenceState>): PresenceState =>
    ({ user_id: "me", is_in_call: true, device_id: "other-tab", ...over }) as PresenceState;

  it("my own ghost is not another device, once the id survives a reload", () => {
    // The refresh case: the pre-reload connection is still in the
    // snapshot, carrying the id THIS tab still has.
    const mine = tabDeviceId(new MemoryStorage());
    expect(otherDeviceOnCall([entry({ device_id: mine })], "me", mine)).toBe(false);
  });

  it("a genuinely different device still is one", () => {
    expect(otherDeviceOnCall([entry({})], "me", "this-tab")).toBe(true);
  });

  it("and somebody else on the call is not my other device", () => {
    expect(otherDeviceOnCall([entry({ user_id: "jun" })], "me", "this-tab")).toBe(false);
  });

  it("nor is my other tab that is in the room but not on the call", () => {
    expect(otherDeviceOnCall([entry({ is_in_call: false })], "me", "this-tab")).toBe(false);
  });
});

// A vote you cannot reach is not a vote.
//
// George: "It says 'Tap a seat to vote. Only you see your pick.' on
// the web.. but I see no options."
//
// On a squad night the card hands voting to the faces on the call —
// tap the friend who fits. It did that whenever the call was OPEN in
// the room, which is a different fact from this viewer being ON it. A
// browser in the room but not on the call got the instruction with an
// empty stage under it, and picks made on the phones could not move a
// round the laptop was not in.
describe("whether I can tap a face", () => {
  const me = "user-1";
  const p = (over: Partial<PresenceState>): PresenceState =>
    ({ user_id: me, is_in_call: true, device_id: "d1", ...over }) as PresenceState;

  it("yes, when my own presence says I am on the call", () => {
    expect(iAmOnTheCall([p({})], me)).toBe(true);
  });

  it("no, when I am in the room but have not joined the call", () => {
    // Exactly George's case: the hint said tap a face, nothing to tap.
    expect(iAmOnTheCall([p({ is_in_call: false })], me)).toBe(false);
  });

  it("no, when it is only OTHER people who are on the call", () => {
    // The call being busy is not the same as me being in it — this is
    // the distinction the bug collapsed.
    expect(iAmOnTheCall([p({ user_id: "jun" }), p({ user_id: "ada" })], me)).toBe(false);
  });

  it("counts my other tab, since the faces are on screen there too", () => {
    expect(iAmOnTheCall([p({ device_id: "another-tab" })], me)).toBe(true);
  });

  it("reads the web-legacy sender_id as well as user_id", () => {
    expect(iAmOnTheCall([{ sender_id: me, is_in_call: true } as PresenceState], me)).toBe(true);
  });

  it("and says no rather than guessing when there is no me", () => {
    expect(iAmOnTheCall([p({})], "")).toBe(false);
    expect(iAmOnTheCall([], me)).toBe(false);
  });
});
