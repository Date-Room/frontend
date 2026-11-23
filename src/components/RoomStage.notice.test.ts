/**
 * Somebody opened something: ten seconds of notice, then a mark that
 * stays.
 *
 * A toast you miss is the same as no toast at all, and the old
 * notifier settled back after 3.4s leaving nothing behind — so the
 * only way to find out that two people were in a game was to go
 * looking. The invitation is worth ten seconds, and after it goes the
 * fact that something is still running has to remain visible.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/RoomStage.tsx", "utf8");

describe("the join notice", () => {
  it("lasts ten seconds", () => {
    expect(src).toMatch(/setNotif\(null\), 10_000\)/);
  });

  it("only announces an arrival, not what was already running", () => {
    // Re-announcing on every presence tick would make the room nag.
    expect(src).toContain("announced.current.has(party.activityId)");
    expect(src).toContain("announced.current.add(fresh.activityId)");
  });

  it("forgets an activity only once it is genuinely EMPTY", () => {
    // It used to forget one that stopped being *joinable*, which is a
    // different thing and comes apart from "is it running" constantly:
    // the last other player steps out for a second, or I join, or I
    // leave again. Each of those re-armed the notice for a game that
    // had been going the whole time, so the room kept announcing it.
    // The rule is keyed on who has it open, me included.
    expect(src).toMatch(/if \(!running\.has\(id\)\) announced\.current\.delete\(id\)/);
    expect(src).toContain("activeActivityIds(room.presence)");
  });

  it("does not offer me what I just opened, before my own echo lands", () => {
    // Presence is a round trip. In the window between opening
    // something and seeing myself in it, somebody else's presence
    // arrives and the room offered to take me where I already was.
    expect(src).toContain('const openHere = staged && staged !== "lobby" ? staged : null');
    const at = src.indexOf("const joinable = useMemo(");
    expect(src.slice(at, at + 260)).toContain("openHere");
  });

  it("never announces something I am already in", () => {
    const at = src.indexOf("const joinable = useMemo(");
    expect(at).toBeGreaterThan(0);
    expect(src.slice(at, at + 220)).toContain("!amIn(");
  });

  it("settles into a mark that outlives it", () => {
    expect(src).toContain("const somethingOn = joinable.length > 0");
    expect(src).toMatch(/somethingOn && \(/);
    // And it respects a viewer who has asked for less motion.
    expect(src).toContain("motion-safe:animate-pulse");
  });
});

describe("the launcher lists what is going on", () => {
  it("lives in the launcher that actually renders", () => {
    // It was first added to ActivityTray.tsx, which nothing imports —
    // so it compiled, passed, and was tree-shaken out of the bundle.
    // The real launcher is the menu inside RoomStage.
    expect(src).toContain("<PartyRow");
    expect(src).toContain("partiesFrom(room.presence, room.senderId)");
  });

  it("sits above the row of things you could start", () => {
    const list = src.indexOf("<PartyRow");
    const icons = src.indexOf("availCats.map((c) => (");
    expect(list).toBeGreaterThan(0);
    expect(icons).toBeGreaterThan(0);
    expect(list).toBeLessThan(icons);
  });

  it("joining one puts it on my stage and closes the menu", () => {
    const at = src.indexOf("<PartyRow");
    const row = src.slice(at, at + 700);
    expect(row).toContain("commitStage(party.activityId)");
    expect(row).toContain("setMenuOpen(false)");
  });
});
