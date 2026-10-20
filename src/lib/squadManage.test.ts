import { describe, expect, it } from "vitest";
import { canRunSquad, nightSizes, nightsAndSpare, nightsLeftLabel, type SquadMembers, type SquadNights } from "@/lib/squad";

const nights = (over: Partial<SquadNights> = {}): SquadNights => ({
  seats: 3,
  seat_nights: 15,
  nights_left: 5,
  free_night_expires_at: null,
  active_night: null,
  nights: [],
  ...over,
});

describe("spare seats", () => {
  it("shows them beside the nights", () => {
    expect(nightsAndSpare(15, 4)).toBe("3 nights + 3 spare seats");
    expect(nightsAndSpare(10, 3)).toBe("3 nights + 1 spare seat");
    expect(nightsAndSpare(6, 3)).toBe("2 nights");
    expect(nightsLeftLabel(nights({ seat_nights: 10, nights_left: 3, spare_seats: 1 }))).toBe("3 nights left + 1 spare seat");
    expect(nightsLeftLabel(nights({ seat_nights: 2, nights_left: 0, spare_seats: 2 }))).toBe("No full nights · 2 spare seats");
    expect(nightsLeftLabel(nights({ seat_nights: 0, nights_left: 0, spare_seats: 0 }))).toBe("No nights left");
    expect(nightsLeftLabel(nights())).toBe("5 nights left"); // older servers: no spare_seats
  });
  it("offers the sizes the server allows, else the room's own", () => {
    expect(nightSizes(nights({ by_size: [2, 3, 4, 5].map((s) => ({ seats: s, nights: 0, spare: 0 })) }))).toEqual([2, 3, 4, 5]);
    expect(nightSizes(nights())).toEqual([3]);
  });
});

describe("canRunSquad", () => {
  const m = (role: SquadMembers["my_role"], members_manage = false): SquadMembers => ({
    members: [],
    locked_until: null,
    my_role: role,
    members_manage,
  });
  it("is the owner and co-hosts, or everyone when the room says so", () => {
    expect(canRunSquad(m("owner"))).toBe(true);
    expect(canRunSquad(m("cohost"))).toBe(true);
    expect(canRunSquad(m("member"))).toBe(false);
    expect(canRunSquad(m("member", true))).toBe(true);
    expect(canRunSquad(undefined)).toBe(false);
  });
});
