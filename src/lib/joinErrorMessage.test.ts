import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { joinErrorMessage } from "@/lib/rooms";

describe("joinErrorMessage", () => {
  it("asks to check the PIN only when the PIN was wrong", () => {
    expect(joinErrorMessage(new ApiError(403, "Invalid PIN", { detail: "Invalid PIN" }))).toMatch(/PIN/);
    const full = joinErrorMessage(
      new ApiError(409, "Room is full (2 participants max).", { detail: "Room is full (2 participants max)." }),
    );
    expect(full).toContain("Room is full");
    expect(full).not.toMatch(/PIN/);
    expect(joinErrorMessage(new ApiError(410, "This room has ended.", null))).toBe("This room has ended.");
  });

  it("names a resting room instead of showing a bare status", () => {
    const err = new ApiError(409, "Conflict", { detail: { error: "room_resting", capability: "can_invite" } });
    expect(joinErrorMessage(err)).toMatch(/resting/);
  });

  it("says when the network is the problem", () => {
    expect(joinErrorMessage(new TypeError("Failed to fetch"))).toMatch(/connection/);
  });
});
