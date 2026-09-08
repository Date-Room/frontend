/**
 * One Has To Go — four options, each player secretly eliminates one, then
 * guesses which one their date eliminated before the reveal. No compatibility
 * scoring: the running tally counts "reads" (correct guesses about the other
 * person), which measures how well you're figuring each other out.
 *
 * Round flow: cutting → guessing → revealing → next_round. Content is a fixed
 * five-round arc that escalates from food to the dangerous one.
 */

export type OhtgOption = { emoji: string; label: string };

export type OhtgRound = {
  title: string;
  /** Shown under the title while cutting. */
  lead: string;
  options: OhtgOption[];
  /** Reveal line when the two cuts differ. */
  clashLine: string;
  /** Reveal line when both cut the same option. */
  matchLine: string;
};

export const OHTG_ROUNDS: OhtgRound[] = [
  {
    title: "Food",
    lead: "One of these is gone forever.",
    options: [
      { emoji: "🍕", label: "Pizza" },
      { emoji: "🍔", label: "Burgers" },
      { emoji: "🌮", label: "Tacos" },
      { emoji: "🍣", label: "Sushi" },
    ],
    clashLine: "Defend your decision.",
    matchLine: "Same instinct. Suspiciously aligned.",
  },
  {
    title: "Weekend",
    lead: "Your weekends lose one of these.",
    options: [
      { emoji: "🎬", label: "Movies" },
      { emoji: "🍽️", label: "Restaurants" },
      { emoji: "🎮", label: "Gaming" },
      { emoji: "✈️", label: "Travelling" },
    ],
    clashLine: "Now you know what a weekend together looks like.",
    matchLine: "Two people, one weekend. This could work.",
  },
  {
    title: "Technology",
    lead: "One device vanishes tomorrow.",
    options: [
      { emoji: "📱", label: "Smartphone" },
      { emoji: "📺", label: "Netflix" },
      { emoji: "🎮", label: "Video games" },
      { emoji: "💻", label: "Laptop" },
    ],
    clashLine: "Someone here has priorities.",
    matchLine: "Same sacrifice. Interesting.",
  },
  {
    title: "Life",
    lead: "The big four. One has to go.",
    options: [
      { emoji: "💰", label: "Wealth" },
      { emoji: "❤️", label: "Love" },
      { emoji: "🌍", label: "Travel" },
      { emoji: "🎯", label: "Career success" },
    ],
    clashLine: "Interesting… why?",
    matchLine: "You'd give up the same thing. Worth talking about.",
  },
  {
    title: "The Dangerous One",
    lead: "There is no right answer. Choose anyway.",
    options: [
      { emoji: "😂", label: "Someone who makes you laugh" },
      { emoji: "❤️", label: "Someone who understands you" },
      { emoji: "🔥", label: "Someone you're incredibly attracted to" },
      { emoji: "🛡️", label: "Someone you completely trust" },
    ],
    clashLine: "You two need to talk about this one.",
    matchLine: "Rare agreement on the impossible question.",
  },
];

export type OhtgPhase = "cutting" | "guessing" | "revealing";

export type OhtgState = {
  /** 0-based round index; >= OHTG_ROUNDS.length means the arc is finished. */
  round: number;
  phase: OhtgPhase;
  /** userId -> option index that player eliminated this round. */
  cuts: Record<string, number>;
  /** userId -> that player's guess at what their date eliminated. */
  guesses: Record<string, number>;
  /** userId -> running count of correct guesses across the whole game. */
  reads: Record<string, number>;
  rounds_played: number;
};

export type OhtgEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialOhtgState(): OhtgState {
  return { round: 0, phase: "cutting", cuts: {}, guesses: {}, reads: {}, rounds_played: 0 };
}

function asIndexMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isInteger(val) && val >= 0) out[k] = val;
  }
  return out;
}

export function ohtgFromJson(s: Record<string, unknown> | null): OhtgState {
  if (!s) return initialOhtgState();
  return {
    round: typeof s.round === "number" && s.round >= 0 ? s.round : 0,
    phase: s.phase === "guessing" || s.phase === "revealing" ? s.phase : "cutting",
    cuts: asIndexMap(s.cuts),
    guesses: asIndexMap(s.guesses),
    reads: asIndexMap(s.reads),
    rounds_played: typeof s.rounds_played === "number" ? s.rounds_played : 0,
  };
}

export function ohtgIsFinished(state: OhtgState): boolean {
  return state.round >= OHTG_ROUNDS.length;
}

function optionCount(round: number): number {
  return OHTG_ROUNDS[round]?.options.length ?? 0;
}

export function reduceOhtg(current: OhtgState, event: OhtgEvent): OhtgState {
  const me = event.userId;
  const evRound = typeof event.payload.round === "number" ? event.payload.round : null;
  const option = typeof event.payload.option === "number" ? event.payload.option : null;

  switch (event.type) {
    case "cut": {
      if (ohtgIsFinished(current) || current.phase !== "cutting") return current;
      if (evRound !== current.round) return current;
      if (option == null || option < 0 || option >= optionCount(current.round)) return current;
      if (me in current.cuts) return current;
      // Date rooms hold two players; a late third voice can't join a round
      // that already has both cuts.
      if (Object.keys(current.cuts).length >= 2) return current;
      const cuts = { ...current.cuts, [me]: option };
      const bothCut = Object.keys(cuts).length >= 2;
      return { ...current, cuts, phase: bothCut ? "guessing" : "cutting" };
    }
    case "guess": {
      if (current.phase !== "guessing") return current;
      if (evRound !== current.round) return current;
      if (option == null || option < 0 || option >= optionCount(current.round)) return current;
      if (!(me in current.cuts) || me in current.guesses) return current;
      const guesses = { ...current.guesses, [me]: option };
      const players = Object.keys(current.cuts);
      const bothGuessed = players.every((p) => p in guesses);
      if (!bothGuessed) return { ...current, guesses };
      const reads = { ...current.reads };
      for (const p of players) {
        const partner = players.find((q) => q !== p);
        if (partner != null && guesses[p] === current.cuts[partner]) {
          reads[p] = (reads[p] ?? 0) + 1;
        }
      }
      return { ...current, guesses, reads, phase: "revealing" };
    }
    case "next_round": {
      if (current.phase !== "revealing") return current;
      if (evRound !== current.round) return current;
      return {
        ...current,
        round: current.round + 1,
        phase: "cutting",
        cuts: {},
        guesses: {},
        rounds_played: current.rounds_played + 1,
      };
    }
    case "restart": {
      if (!ohtgIsFinished(current)) return current;
      return initialOhtgState();
    }
    default:
      return current;
  }
}
