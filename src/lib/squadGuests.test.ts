import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { guestLinkProblem, guestLinkUrl, guestSeatLine, isSquadGuest, markSquadGuest } from "@/lib/squadGuests";

afterEach(() => localStorage.clear());

describe("squad guests", () => {
  it("builds the link a host shares", () => {
    expect(guestLinkUrl("abc", "https://dateroom.io")).toBe("https://dateroom.io/g/abc");
  });
  it("says who pays without comparing anyone", () => {
    expect(guestSeatLine({ pays: "squad", host_name: "Joshua" })).toBe("Joshua's squad has a seat for you tonight.");
    expect(guestSeatLine({ pays: "self", host_name: "Joshua" })).toBe("You'll get your seat when you join.");
  });
  it("explains links that can't be used", () => {
    const e = (status: number, error?: string) => new ApiError(status, "x", error ? { detail: { error } } : null);
    expect(guestLinkProblem(e(410))).toMatch(/expired/);
    expect(guestLinkProblem(e(409, "guest_link_used"))).toMatch(/Someone else already used/);
    expect(guestLinkProblem(e(404))).toMatch(/doesn't work/);
  });
  it("remembers I'm tonight's guest until a day after the night", () => {
    expect(isSquadGuest("r1")).toBe(false);
    markSquadGuest("r1", new Date(Date.now() + 3_600_000).toISOString());
    expect(isSquadGuest("r1")).toBe(true);
    markSquadGuest("r2", new Date(Date.now() - 2 * 86_400_000).toISOString());
    expect(isSquadGuest("r2")).toBe(false);
  });
});
