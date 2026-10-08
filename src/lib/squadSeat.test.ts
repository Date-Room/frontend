import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { nightFullFrom, seatChoice } from "@/lib/squad";

const full = (detail: unknown, status = 409) => new ApiError(status, "conflict", { detail });

describe("nightFullFrom", () => {
  it("reads the server's night_full refusal", () => {
    expect(nightFullFrom(full({ error: "night_full", seats: 3, can_add_seat: true, product: "squad_seat_single" }))).toEqual({
      seats: 3,
      can_add_seat: true,
      product: "squad_seat_single",
    });
  });
  it("ignores every other error", () => {
    expect(nightFullFrom(full({ error: "no_active_night" }))).toBeNull();
    expect(nightFullFrom(full("Room is full (5 participants max)."))).toBeNull();
    expect(nightFullFrom(full({ error: "night_full" }, 403))).toBeNull();
    expect(nightFullFrom(new Error("network"))).toBeNull();
  });
});

describe("seatChoice", () => {
  const open = { seats: 3, can_add_seat: true, product: null };
  it("uses the room's nights first, then asks the latecomer to pay", () => {
    expect(seatChoice(open, null)).toBe("loading");
    expect(seatChoice(open, 4)).toBe("use_balance");
    expect(seatChoice(open, 0)).toBe("pay");
  });
  it("says so when the night is already at five", () => {
    expect(seatChoice({ ...open, seats: 5, can_add_seat: false }, 10)).toBe("maxed");
  });
});
