import { describe, expect, it } from "vitest";
import { countryName, flag, foldCountries } from "./CountryBars";

const row = (country: string, signed_up: number) => ({
  country, signed_up, new_in_period: 1, had_a_date: 1, came_back_later: 0, paid: 0,
});

describe("CountryBars helpers", () => {
  it("names and flags countries", () => {
    expect(countryName("KE")).toBe("Kenya");
    expect(countryName("unknown")).toBe("Unknown");
    expect(flag("KE")).toBe("🇰🇪");
    expect(flag("unknown")).toBe("");
  });
  it("keeps the top rows and folds the rest into Other", () => {
    const rows = Array.from({ length: 14 }, (_, i) => row(String.fromCharCode(65 + i) + "A", 20 - i));
    const out = foldCountries(rows, 10);
    expect(out).toHaveLength(11);
    expect(out[0].country).toBe("AA");
    expect(out[10]).toMatchObject({ country: "other", signed_up: 10 + 9 + 8 + 7, had_a_date: 4 });
  });
  it("does not fold a single leftover row", () => {
    expect(foldCountries([row("KE", 5), row("NG", 3)], 1).map((r) => r.country)).toEqual(["KE", "NG"]);
  });
});

describe("usedAgain", () => {
  it("prefers the room-based count and falls back to the old visit count", async () => {
    const { usedAgain } = await import("./CountryBars");
    const base = { key: "KE", signed_up: 5, new_in_period: 1, had_a_date: 2, came_back_later: 4, paid: 0 };
    expect(usedAgain(base)).toBe(4);
    expect(usedAgain({ ...base, used_again: 1 })).toBe(1);
  });
});
