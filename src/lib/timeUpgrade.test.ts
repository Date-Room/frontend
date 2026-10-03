import { describe, expect, it } from "vitest";
import {
  formatPackPrice,
  TIME_EXTENSION_CATALOG,
  upgradePackRows,
  visibleTimeProducts,
  type TimeExtensionConfig,
} from "./timeExtensions";

const config = (over: Partial<TimeExtensionConfig> = {}): TimeExtensionConfig => ({
  payment_provider: "mpesa",
  country_code: "KE",
  stripe_configured: false,
  mpesa_configured: true,
  expires_at: null,
  products: TIME_EXTENSION_CATALOG,
  is_try: true,
  time_15_open: false,
  upgrade_packs: [
    { id: "date_pack", sessions: 3, minutes: 60, amount: 300, currency: "KES", save_percent: 33, owned: 0 },
    { id: "long_pack", sessions: 5, minutes: 120, amount: 600, currency: "KES", save_percent: 60, owned: 2 },
  ],
  ...over,
});

describe("visibleTimeProducts", () => {
  it("never offers 15 minutes on the upgrade sheet", () => {
    expect(visibleTimeProducts(config({ time_15_open: true }), "upgrade").map((p) => p.id)).toEqual([
      "time_30",
      "time_60",
    ]);
  });

  it("offers 15 minutes on the add-time sheet only near the end", () => {
    expect(visibleTimeProducts(config({ time_15_open: false }), "time").map((p) => p.id)).toEqual([
      "time_30",
      "time_60",
    ]);
    expect(visibleTimeProducts(config({ time_15_open: true }), "time").map((p) => p.id)).toEqual([
      "time_15",
      "time_30",
      "time_60",
    ]);
  });
});

describe("upgradePackRows", () => {
  it("puts the best value first with save badges, never per-minute prices", () => {
    const rows = upgradePackRows(config());
    expect(rows.map((r) => r.id)).toEqual(["long_pack", "date_pack"]);
    expect(rows[0]).toMatchObject({ title: "Long Pack", badge: "Save 60%", bestValue: true, owned: 2 });
    expect(rows[0].sub).toBe("5 two-hour dates · this one starts now");
    expect(rows[1]).toMatchObject({ title: "Date Pack", badge: "Save 33%", bestValue: false });
    expect(rows[1].sub).toBe("3 one-hour dates · this one starts now");
    expect(JSON.stringify(rows)).not.toMatch(/per min|\/min/i);
  });

  it("offers no packs outside a Try room", () => {
    expect(upgradePackRows(config({ upgrade_packs: [] }))).toEqual([]);
  });

  it("formats pack prices", () => {
    expect(formatPackPrice({ amount: 600, currency: "KES" })).toMatch(/600/);
  });
});
