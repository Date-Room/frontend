// Playing together means two people reach for the same thing at once.
//
// The server answers 409 when somebody dealt, moved or closed a second
// before you did. The screen already refetched on any failure, so it
// always caught up — but it called this a failure, which sent people
// looking for a mistake they had not made, on the very screen whose
// staleness caused it. Mobile says "the round moved on" (mobile#28); this
// is the same reading on web.
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { isRoundConflict } from "@/lib/squadGames";

describe("isRoundConflict", () => {
  it("reads a bare 409 as somebody getting there first", () => {
    expect(isRoundConflict(new ApiError(409, "Conflict", null))).toBe(true);
  });

  it("reads the named code too, whatever status carries it", () => {
    const e = new ApiError(400, "Bad request", { detail: { error: "round_in_progress" } });
    expect(isRoundConflict(e)).toBe(true);
  });

  // Non-vacuous: the things that must still read as real failures.
  it("leaves every other failure a failure", () => {
    expect(isRoundConflict(new ApiError(500, "Server error", null))).toBe(false);
    expect(isRoundConflict(new ApiError(403, "Forbidden", { detail: { error: "not_a_member" } }))).toBe(false);
    expect(isRoundConflict(new Error("offline"))).toBe(false);
    expect(isRoundConflict(null)).toBe(false);
  });
});
