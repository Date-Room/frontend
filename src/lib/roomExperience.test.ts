import { describe, expect, it } from "vitest";
import {
  CURATABLE_ACTIVITIES,
  TRY_ACTIVITY_IDS,
  resolveCuratedActivities,
} from "./roomExperience";

describe("resolveCuratedActivities", () => {
  it("subscription rooms always get the full menu — stored curation never freezes it", () => {
    // A Together room created before the new games shipped stored only the
    // old ids; the permanent room must still see everything the tier allows.
    const stale = ["watch", "dj", "questions", "this_or_that", "2_truths"] as const;
    const resolved = resolveCuratedActivities("subscription", [...stale]);
    expect(resolved).toEqual(CURATABLE_ACTIVITIES.map((a) => a.id));
    expect(resolved).toContain("pick_a_door");
    expect(resolved).toContain("one_has_to_go");
    expect(resolved).toContain("rank_it");
    expect(resolved).toContain("vision_board");
  });

  it("session rooms keep the host's curation, filtered to the package", () => {
    const resolved = resolveCuratedActivities("date_pack", [
      "watch",
      "pick_a_door",
      "vision_board", // walls are subscription-only — filtered out
    ] as never[]);
    expect(resolved).toEqual(["watch", "pick_a_door"]);
  });

  it("try tier is capped to its three regardless of curation", () => {
    const resolved = resolveCuratedActivities("single_pass", null);
    expect(resolved).toEqual([...TRY_ACTIVITY_IDS]);
  });
});
