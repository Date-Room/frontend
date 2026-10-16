import { describe, expect, it } from "vitest";
import { channelLabel, eventLine, filterSummary, formatDuration, formatMoney, funnelRows, isRealMoney, loadProblem, paidViaLabel, share, usageLines } from "./AdminGrowth";

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

describe("loadProblem", () => {
  it("explains a server that doesn't have growth tracking yet, without a retry", async () => {
    const { ApiError } = await import("@/lib/api");
    const p = loadProblem(new ApiError(404, "Not Found", null));
    expect(p.title).toMatch(/isn't live/);
    expect(p.body).not.toMatch(/Not Found/);
    expect(p.retry).toBe(false);
  });
  it("offers a retry for anything transient", () => {
    expect(loadProblem(new Error("network")).retry).toBe(true);
  });
});

describe("formatMoney", () => {
  it("shows whole amounts without decimals and prices with cents", () => {
    expect(formatMoney(1200, "KES")).toBe(`KES ${(1200).toLocaleString()}`);
    expect(formatMoney(4.99, "USD")).toMatch(/^USD 4.99$/);
    expect(formatMoney(null, "USD")).toBe("—");
    expect(formatMoney(3, null)).toBe("—");
  });
});

describe("layer 1 helpers", () => {
  it("names channels plainly", () => {
    expect(channelLabel("direct")).toMatch(/Direct/);
    expect(channelLabel("referral")).toBe("Referred by a friend");
    expect(channelLabel("chaperon_badge")).toBe("Chaperon badge");
  });
  it("summarises active filters for the subtitle", () => {
    expect(filterSummary({ country: null, platform: null, channel: null })).toBe("");
    expect(filterSummary({ country: "KE", platform: "ios", channel: "recap" })).toBe("Kenya · iPhone · Recap · ");
  });
  it("shows shares safely", () => {
    expect(share(1, 4)).toBe("25%");
    expect(share(0, 0)).toBe("—");
  });
});

describe("funnel rework", () => {
  it("labels the used-again step and lists drop-offs beside the funnel", () => {
    expect(funnelRows([{ step: "used_again", users: 1 }])[0].label).toMatch(/again/);
    expect(usageLines(undefined)).toEqual([]);
    const lines = usageLines({ never_opened_a_room: 60, opened_but_no_date: 8, used_again_any: 3, used_again_without_a_date: 1, paid: 2 });
    expect(lines.map((l) => l.value)).toEqual([60, 8, 1, 2]);
    expect(lines[0].label).toMatch(/never opened/);
  });
  it("names sign-ups in the activity list", () => {
    expect(eventLine("signed_up", {})).toBe("Signed up");
  });
});
