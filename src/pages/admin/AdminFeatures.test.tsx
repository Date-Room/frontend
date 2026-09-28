import { describe, expect, it } from "vitest";
import { featureLabel, headline, pctOrDash } from "./AdminFeatures";
import type { FeatureRow } from "@/lib/admin";

const row = (feature: string, used: number, openedOnly: number, abandon: number | null): FeatureRow => ({
  feature,
  rooms_used: used,
  rooms_opened_only: openedOnly,
  abandon_rate: abandon,
  share_of_dates: null,
  median_minutes: null,
  users: 0,
  repeat_users: 0,
  in_paid_rooms: null,
  by_package: {},
});

describe("AdminFeatures helpers", () => {
  it("labels known and unknown features", () => {
    expect(featureLabel("guacamole")).toBe("Guacamole Panic");
    expect(featureLabel("chaperon_guardian")).toBe("Chaperon · Protect");
    expect(featureLabel("new_game_x")).toBe("New game x");
  });
  it("picks the most used and the most abandoned (3+ opens only)", () => {
    const { top, dropped } = headline([
      row("watch", 10, 1, 9),
      row("the_36", 4, 0, 0),
      row("rank_it", 1, 4, 80),
      row("pick_a_door", 0, 2, 100),
    ]);
    expect(top?.feature).toBe("watch");
    expect(dropped?.feature).toBe("rank_it");
  });
  it("dashes missing percentages", () => {
    expect(pctOrDash(null)).toBe("—");
    expect(pctOrDash(40)).toBe("40%");
  });
});
