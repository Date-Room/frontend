/** The recap's activity lines must read like a friend's recap, not a
 *  database row (live feedback: "the summary is wasted"). */
import { describe, expect, it } from "vitest";
import { summarize } from "@/pages/Recap";
import type { ActivityStateResponse } from "@/lib/activities/activityState";

function state(activity_id: string, s: Record<string, unknown>): ActivityStateResponse {
  return { activity_id, state: s } as unknown as ActivityStateResponse;
}

describe("recap activity copy", () => {
  it("chat counts messages in a human voice", () => {
    expect(summarize(state("chat", { messages: [1, 2, 3] }))).toBe("You traded 3 messages");
    expect(summarize(state("chat", { messages: [] }))).toBe("All talk, no typing");
  });

  it("watch distinguishes watching from merely opening", () => {
    expect(summarize(state("watch", { video_id: "abc" }))).toBe("Watched something together");
    expect(summarize(state("watch", {}))).toBe("Opened, but never pressed play");
  });

  it("dj names the closing track when there is one", () => {
    expect(summarize(state("dj", { now_playing: { title: "Golden Hour" } }))).toContain(
      "Golden Hour",
    );
  });

  it("never emits the old database-row phrasing", () => {
    for (const line of [
      summarize(state("questions", { phase: "deepening" })),
      summarize(state("unknown_thing", {})),
    ]) {
      expect(line).not.toMatch(/^Phase:/);
      expect(line).not.toBe("Saved");
    }
  });
});
