// A refresh is not an arrival.
//
// George: "When I refresh the room page on web, it auto-starts a call.
// It should only resume a call if I was in one already. I specifically.
// Same as mobile. If I quit the app and rejoin, it should rejoin my
// previous activity. If I was in a call, relaunch it, so I can
// continue. If I was playing a game, relaunch that too."
//
// Session rooms auto-start the call on entry, which is right the first
// time. The rule ran on every page LOAD, and a load cannot tell a
// first entry from a refresh — so leaving the call and reloading put
// you straight back on it, camera and all.
import { beforeEach, describe, expect, it } from "vitest";
import {
  MEMORY_GOOD_FOR_MS,
  rememberCall,
  shouldAutoStartCall,
  wasOnCall,
} from "@/lib/callMemory";

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

describe("what a room remembers about me", () => {
  let s: MemoryStorage;
  beforeEach(() => {
    s = new MemoryStorage();
  });

  it("knows nothing about a room I have never opened", () => {
    // null, NOT false. "Never been here" and "deliberately not on the
    // call" are different answers and only one of them should stop a
    // date room starting itself.
    expect(wasOnCall("room-1", s)).toBeNull();
  });

  it("remembers being on the call, and leaving it", () => {
    rememberCall("room-1", true, s);
    expect(wasOnCall("room-1", s)).toBe(true);
    rememberCall("room-1", false, s);
    expect(wasOnCall("room-1", s)).toBe(false);
  });

  it("keeps rooms apart", () => {
    rememberCall("room-1", true, s);
    expect(wasOnCall("room-2", s)).toBeNull();
  });

  it("survives junk in storage rather than throwing", () => {
    s.setItem("dr:oncall:v1", "{not json");
    expect(wasOnCall("room-1", s)).toBeNull();
    rememberCall("room-1", true, s);
    expect(wasOnCall("room-1", s)).toBe(true);
  });

  it("is a no-op when storage is blocked", () => {
    expect(() => rememberCall("room-1", true, null)).not.toThrow();
    expect(wasOnCall("room-1", null)).toBeNull();
  });
});

describe("whether the room starts the call by itself", () => {
  const base = {
    isPermanentRoom: false,
    isGroupRoom: false,
    expired: false,
    liveMode: false,
    remembered: null,
  };

  it("yes on a genuine first entry to a session room", () => {
    // The behaviour that must not change: you opened a date room, the
    // date is the point.
    expect(shouldAutoStartCall(base)).toBe(true);
  });

  it("no on a refresh after I left the call", () => {
    // The bug, exactly.
    expect(shouldAutoStartCall({ ...base, remembered: false })).toBe(false);
  });

  it("no when I was on the call, because resuming already put me there", () => {
    // liveMode is seeded true from the same memory, so the auto-start
    // has nothing left to do and must not fire a second time.
    expect(shouldAutoStartCall({ ...base, remembered: true, liveMode: true })).toBe(false);
  });

  it("never in a permanent room, remembered or not", () => {
    expect(shouldAutoStartCall({ ...base, isPermanentRoom: true })).toBe(false);
    expect(shouldAutoStartCall({ ...base, isPermanentRoom: true, remembered: true })).toBe(false);
  });

  it("and never once the room has expired", () => {
    expect(shouldAutoStartCall({ ...base, expired: true })).toBe(false);
  });

  it("never in a group room, where joining the call is somebody's decision", () => {
    // George, in a squad room: "when I refresh the page, it joins
    // call. It wasn't on a call before I refreshed." A squad night is
    // a place you walk into — five people arriving over ten minutes,
    // a stage, a lobby, and a call button of its own. Dialling for
    // them turns a camera on in a room they only just opened.
    expect(shouldAutoStartCall({ ...base, isGroupRoom: true })).toBe(false);
    expect(shouldAutoStartCall({ ...base, isGroupRoom: true, remembered: true })).toBe(false);
  });
});

describe("a memory stops being worth obeying", () => {
  // "I was on the call" was written on join and cleared only on Leave,
  // so a tab closed mid-call left a `true` with no expiry on it. Every
  // later visit to the room read it as an instruction.
  const ROOM = "room-1";

  it("obeys a record from this sitting", () => {
    const s = new MemoryStorage();
    rememberCall(ROOM, true, s, 1_000_000);
    expect(wasOnCall(ROOM, s, 1_000_000 + 60_000)).toBe(true);
  });

  it("forgets one left behind by a closed tab", () => {
    const s = new MemoryStorage();
    rememberCall(ROOM, true, s, 1_000_000);
    expect(wasOnCall(ROOM, s, 1_000_000 + MEMORY_GOOD_FOR_MS + 1)).toBeNull();
  });

  it("forgets a deliberate 'no' just as readily", () => {
    // Not asymmetric: a stale record of either kind says nothing about
    // where this person is now.
    const s = new MemoryStorage();
    rememberCall(ROOM, false, s, 1_000_000);
    expect(wasOnCall(ROOM, s, 1_000_000 + MEMORY_GOOD_FOR_MS + 1)).toBeNull();
  });

  it("distrusts a record from the future", () => {
    // A clock that moved backwards (a timezone fix, a laptop waking up)
    // must not hand out an immortal record.
    const s = new MemoryStorage();
    rememberCall(ROOM, true, s, 2_000_000);
    expect(wasOnCall(ROOM, s, 1_000_000)).toBeNull();
  });

  it("ignores the old timeless shape already in people's browsers", () => {
    // v1 stored a bare boolean. It cannot be shown to be recent, and
    // letting it through is the bug.
    const s = new MemoryStorage();
    s.setItem("dr:oncall:v1", JSON.stringify({ [ROOM]: true }));
    expect(wasOnCall(ROOM, s, 1_000_000)).toBeNull();
  });
});
