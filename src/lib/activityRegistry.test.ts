import { describe, expect, it } from "vitest";
import {
  ACTIVITIES,
  ACTIVITY_NOTIF,
  CURATABLE_ACTIVITIES,
  LAUNCHER_CATEGORIES,
} from "./activityRegistry";

describe("activity registry", () => {
  it("has unique activity ids and curatable ids", () => {
    const ids = ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const curatable = ACTIVITIES.map((a) => a.curatableId).filter(Boolean);
    expect(new Set(curatable).size).toBe(curatable.length);
  });

  it("places every activity in exactly one launcher category", () => {
    const placed = LAUNCHER_CATEGORIES.flatMap((c) => c.itemIds);
    expect(placed.sort()).toEqual(ACTIVITIES.map((a) => a.id).sort());
  });

  it("notifier targets resolve to registry activities", () => {
    const ids = new Set(ACTIVITIES.map((a) => a.id));
    for (const [key, meta] of Object.entries(ACTIVITY_NOTIF)) {
      expect(ids.has(meta.target), `notif target for ${key}`).toBe(true);
    }
  });

  it("keeps the curation picker order: walls, watch, music, games", () => {
    const categories = CURATABLE_ACTIVITIES.map((a) => a.category);
    const firstIndex = (c: string) => categories.indexOf(c);
    expect(firstIndex("walls")).toBe(0);
    expect(firstIndex("watch")).toBeGreaterThan(firstIndex("walls"));
    expect(firstIndex("music")).toBeGreaterThan(firstIndex("watch"));
    expect(firstIndex("games")).toBeGreaterThan(firstIndex("music"));
  });
});
