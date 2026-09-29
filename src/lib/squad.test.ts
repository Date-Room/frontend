import { describe, expect, it } from "vitest";
import { canSendSquadRequest, toggleSquadPlan } from "./squad";

describe("squad request helpers", () => {
  it("needs a city, a group size of 2 to 5 and at least one plan", () => {
    const ok = { city: "Lagos", group_size: 4, plans: ["films" as const], note: "" };
    expect(canSendSquadRequest(ok)).toBe(true);
    expect(canSendSquadRequest({ ...ok, city: "   " })).toBe(false);
    expect(canSendSquadRequest({ ...ok, group_size: 6 })).toBe(false);
    expect(canSendSquadRequest({ ...ok, plans: [] })).toBe(false);
  });

  it("toggles plans and keeps them in display order", () => {
    expect(toggleSquadPlan([], "trip")).toEqual(["trip"]);
    expect(toggleSquadPlan(["trip"], "films")).toEqual(["films", "trip"]);
    expect(toggleSquadPlan(["films", "trip"], "films")).toEqual(["trip"]);
  });
});

import { formatSquadMoney, nightsLeftLabel, squadInviteUrl, type SquadNights } from "./squad";

describe("squad room helpers", () => {
  it("formats money the way each currency is used", () => {
    expect(formatSquadMoney(960, "KES")).toBe("KES 960");
    expect(formatSquadMoney(8800, "NGN")).toBe("NGN 8,800");
    expect(formatSquadMoney(15.84, "USD")).toBe("USD 15.84");
    expect(formatSquadMoney(21, "MAD")).toBe("MAD 21");
  });

  it("says how many nights are left", () => {
    const n = (nights_left: number) => ({ nights_left }) as SquadNights;
    expect(nightsLeftLabel(n(0))).toBe("No nights left");
    expect(nightsLeftLabel(n(1))).toBe("1 night left");
    expect(nightsLeftLabel(n(4))).toBe("4 nights left");
  });

  it("builds the same invite link shape as every room", () => {
    expect(squadInviteUrl("K7Q2MX", "1234", "https://dateroom.io")).toBe("https://dateroom.io/i/K7Q2MX/1234");
  });
});
