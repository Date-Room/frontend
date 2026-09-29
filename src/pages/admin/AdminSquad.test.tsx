import { describe, expect, it } from "vitest";
import { countryLine, giftLine } from "./AdminSquad";

describe("AdminSquad helpers", () => {
  it("lists countries biggest first, ties alphabetical", () => {
    expect(countryLine({ NG: 2, KE: 3, MA: 2, "??": 1 })).toBe("KE 3 · MA 2 · NG 2 · ?? 1");
    expect(countryLine({})).toBe("");
  });
});

describe("giftLine", () => {
  it("says where a gift went", () => {
    expect(giftLine("Amaka", { status: "granted", gift_nights: 0, gift_room_id: null })).toBe("Amaka is in");
    expect(giftLine("Amaka", { status: "granted", gift_nights: 4, gift_room_id: "r1" })).toBe(
      "Amaka got 4 nights, added to their squad room",
    );
    expect(giftLine("Amaka", { status: "granted", gift_nights: 1, gift_room_id: null })).toBe(
      "Amaka got 1 night. They land in their first squad room",
    );
  });
});
