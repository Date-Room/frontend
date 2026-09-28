import { describe, expect, it } from "vitest";
import { eventLine, formatDuration, funnelRows, isRealMoney, paidViaLabel } from "./AdminGrowth";

describe("funnelRows", () => {
  it("gives each step its share of sign-ups and of the step before", () => {
    const rows = funnelRows([
      { step: "signed_up", users: 80 },
      { step: "opened_or_joined_room", users: 40 },
      { step: "had_a_date", users: 20 },
      { step: "came_back_later", users: 10 },
      { step: "paid", users: 0 },
    ]);
    expect(rows.map((r) => r.ofTop)).toEqual([100, 50, 25, 13, 0]);
    expect(rows.map((r) => r.ofPrev)).toEqual([100, 50, 50, 50, 0]);
    expect(rows[2].label).toMatch(/date/i);
  });
  it("copes with nobody signed up", () => {
    expect(funnelRows([{ step: "signed_up", users: 0 }, { step: "paid", users: 0 }]).map((r) => r.ofTop)).toEqual([0, 0]);
  });
});

describe("labels", () => {
  it("names how a room was paid for, and only counts real money as paid", () => {
    expect(paidViaLabel("open_beta")).toBe("Free (paywall off)");
    expect(paidViaLabel("something_new")).toBe("something_new");
    expect(isRealMoney("subscription")).toBe(true);
    expect(isRealMoney("promo")).toBe(false);
    expect(isRealMoney("open_beta")).toBe(false);
  });
  it("formats call length", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(14 * 60)).toBe("14m");
    expect(formatDuration(65 * 60)).toBe("1h 05m");
  });
  it("writes one plain line per event", () => {
    expect(eventLine("room_promoted", { paid_via: "open_beta", package: "single_pass" })).toBe(
      "Made a room permanent · Free (paywall off)",
    );
    expect(eventLine("room_opened", { package: "date_pack", paid_via: "purchase" })).toBe("Opened a Date Pack room · Paid");
    expect(eventLine("room_purged", { reason: "recap_expired" })).toBe("Room closed · Recap window ended");
  });
});
