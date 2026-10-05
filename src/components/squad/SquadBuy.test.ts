import { describe, expect, it } from "vitest";
import { nightOptions } from "./SquadBuy";

describe("nightOptions", () => {
  it("shows the pack's saving against buying single nights", () => {
    const opts = nightOptions([
      { product: "squad_night", nights: 1, per_seat: 80, amount: 320, currency: "KES" },
      { product: "squad_pack", nights: 4, per_seat: 60, amount: 960, currency: "KES" },
    ]);
    expect(opts.map((o) => o.title)).toEqual(["Squad Night", "Squad Pack"]);
    expect(opts[1].save).toBe("Save KES 320");
    expect(opts[0].sub).toBe("One night · KES 80 each");
  });

  it("ignores seat and extension prices", () => {
    const opts = nightOptions([
      { product: "squad_seat", nights: 1, per_seat: 80, amount: 80, currency: "KES" },
      { product: "squad_night", nights: 1, per_seat: 80, amount: 160, currency: "KES" },
    ]);
    expect(opts).toHaveLength(1);
  });
});
