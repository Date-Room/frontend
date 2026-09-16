import { describe, expect, it } from "vitest";
import { buildNight, nightOutcome } from "./recapNight";
import type { ActivityEventResponse, ActivityStateResponse } from "@/lib/activities/activityState";

const A = "user-a";
const B = "user-b";

function stateOf(activity_id: string, state: Record<string, unknown>): ActivityStateResponse {
  return { activity_id, state, version: 1, schema_version: 1, updated_by: null, updated_at: "2026-09-09T20:00:00Z" };
}

function ev(activity_id: string, at: string, text: string, name = "Joshua"): ActivityEventResponse {
  return {
    id: `${activity_id}-${at}`,
    activity_id,
    sequence_number: 0,
    event_type: "note",
    actor_participant_id: null,
    actor_display_name: name,
    payload: { text },
    created_at: at,
  };
}

describe("nightOutcome", () => {
  it("writes results, not statuses", () => {
    const tot = nightOutcome(
      stateOf("this_or_that", {
        run: 0, round: 5, phase: "picking", picks: {}, predictions: {}, ms: {},
        reads: { [A]: 2, [B]: 1 }, same_count: 1,
        log: [{}, {}, {}, {}, {}].map(() => ({ picks: { [A]: "a", [B]: "b" }, predictions: {}, ms: {} })),
      }),
    );
    expect(tot.outcome).toContain("Same side on 1 of 5");
    expect(tot.outcome).toContain("3 times");
    expect(tot.figure?.value).toBe("1 / 5");
  });

  it("Closer banked reads as a pickup point", () => {
    const o = nightOutcome(
      stateOf("the_36", { phase: "done", n: 8, banked: true, keeps: [], rulings: [] }),
    );
    expect(o.outcome).toContain("question 9");
    expect(o.figure?.label).toBe("banked, not finished");
  });

  it("empty rooms get quiet lines, never invented figures", () => {
    const o = nightOutcome(stateOf("2_truths", { scores: {}, round: null, rounds_played: 0 }));
    expect(o.outcome).toContain("nobody lied");
    expect(o.figure).toBeUndefined();
  });
});

describe("buildNight", () => {
  it("orders cards chronologically, sizes minutes, and folds keepsakes", () => {
    const activities = [
      stateOf("the_36", {
        phase: "done", n: 8, banked: true, rulings: [],
        keeps: [
          { by: A, q: 1, note: "The empty-room story." },
          { by: B, q: 2, note: "Walking home the long way." },
        ],
      }),
      stateOf("this_or_that", {
        run: 0, round: 5, phase: "picking", picks: {}, predictions: {}, ms: {}, reads: {}, same_count: 2,
        log: [{ picks: {}, predictions: {}, ms: {} }],
      }),
    ];
    const events = [
      ev("this_or_that", "2026-09-09T20:00:00Z", "Mountains or Ocean · split"),
      ev("this_or_that", "2026-09-09T20:10:00Z", "Move for love · same side"),
      ev("the_36", "2026-09-09T20:20:00Z", "banked at question 9", "Kiki"),
      ev("the_36", "2026-09-09T20:50:00Z", "q9 ruled", "Kiki"),
    ];
    const night = buildNight(activities, events, { myUserId: A, partnerName: "Kiki" });
    expect(night.cards.map((c) => c.id)).toEqual(["this_or_that", "the_36"]);
    expect(night.cards[0].minutes).toBe(10);
    expect(night.cards[1].minutes).toBe(30);
    expect(night.keepsakes).toHaveLength(2);
    expect(night.keepsakes[0].by).toBe("You");
    expect(night.keepsakes[1].by).toBe("Kiki");
    expect(night.figures[0].value).toBe("50m");
    expect(night.figures.find((f) => f.label === "lines kept")?.value).toBe("2");
    expect(night.logCount).toBe(4);
  });

  it("dedupes repeated moment texts and caps them", () => {
    const activities = [stateOf("this_or_that", { run: 0, round: 0, phase: "picking", picks: {}, predictions: {}, ms: {}, reads: {}, same_count: 0, log: [] })];
    const events = Array.from({ length: 12 }, (_, i) =>
      ev("this_or_that", `2026-09-09T20:${String(10 + i).padStart(2, "0")}:00Z`, i < 2 ? "same text" : `line ${i}`),
    );
    const night = buildNight(activities, events, { myUserId: A, partnerName: null });
    const texts = night.cards[0].moments.map((m) => m.text);
    expect(texts.filter((t) => t === "same text").length).toBeLessThanOrEqual(1);
    expect(texts.length).toBeLessThanOrEqual(8);
  });
});
