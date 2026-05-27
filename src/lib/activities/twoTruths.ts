/**
 * 2 Truths and a Lie — TS port of mobile's `two_truths_module.dart`.
 * Storyteller writes 3 statements + marks the lie; the other guesses; reveal,
 * score, swap roles.
 */

export type TwoTruthsPhase = "composing" | "guessing" | "revealing";

export type TwoTruthsRound = {
  storyteller_id: string;
  statements: string[] | null;
  lie_index: number | null;
  guess: number | null;
  phase: TwoTruthsPhase;
} | null;

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
        round: { storyteller_id: me, statements: null, lie_index: null, guess: null, phase: "composing" },
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
    case "guess": {
      const r = current.round;
      if (!r || r.phase !== "guessing" || me === r.storyteller_id) return current;
      const g = typeof event.payload.guess === "number" ? event.payload.guess : null;
      if (g == null || g < 0 || g > 2) return current;
      const scores = { ...current.scores };
      if (g === r.lie_index) scores[me] = (scores[me] ?? 0) + 1;
      return { ...current, round: { ...r, guess: g, phase: "revealing" }, scores };
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
