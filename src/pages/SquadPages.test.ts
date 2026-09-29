import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { createErrorMessage } from "./SquadNew";
import { freeNightNote } from "./SquadRoom";
import { filterSummary } from "./admin/AdminGrowth";
import type { SquadNights } from "@/lib/squad";

describe("squad pages", () => {
  it("explains why a room couldn't open", () => {
    const denied = new ApiError(403, "no", { detail: { error: "squad_access_required" } });
    expect(createErrorMessage(denied)).toEqual({ text: "Squad is invite-only for now.", requestAccess: true });
    const closed = new ApiError(404, "no", { detail: { error: "squad_unavailable" } });
    expect(createErrorMessage(closed).text).toMatch(/aren't open yet/);
    expect(createErrorMessage(new Error("x")).text).toMatch(/couldn't open/);
  });

  it("mentions the free night only while it's there", () => {
    expect(freeNightNote({ free_night_expires_at: null } as SquadNights)).toBeNull();
    expect(freeNightNote({ free_night_expires_at: "2026-10-28T12:00:00Z" } as SquadNights)).toMatch(/^Your free night is waiting/);
  });

  it("puts the room kind first in the Growth subtitle", () => {
    expect(filterSummary({ country: "KE", platform: null, channel: null, kind: "squad" })).toBe("Squad nights · Kenya · ");
  });
});
