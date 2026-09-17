import { describe, expect, it } from "vitest";
import { hasActivityHelp, shouldShowGameIntro } from "./ActivityHelp";

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

  it("only games get the intro gate; utilities and walls open directly", () => {
    for (const id of ["lobby", "room_details", "watch", "dj", "chat", "vision_board", "fridge_notes", "bookshelf"]) {
      expect(shouldShowGameIntro(id), id).toBe(false);
    }
    for (const id of ["rank_it", "guacamole", "questions", "the_36", "this_or_that"]) {
      expect(shouldShowGameIntro(id), id).toBe(true);
    }
  });
});
