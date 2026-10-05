import { beforeEach, describe, expect, it } from "vitest";
import type { Room } from "@/lib/rooms";
import {
  ROOM_KIND_CHIPS,
  compareByLastVisited,
  lastVisitedAt,
  lastVisitedLabel,
  loadRoomVisits,
  markRoomVisited,
  matchesKind,
} from "@/lib/roomList";

function room(id: string, opts: Partial<Room> = {}): Room {
  return {
    id,
    code: id.toUpperCase(),
    pin: "1234",
    host_id: "h",
    persistence: "persistent",
    state: "active",
    package: "squad",
    livekit_room_name: `dr-${id}`,
    greeting_headline: null,
    greeting_subtext: null,
    theme_color: null,
    background_id: null,
    created_at: "2026-10-01T00:00:00Z",
    ...opts,
  } as Room;
}

describe("matchesKind", () => {
  const squad = room("s", { room_kind: "squad" });
  const date = room("d", { room_kind: "date" });
  const legacy = room("l"); // no room_kind at all

  it("all keeps everything", () => {
    for (const r of [squad, date, legacy]) {
      expect(matchesKind(r, "all")).toBe(true);
    }
  });

  it("squads keeps only squad rooms", () => {
    expect(matchesKind(squad, "squads")).toBe(true);
    expect(matchesKind(date, "squads")).toBe(false);
  });

  it("dates keeps everything that isn't a squad, including legacy rows", () => {
    expect(matchesKind(date, "dates")).toBe(true);
    expect(matchesKind(legacy, "dates")).toBe(true);
    expect(matchesKind(squad, "dates")).toBe(false);
  });

  it("labels say Dates and Squads, not Daterooms", () => {
    expect(ROOM_KIND_CHIPS.dates).toBe("Dates");
    expect(ROOM_KIND_CHIPS.squads).toBe("Squads");
  });
});

describe("room visits", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a visit", () => {
    markRoomVisited("a", new Date("2026-10-05T12:00:00Z"));
    expect(lastVisitedAt("a", loadRoomVisits())).toBe(
      Date.parse("2026-10-05T12:00:00Z"),
    );
  });

  it("a room never entered has no stamp", () => {
    expect(lastVisitedAt("nope", loadRoomVisits())).toBeNull();
  });

  it("survives junk in storage rather than throwing", () => {
    localStorage.setItem("dr_room_visits", "not json");
    expect(loadRoomVisits()).toEqual({});
    localStorage.setItem("dr_room_visits", JSON.stringify(["an", "array"]));
    expect(loadRoomVisits()).toEqual({});
    localStorage.setItem("dr_room_visits", JSON.stringify({ a: 42, b: "nope" }));
    expect(loadRoomVisits()).toEqual({});
  });

  it("a later visit replaces the earlier one", () => {
    markRoomVisited("a", new Date("2026-10-01T00:00:00Z"));
    markRoomVisited("a", new Date("2026-10-05T00:00:00Z"));
    expect(lastVisitedAt("a", loadRoomVisits())).toBe(
      Date.parse("2026-10-05T00:00:00Z"),
    );
  });
});

describe("compareByLastVisited", () => {
  const sort = (rooms: Room[], visits: Record<string, string>) =>
    rooms.slice().sort((a, b) => compareByLastVisited(a, b, visits));

  it("orders entered rooms by most recent visit", () => {
    const a = room("a");
    const b = room("b");
    const out = sort([a, b], {
      a: "2026-10-01T00:00:00Z",
      b: "2026-10-05T00:00:00Z",
    });
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("puts any entered room above a never-entered one, however new", () => {
    const visitedLongAgo = room("old", { created_at: "2026-01-01T00:00:00Z" });
    const createdToday = room("new", { created_at: "2026-10-05T00:00:00Z" });
    const out = sort([createdToday, visitedLongAgo], {
      old: "2026-05-01T00:00:00Z",
    });
    expect(out.map((r) => r.id)).toEqual(["old", "new"]);
  });

  it("orders never-entered rooms by creation, newest first", () => {
    const older = room("older", { created_at: "2026-08-01T00:00:00Z" });
    const newer = room("newer", { created_at: "2026-10-04T00:00:00Z" });
    expect(sort([older, newer], {}).map((r) => r.id)).toEqual(["newer", "older"]);
  });

  it("lands a mixed list in both tiers, in order", () => {
    const rooms = [
      room("madeLastWeek", { created_at: "2026-09-28T00:00:00Z" }),
      room("enteredEarlier"),
      room("madeToday", { created_at: "2026-10-05T09:00:00Z" }),
      room("enteredRecently"),
    ];
    const out = sort(rooms, {
      enteredRecently: "2026-10-05T20:00:00Z",
      enteredEarlier: "2026-10-02T00:00:00Z",
    });
    expect(out.map((r) => r.id)).toEqual([
      "enteredRecently",
      "enteredEarlier",
      "madeToday",
      "madeLastWeek",
    ]);
  });

  it("is stable whichever way the input starts", () => {
    const a = room("a");
    const b = room("b", { created_at: "2026-10-06T00:00:00Z" });
    const visits = { a: "2026-10-05T00:00:00Z" };
    expect(sort([a, b], visits)[0].id).toBe("a");
    expect(sort([b, a], visits)[0].id).toBe("a");
  });
});

describe("lastVisitedLabel", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  const ago = (ms: number) => lastVisitedLabel(now - ms, now);

  it("reads as time passing", () => {
    expect(ago(5_000)).toBe("just now");
    expect(ago(14 * 60_000)).toBe("14m ago");
    expect(ago(3 * 3_600_000)).toBe("3h ago");
    expect(ago(2 * 86_400_000)).toBe("2d ago");
    expect(ago(8 * 86_400_000)).toBe("a week ago");
    expect(ago(21 * 86_400_000)).toBe("3w ago");
  });

  it("never renders a negative age from a clock that moved backwards", () => {
    expect(lastVisitedLabel(now + 60_000, now)).toBe("just now");
  });
});
