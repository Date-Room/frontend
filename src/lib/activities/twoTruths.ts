/**
 * 2 Truths and a Lie — the press-and-stakes redesign (originally a TS port
 * of mobile's `two_truths_module.dart`). Storyteller writes 3 and marks the
 * lie; the guesser may PRESS exactly one statement (the storyteller must
 * elaborate on it out loud), then calls the lie with confidence stakes:
 * 1 point safe, or 2 points where a wrong call hands the 2 to the liar.
 * NOTE: stakes change scoring semantics vs mobile's v1 module — a
 * web↔mobile game diverges until mobile ports this (parity list).
 */

export type TwoTruthsPhase = "composing" | "guessing" | "revealing";

export type TwoTruthsRound = {
  storyteller_id: string;
  statements: string[] | null;
  lie_index: number | null;
  guess: number | null;
  /** The one statement the guesser pressed for elaboration, if any. */
  pressed: number | null;
  /** 1 (safe) or 2 (confident — wrong hands 2 to the liar). */
  stake: number | null;
  phase: TwoTruthsPhase;
} | null;

/** Blank-page sparks shown as rotating placeholder hints while composing. */
export const TWO_TRUTHS_SPARKS = [
  "A talent nobody expects…",
  "A near-miss story…",
  "Something from age ten…",
  "A place you swear you've been…",
  "A famous person you've met…",
  "A food opinion you'd defend…",
  "An injury with a story…",
  "Something you've won…",
  "A skill you learned for someone…",
];

export type TwoTruthsState = {
  scores: Record<string, number>;
  round: TwoTruthsRound;
  rounds_played: number;
};

export type TwoTruthsEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialTwoTruthsState(): TwoTruthsState {
  return { scores: {}, round: null, rounds_played: 0 };
}

export function twoTruthsFromJson(s: Record<string, unknown> | null): TwoTruthsState {
  if (!s) return initialTwoTruthsState();
  const r = s.round as Record<string, unknown> | undefined;
  const round: TwoTruthsRound =
    r && typeof r === "object"
      ? {
          storyteller_id: String(r.storyteller_id ?? ""),
          statements: Array.isArray(r.statements) ? (r.statements as string[]) : null,
          lie_index: typeof r.lie_index === "number" ? r.lie_index : null,
          guess: typeof r.guess === "number" ? r.guess : null,
          pressed: typeof r.pressed === "number" ? r.pressed : null,
          stake: r.stake === 1 || r.stake === 2 ? r.stake : null,
          phase: r.phase === "guessing" || r.phase === "revealing" ? r.phase : "composing",
        }
      : null;
  return {
    scores:
      s.scores && typeof s.scores === "object"
        ? Object.fromEntries(Object.entries(s.scores as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0]))
        : {},
    round,
    rounds_played: typeof s.rounds_played === "number" ? s.rounds_played : 0,
  };
}

export function reduceTwoTruths(current: TwoTruthsState, event: TwoTruthsEvent): TwoTruthsState {
  const me = event.userId;
  switch (event.type) {
    case "claim_turn":
      if (current.round != null) return current;
      return {
        ...current,
        round: { storyteller_id: me, statements: null, lie_index: null, guess: null, pressed: null, stake: null, phase: "composing" },
      };
    case "submit_statements": {
      const r = current.round;
      if (!r || r.storyteller_id !== me || r.phase !== "composing") return current;
      const statements = Array.isArray(event.payload.statements) ? (event.payload.statements as string[]) : null;
      const lie = typeof event.payload.lie_index === "number" ? event.payload.lie_index : null;
      if (!statements || statements.length !== 3) return current;
      if (lie == null || lie < 0 || lie > 2) return current;
      return { ...current, round: { ...r, statements, lie_index: lie, phase: "guessing" } };
    }
    // The one press: the guesser spotlights a single statement and the
    // storyteller must elaborate on it out loud. Spent once per round.
    case "press": {
      const r = current.round;
      if (!r || r.phase !== "guessing" || me === r.storyteller_id || r.pressed != null) return current;
      const i = typeof event.payload.index === "number" ? event.payload.index : null;
      if (i == null || i < 0 || i > 2) return current;
      return { ...current, round: { ...r, pressed: i } };
    }
    case "guess": {
      const r = current.round;
      if (!r || r.phase !== "guessing" || me === r.storyteller_id) return current;
      const g = typeof event.payload.guess === "number" ? event.payload.guess : null;
      if (g == null || g < 0 || g > 2) return current;
      const stake = event.payload.stake === 2 ? 2 : 1;
      const scores = { ...current.scores };
      // Confidence transfer: right pays the caller, wrong pays the liar.
      if (g === r.lie_index) scores[me] = (scores[me] ?? 0) + stake;
      else scores[r.storyteller_id] = (scores[r.storyteller_id] ?? 0) + stake;
      return { ...current, round: { ...r, guess: g, stake, phase: "revealing" }, scores };
    }
    case "reveal_and_swap": {
      const r = current.round;
      if (!r || r.phase !== "revealing") return current;
      return { ...current, round: null, rounds_played: current.rounds_played + 1 };
    }
    default:
      return current;
  }
}
