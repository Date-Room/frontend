import { describe, expect, it } from "vitest";
import {
  OB_TOPICS,
  buildObDeck,
  initialObState,
  obFromJson,
  obSeenCode,
  obSlots,
  obTopic,
  reduceOb,
  rollTopicQuestions,
  type ObState,
} from "./openBook";

const A = "user-a";
const B = "user-b";

function play(s: ObState, type: string, userId: string, payload: Record<string, unknown> = {}): ObState {
  return reduceOb(s, { type, payload, userId });
}

/** Drives a full setup: A picks 15, alternating claims, both write + veto. */
function upToPlay(): ObState {
  let s = play(initialObState(), "choose_length", A, { target: 15 });
  const ids = OB_TOPICS.map((t) => t.id);
  for (let i = 0; i < obSlots(15); i++) {
    const who = i % 2 === 0 ? A : B;
    s = play(s, "claim", who, { topic: ids[i], q: [0, 0, 0] });
  }
  s = play(s, "write", A, { text: "What would you never text me?" });
  s = play(s, "write", B, { text: "What do you want tonight, plainly?" });
  const aClaims = s.claims.filter((c) => c.user === A).map((c) => c.topic);
  const bClaims = s.claims.filter((c) => c.user === B).map((c) => c.topic);
  s = play(s, "veto", A, { binned: bClaims[0], swap: ids[10], q: [1, 1, 1] });
  s = play(s, "veto", B, { binned: aClaims[0], swap: ids[11], q: [2, 2, 2] });
  return s;
}

describe("reduceOb (Open Book)", () => {
  it("enforces alternating draft turns starting with the length-picker", () => {
    let s = play(initialObState(), "choose_length", A, { target: 15 });
    expect(s.phase).toBe("draft");
    expect(play(s, "claim", B, { topic: "firsts", q: [0, 0, 0] })).toBe(s);
    s = play(s, "claim", A, { topic: "firsts", q: [0, 0, 0] });
    expect(play(s, "claim", A, { topic: "work", q: [0, 0, 0] })).toBe(s);
    s = play(s, "claim", B, { topic: "work", q: [0, 0, 0] });
    expect(s.claims).toHaveLength(2);
  });

  it("rejects taken topics and invalid question indices", () => {
    let s = play(initialObState(), "choose_length", A, { target: 15 });
    s = play(s, "claim", A, { topic: "firsts", q: [0, 0, 0] });
    expect(play(s, "claim", B, { topic: "firsts", q: [0, 0, 0] })).toBe(s);
    expect(play(s, "claim", B, { topic: "work", q: [0, 0, 99] })).toBe(s);
  });

  it("moves to write after the draft, then veto after both write", () => {
    let s = play(initialObState(), "choose_length", A, { target: 15 });
    const ids = OB_TOPICS.map((t) => t.id);
    for (let i = 0; i < obSlots(15); i++) {
      s = play(s, "claim", i % 2 === 0 ? A : B, { topic: ids[i], q: [0, 0, 0] });
    }
    expect(s.phase).toBe("write");
    expect(play(s, "write", A, { text: "hi" })).toBe(s);
    s = play(s, "write", A, { text: "A real question here?" });
    expect(s.phase).toBe("write");
    s = play(s, "write", B, { text: "Another real question?" });
    expect(s.phase).toBe("veto");
  });

  it("vetoes only target the partner's topics, once each, swap must be untaken", () => {
    const s = upToPlay();
    expect(s.phase).toBe("play");
    expect(Object.keys(s.vetoes)).toHaveLength(2);
  });

  it("builds a deterministic escalating deck with both written cards folded in", () => {
    const s = upToPlay();
    const deck = buildObDeck(s);
    expect(deck).toHaveLength(15);
    const heats = deck.filter((c) => !c.written).map((c) => ["Warm", "Real", "Close"].indexOf(c.heat));
    for (let i = 1; i < heats.length; i++) expect(heats[i]).toBeGreaterThanOrEqual(heats[i - 1]);
    expect(deck.filter((c) => c.written)).toHaveLength(2);
    expect(buildObDeck(s)).toEqual(deck);
  });

  it("plays through with a shared pass pool and reactions, then restarts keeping seen", () => {
    let s = upToPlay();
    const deckLen = buildObDeck(s).length;
    s = play(s, "react", A, { index: 0, emoji: "🔥" });
    expect(s.reacts["0"][A]).toBe("🔥");
    s = play(s, "pass", B, { index: 0 });
    s = play(s, "pass", A, { index: 1 });
    expect(play(s, "pass", B, { index: 2 })).toBe(s);
    for (let i = 2; i < deckLen; i++) s = play(s, "advance", A, { index: i });
    expect(s.phase).toBe("done");
    const seenTotal = Object.values(s.seen).flat().length;
    expect(seenTotal).toBeGreaterThan(0);
    const fresh = play(s, "restart", B);
    expect(fresh.phase).toBe("setup");
    expect(fresh.nights).toBe(1);
    expect(Object.values(fresh.seen).flat().length).toBe(seenTotal);
  });

  it("round-trips through json", () => {
    const s = upToPlay();
    const back = obFromJson(JSON.parse(JSON.stringify(s)));
    expect(back.phase).toBe("play");
    expect(back.claims).toHaveLength(obSlots(15));
    expect(buildObDeck(back)).toEqual(buildObDeck(s));
  });
});

describe("content and rolls", () => {
  it("twelve topics, three per bucket, all heats present", () => {
    expect(OB_TOPICS).toHaveLength(12);
    const heats = new Set(OB_TOPICS.map((t) => t.heat));
    expect(heats).toEqual(new Set(["Warm", "Real", "Close"]));
    for (const t of OB_TOPICS) {
      expect(t.open).toHaveLength(3);
      expect(t.specific).toHaveLength(3);
      expect(t.costly).toHaveLength(3);
      expect(t.note.length).toBeGreaterThan(5);
    }
  });

  it("rolls avoid seen questions and fall back when a bucket drains", () => {
    const t = obTopic("firsts")!;
    const seen = [obSeenCode(0, 0), obSeenCode(0, 1)];
    for (let i = 0; i < 20; i++) {
      const q = rollTopicQuestions(t, seen);
      expect(q[0]).toBe(2);
    }
    const allSeen = [0, 1, 2].map((i) => obSeenCode(0, i));
    const q = rollTopicQuestions(t, allSeen, () => 0.5);
    expect(q[0]).toBeGreaterThanOrEqual(0);
    expect(q[0]).toBeLessThan(3);
  });
});
