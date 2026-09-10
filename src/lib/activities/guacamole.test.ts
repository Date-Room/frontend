import { describe, expect, it } from "vitest";
import {
  GUAC_BOWL_TARGET,
  GUAC_INGREDIENTS,
  GUAC_PEEKS_PER_BATCH,
  guacDeadlineMs,
  guacFromJson,
  guacStealWindow,
  guacStream,
  initialGuacState,
  reduceGuac,
  type GuacState,
} from "./guacamole";

const A = "user-a";
const B = "user-b";

function ev(s: GuacState, type: string, userId: string, payload: Record<string, unknown> = {}): GuacState {
  return reduceGuac(s, { type, payload: { batch: s.batch, ...payload }, userId });
}

describe("guacamole stream", () => {
  it("is deterministic per room+batch and never repeats an ingredient twice", () => {
    const a = guacStream("room-1", 0);
    const b = guacStream("room-1", 0);
    expect(a.map((x) => x.name)).toEqual(b.map((x) => x.name));
    expect(a).toHaveLength(80);
    for (let i = 1; i < a.length; i++) expect(a[i].name).not.toBe(a[i - 1].name);
    // A different batch deals a different order.
    const c = guacStream("room-1", 1);
    expect(c.map((x) => x.name).join()).not.toBe(a.map((x) => x.name).join());
  });

  it("ramps the deadline down to a floor", () => {
    expect(guacDeadlineMs(0)).toBeGreaterThan(guacDeadlineMs(20));
    expect(guacDeadlineMs(500)).toBe(950);
  });

  it("steal windows differ per player and sit inside the round", () => {
    const a = guacStealWindow("room-1", 0, A);
    const b = guacStealWindow("room-1", 0, B);
    expect(a.openMs).not.toBe(b.openMs);
    for (const w of [a, b]) {
      expect(w.openMs).toBeGreaterThanOrEqual(20_000);
      expect(w.closeMs).toBeLessThanOrEqual(75_000 + 6_000);
    }
  });

  it("every ingredient maps to one of the four buttons", () => {
    for (const ing of GUAC_INGREDIENTS) {
      expect(["chop", "smash", "squeeze", "stir"]).toContain(ing.action);
    }
    expect(GUAC_BOWL_TARGET).toBeGreaterThan(10);
  });
});

describe("reduceGuac", () => {
  it("needs both readies; the completing ready sets the shared clock", () => {
    let s = initialGuacState();
    s = ev(s, "ready", A);
    expect(s.phase).toBe("prep");
    expect(ev(s, "ready", A)).toBe(s); // no double-ready
    s = ev(s, "ready", B, { start_at: "2026-09-10T20:00:00.000Z" });
    expect(s.phase).toBe("countdown");
    expect(s.start_at).toBe("2026-09-10T20:00:00.000Z");
    s = ev(s, "begin", A);
    expect(s.phase).toBe("cooking");
  });

  it("tracks pulses, one loud steal each, and capped peeks", () => {
    let s = initialGuacState();
    s = ev(s, "ready", A);
    s = ev(s, "ready", B);
    s = ev(s, "begin", B);
    s = ev(s, "pulse", A, { pct: 0.4 });
    expect(s.progress[A]).toBe(0.4);
    s = ev(s, "steal", A);
    expect(ev(s, "steal", A)).toBe(s); // once per batch
    s = ev(s, "steal", B);
    expect(s.steals).toEqual([A, B]);
    for (let i = 0; i < GUAC_PEEKS_PER_BATCH + 2; i++) s = ev(s, "peek", B);
    expect(s.peeks[B]).toBe(GUAC_PEEKS_PER_BATCH);
  });

  it("reveals when both results land, and next batch reseeds clean", () => {
    let s = initialGuacState();
    s = ev(s, "ready", A);
    s = ev(s, "ready", B);
    s = ev(s, "begin", A);
    s = ev(s, "finish", A, { score: 210, made: 21, splats: 3, pct: 0.6 });
    expect(s.phase).toBe("cooking");
    expect(ev(s, "force_reveal", B)).toBe(s); // only a finisher may force
    s = ev(s, "finish", B, { score: 180, made: 18, splats: 5, pct: 0.5 });
    expect(s.phase).toBe("reveal");
    expect(s.results[A].score).toBe(210);
    const next = ev(s, "next_batch", B);
    expect(next.phase).toBe("prep");
    expect(next.batch).toBe(1);
    expect(next.batches_played).toBe(1);
    expect(next.ready).toEqual([]);
    expect(next.results).toEqual({});
  });

  it("force_reveal rescues a finisher whose partner left", () => {
    let s = initialGuacState();
    s = ev(s, "ready", A);
    s = ev(s, "ready", B);
    s = ev(s, "begin", A);
    s = ev(s, "finish", A, { score: 100, made: 10, splats: 1, pct: 0.3 });
    s = ev(s, "force_reveal", A);
    expect(s.phase).toBe("reveal");
  });

  it("ignores stale batches and junk json round-trips safely", () => {
    let s = initialGuacState();
    s = ev(s, "ready", A);
    expect(reduceGuac(s, { type: "ready", payload: { batch: 7 }, userId: B })).toBe(s);
    const back = guacFromJson({
      phase: "cooking",
      batch: 2,
      ready: [A, B],
      progress: { [A]: 1.7, [B]: "junk" },
      results: { [A]: { score: "x" } },
      steals: [A, 42],
      peeks: { [B]: 1 },
      batches_played: 2,
    });
    expect(back.phase).toBe("cooking");
    expect(back.progress[A]).toBe(1);
    expect(back.progress[B]).toBeUndefined();
    expect(back.results[A].score).toBe(0);
    expect(back.steals).toEqual([A]);
    expect(guacFromJson(null)).toEqual(initialGuacState());
  });
});
