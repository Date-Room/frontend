import { describe, expect, it } from "vitest";
import { hasActivityHelp } from "./ActivityHelp";

describe("activity help coverage", () => {
  it("every tray game has an explainer", () => {
    const trayGameIds = [
      "questions",
      "this_or_that",
      "the_36",
      "2_truths",
      "truth_or_dare",
      "one_has_to_go",
      "pick_a_door",
      "rank_it",
      "guacamole",
      "watch",
      "dj",
      "chat",
      "room_details",
    ];
    for (const id of trayGameIds) {
      expect(hasActivityHelp(id), `missing help for ${id}`).toBe(true);
    }
  });

  it("unknown ids have no help", () => {
    expect(hasActivityHelp("nope")).toBe(false);
  });
});
