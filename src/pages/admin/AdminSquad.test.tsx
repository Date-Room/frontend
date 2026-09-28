import { describe, expect, it } from "vitest";
import { countryLine } from "./AdminSquad";

describe("AdminSquad helpers", () => {
  it("lists countries biggest first, ties alphabetical", () => {
    expect(countryLine({ NG: 2, KE: 3, MA: 2, "??": 1 })).toBe("KE 3 · MA 2 · NG 2 · ?? 1");
    expect(countryLine({})).toBe("");
  });
});
