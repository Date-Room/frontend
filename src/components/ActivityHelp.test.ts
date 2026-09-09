import { describe, expect, it } from "vitest";
import { hasActivityHelp } from "./ActivityHelp";
import { ACTIVITIES } from "@/lib/activityRegistry";

describe("activity help coverage", () => {
  it("every registry activity has an explainer", () => {
    for (const activity of ACTIVITIES) {
      expect(hasActivityHelp(activity.id), `missing help for ${activity.id}`).toBe(true);
    }
  });

  it("unknown ids have no help", () => {
    expect(hasActivityHelp("nope")).toBe(false);
  });
});
