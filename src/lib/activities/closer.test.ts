import { describe, expect, it } from "vitest";
import {
  CL_QUESTIONS,
  CL_TOTAL,
  clAtEnd,
  clEngagement,
  clFromJson,
  clStretchWindow,
  initialClState,
  reduceCloser,
  type ClState,
} from "./closer";

const A = "user-a";
const B = "user-b";

function play(s: ClState, type: string, userId: string, payload: Record<string, unknown> = {}): ClState {
  return reduceCloser(s, { type, payload, userId });
}

/** Answer + rule both turns of the current question. */
function playQuestion(s: ClState, verdictFirst = "answered", verdictSecond = "answered"): ClState {
  const firstIsStarter = s.n % 2 === 0;
  const first = firstIsStarter ? A : B;
  const second = firstIsStarter ? B : A;
  s = play(s, "my_answer", first);
  s = play(s, "rule", second, { verdict: verdictFirst });
  s = play(s, "my_answer", second);
  s = play(s, "rule", first, { verdict: verdictSecond });
  return s;
}

describe("reduceCloser", () => {
  it("begin sets the stretch, start point, and starter", () => {
    const s = play(initialClState(), "begin", A, { stretch: 6, start_at: 14 });
    expect(s.phase).toBe("turns");
    expect(s.stretch).toBe(6);
    expect(s.n).toBe(14);
    expect(s.starter_id).toBe(A);
  });

  it("only the current answerer declares, only the listener rules", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3 });
    // Question 0: starter answers first.
    expect(play(s, "my_answer", B)).toBe(s);
    s = play(s, "my_answer", A);
    expect(s.sub).toBe("ruling");
    expect(play(s, "rule", A, { verdict: "answered" })).toBe(s);
    s = play(s, "rule", B, { verdict: "half" });
    expect(s.turn).toBe(1);
    expect(s.rulings[0]).toEqual({ q: 0, answerer: A, verdict: "half" });
  });

  it("the first answerer alternates by question", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3 });
    s = playQuestion(s);
    // Question 1: B answers first now.
    expect(play(s, "my_answer", A)).toBe(s);
    s = play(s, "my_answer", B);
    expect(s.answerer_id).toBe(B);
  });

  it("a stretch ends on keep; both keeps lead to the landing", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3 });
    for (let i = 0; i < 3; i++) s = playQuestion(s);
    expect(s.phase).toBe("keep");
    expect(clStretchWindow(s)).toEqual([0, 1, 2]);
    expect(play(s, "keep", A, { q: 9, note: "out of window" })).toBe(s);
    s = play(s, "keep", A, { q: 1, note: "The grandmother answer." });
    expect(s.phase).toBe("keep");
    expect(play(s, "keep", A, { q: 2, note: "again" })).toBe(s);
    s = play(s, "keep", B, { q: 0, note: "Rain outside, nowhere to be." });
    expect(s.phase).toBe("landing");
    expect(s.keeps).toHaveLength(2);
  });

  it("continuing needs both; one stop banks the night", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3 });
    for (let i = 0; i < 3; i++) s = playQuestion(s);
    s = play(s, "keep", A, { q: 0, note: "kept" });
    s = play(s, "keep", B, { q: 1, note: "kept" });
    let go = play(s, "continue", A);
    expect(go.phase).toBe("landing");
    go = play(go, "continue", B);
    expect(go.phase).toBe("turns");
    expect(go.n).toBe(3);
    const stopped = play(s, "stop", B);
    expect(stopped.phase).toBe("done");
    expect(stopped.banked).toBe(true);
  });

  it("eyes unlock after six questions and end into done", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3 });
    for (let i = 0; i < 3; i++) s = playQuestion(s);
    s = play(s, "keep", A, { q: 0, note: "kept" });
    s = play(s, "keep", B, { q: 1, note: "kept" });
    // Only 3 asked: silence locked.
    expect(play(s, "start_eyes", A, { at: new Date().toISOString() })).toBe(s);
    s = play(s, "continue", A);
    s = play(s, "continue", B);
    for (let i = 0; i < 3; i++) s = playQuestion(s);
    s = play(s, "keep", A, { q: 3, note: "kept" });
    s = play(s, "keep", B, { q: 4, note: "kept" });
    s = play(s, "start_eyes", B, { at: "2026-09-09T20:00:00Z" });
    expect(s.phase).toBe("eyes");
    expect(s.eyes_started_at).toBe("2026-09-09T20:00:00Z");
    s = play(s, "end_eyes", A);
    expect(s.phase).toBe("done");
    expect(s.did_eyes).toBe(true);
  });

  it("tallies engagement per player and finishes at question 36", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3, start_at: CL_TOTAL - 1 });
    expect(clAtEnd(s)).toBe(true);
    s = playQuestion(s, "dodged", "answered");
    expect(s.phase).toBe("keep");
    const firstIsStarter = (CL_TOTAL - 1) % 2 === 0;
    const dodger = firstIsStarter ? A : B;
    expect(clEngagement(s, dodger).dodged).toBe(1);
  });

  it("round-trips through json", () => {
    let s = play(initialClState(), "begin", A, { stretch: 3 });
    s = play(s, "my_answer", A);
    const back = clFromJson(JSON.parse(JSON.stringify(s)));
    expect(back.sub).toBe("ruling");
    expect(back.answerer_id).toBe(A);
  });
});

describe("content", () => {
  it("36 questions in three sets of twelve", () => {
    expect(CL_QUESTIONS).toHaveLength(36);
    for (const set of [1, 2, 3]) {
      expect(CL_QUESTIONS.filter((x) => x.set === set)).toHaveLength(12);
    }
  });
});
