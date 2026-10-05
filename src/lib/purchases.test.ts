import { describe, expect, it } from "vitest";
import { formatMoney, formatPaidTotals, itemSubline, type PurchaseItem } from "./purchases";
import { lastTopUpLabel, type SquadNights } from "./squad";

const item = (over: Partial<PurchaseItem>): PurchaseItem => ({
  kind: "purchase",
  title: "Squad Night",
  status: "paid",
  amount: 240,
  currency: "KES",
  method: "M-Pesa",
  receipt: "UJ37W9288Z",
  room_id: null,
  room_name: "Friday crew",
  transaction_id: null,
  detail: null,
  at: "2026-10-03T11:51:52Z",
  ...over,
});

describe("purchases", () => {
  it("formats paid totals per currency", () => {
    expect(formatPaidTotals([])).toBe("Nothing yet");
    expect(formatPaidTotals([{ currency: "KES", amount: 540 }])).toBe("KES 540");
    expect(formatMoney(4.99, "USD")).toBe("USD 4.99");
  });

  it("puts date, room, method and receipt under the title", () => {
    const line = itemSubline(item({}));
    expect(line).toContain("Friday crew");
    expect(line).toContain("M-Pesa");
    expect(line).toContain("UJ37W9288Z");
    expect(itemSubline(item({ status: "waiting", method: "DateRoom", room_name: null, receipt: null }))).not.toContain(
      "DateRoom",
    );
  });
});

describe("lastTopUpLabel", () => {
  const n = (last_top_up: SquadNights["last_top_up"]): SquadNights => ({
    seats: 3,
    seat_nights: 9,
    nights_left: 3,
    last_top_up,
    free_night_expires_at: null,
    active_night: null,
    nights: [],
  });

  it("names who added nights, or DateRoom for a gift", () => {
    expect(lastTopUpLabel(n(null))).toBeNull();
    expect(lastTopUpLabel(n({ by: "Joshua", nights: 1, source: "purchase", at: "2026-10-03T12:00:00Z" }))).toMatch(
      /^Joshua added 1 night · /,
    );
    expect(lastTopUpLabel(n({ by: "DateRoom", nights: 3, source: "admin", at: "2026-10-03T12:00:00Z" }))).toMatch(
      /^DateRoom gifted 3 nights · /,
    );
  });
});
