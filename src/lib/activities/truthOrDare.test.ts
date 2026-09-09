import { describe, expect, it } from "vitest";
import {
  TOD_BURNS_PER_NIGHT,
  TOD_HEAT_IDS,
  TOD_NIGHT_TURNS,
  TOD_POOL,
  initialTodState,
  lookupTodCard,
  nextTodCard,
  reduceTod,
  todFromJson,
  todHeatForTurn,
  type TodState,
} from "./truthOrDare";

const A = "user-a";
const B = "user-b";

function play(state: TodState, type: string, userId: string, payload: Record<string, unknown> = {}): TodState {
  return reduceTod(state, { type, payload, userId });
}

/** A settles as first performer, B deals a valid card of `kind`. */
function upToStakes(kind: "truth" | "dare" = "truth"): TodState {
  let s = play(initialTodState(), "start_night", A);
  const cardId = nextTodCard(s.used, 1, kind)!;
  s = play(s, "choose_kind", B, { kind, card_id: cardId });
  return s;
}

describe("reduceTod (night redesign)", () => {
  it("start_night makes the starter the performer", () => {
    const s = play(initialTodState(), "start_night", A);
    expect(s.phase).toBe("decide");
    expect(s.performer_id).toBe(A);
  });

  it("only the non-performer can deal, with a valid unused card of the chosen kind", () => {
    let s = play(initialTodState(), "start_night", A);
    const truthId = nextTodCard(s.used, 1, "truth")!;
    expect(play(s, "choose_kind", A, { kind: "truth", card_id: truthId })).toBe(s);
    const dareId = nextTodCard(s.used, 1, "dare")!;
    expect(play(s, "choose_kind", B, { kind: "truth", card_id: dareId })).toBe(s);
    s = play(s, "choose_kind", B, { kind: "truth", card_id: truthId });
    expect(s.phase).toBe("stakes");
    expect(s.judge_id).toBe(B);
    expect(s.used).toContain(truthId);
    expect(lookupTodCard(s.card_id!)?.kind).toBe("truth");
  });

  it("performer takes or doubles; judge rules; tokens pay 1 or 2", () => {
    let s = upToStakes();
    expect(play(s, "take", B, { doubled: false })).toBe(s);
    s = play(s, "take", A, { doubled: true });
    expect(s.phase).toBe("perform");
    expect(play(s, "rule", A, { delivered: true })).toBe(s);
    s = play(s, "rule", B, { delivered: true });
    expect(s.phase).toBe("judged");
    expect(s.tokens[A]).toBe(2);
    expect(s.vault).toHaveLength(0);
  });

  it("a dodged ruling pays nothing and vaults the card", () => {
    let s = upToStakes();
    const cardId = s.card_id!;
    s = play(s, "take", A, { doubled: false });
    s = play(s, "rule", B, { delivered: false });
    expect(s.tokens[A] ?? 0).toBe(0);
    expect(s.vault).toContain(cardId);
  });

  it("burning vaults the card and is capped per night", () => {
    let s = upToStakes();
    const first = s.card_id!;
    s = play(s, "burn", A);
    expect(s.phase).toBe("judged");
    expect(s.vault).toContain(first);
    expect(s.burns_used[A]).toBe(1);
    // Burn a second, then a third attempt must be ignored.
    for (let i = 0; i < 2; i++) {
      s = play(s, "next_turn", A);
      // B performs now; A deals; then swap back when needed.
      const performer = s.performer_id!;
      const judge = performer === A ? B : A;
      const id = nextTodCard(s.used, todHeatForTurn(s.turn), "dare")!;
      s = play(s, "choose_kind", judge, { kind: "dare", card_id: id });
      if (performer === A) {
        s = play(s, "burn", A);
      } else {
        s = play(s, "take", performer, { doubled: false });
        s = play(s, "rule", judge, { delivered: true });
      }
    }
    expect(s.burns_used[A]).toBe(2);
    const blocked = play({ ...s, phase: "stakes", performer_id: A, card_id: 0 }, "burn", A);
    expect(blocked.burns_used[A]).toBe(TOD_BURNS_PER_NIGHT);
  });

  it("turns alternate performer and heat climbs Warm→Bold→Bare", () => {
    expect(todHeatForTurn(0)).toBe(1);
    expect(todHeatForTurn(1)).toBe(1);
    expect(todHeatForTurn(2)).toBe(2);
    expect(todHeatForTurn(4)).toBe(3);
    let s = upToStakes();
    s = play(s, "take", A, { doubled: false });
    s = play(s, "rule", B, { delivered: true });
    s = play(s, "next_turn", B);
    expect(s.performer_id).toBe(B);
    expect(s.phase).toBe("decide");
  });

  it("the night ends after all turns, and restart keeps used cards", () => {
    let s = upToStakes();
    for (let turn = 0; turn < TOD_NIGHT_TURNS; turn++) {
      const performer = s.performer_id!;
      const judge = performer === A ? B : A;
      if (s.phase === "decide") {
        const id = nextTodCard(s.used, todHeatForTurn(s.turn), "truth")!;
        s = play(s, "choose_kind", judge, { kind: "truth", card_id: id });
      }
      s = play(s, "take", performer, { doubled: false });
      s = play(s, "rule", judge, { delivered: true });
      s = play(s, "next_turn", performer);
    }
    expect(s.phase).toBe("done");
    const usedBefore = s.used.length;
    expect(usedBefore).toBe(TOD_NIGHT_TURNS);
    const fresh = play(s, "restart", A);
    expect(fresh.phase).toBe("deck");
    expect(fresh.used).toHaveLength(usedBefore);
    expect(fresh.tokens).toEqual({});
    expect(fresh.vault).toHaveLength(0);
  });

  it("end_night from judged closes the night early", () => {
    let s = upToStakes();
    s = play(s, "take", A, { doubled: false });
    s = play(s, "rule", B, { delivered: true });
    s = play(s, "end_night", A);
    expect(s.phase).toBe("done");
  });

  it("round-trips through json", () => {
    expect(todFromJson(null)).toEqual(initialTodState());
    const s = todFromJson({
      phase: "perform",
      turn: 3,
      performer_id: A,
      judge_id: B,
      kind: "dare",
      card_id: 51,
      doubled: true,
      tokens: { [A]: 2 },
      burns_used: { [B]: 1 },
      vault: [70],
      used: [51, 70],
    });
    expect(s.phase).toBe("perform");
    expect(s.doubled).toBe(true);
    expect(s.vault).toEqual([70]);
  });
});

describe("heat tiers", () => {
  it("cover every card id exactly once", () => {
    const all = ([1, 2, 3] as const).flatMap((h) => [...TOD_HEAT_IDS[h].truth, ...TOD_HEAT_IDS[h].dare]);
    expect(all).toHaveLength(TOD_POOL.length);
    expect(new Set(all).size).toBe(TOD_POOL.length);
    for (const h of [1, 2, 3] as const) {
      for (const id of TOD_HEAT_IDS[h].truth) expect(lookupTodCard(id)?.kind).toBe("truth");
      for (const id of TOD_HEAT_IDS[h].dare) expect(lookupTodCard(id)?.kind).toBe("dare");
    }
  });

  it("nextTodCard skips used cards and falls back when a tier drains", () => {
    const bareDares = TOD_HEAT_IDS[3].dare;
    expect(nextTodCard([], 3, "dare")).toBe(bareDares[0]);
    const fallback = nextTodCard(bareDares, 3, "dare");
    expect(fallback).not.toBeNull();
    expect(bareDares).not.toContain(fallback);
    expect(lookupTodCard(fallback!)?.kind).toBe("dare");
  });
});
