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
