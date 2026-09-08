/**
 * Rank It — five things, each player secretly orders them, then the two
 * rankings reveal side by side. The point is never agreement: the reveal
 * calls out where you're closest and where you're furthest apart, and the
 * furthest-apart item is the conversation.
 *
 * Five fixed rounds: Saturday → Holiday → What Matters → Irresistible →
 * Your Life. No scoring of any kind.
 */

export type RankItem = { emoji: string; label: string };

export type RankRound = {
  title: string;
  /** The instruction line, phrased playfully (never "rate your partner"). */
  prompt: string;
  items: RankItem[];
};

export const RANK_ROUNDS: RankRound[] = [
  {
    title: "Saturday",
    prompt: "Rank your perfect Saturday, best first.",
    items: [
      { emoji: "🥾", label: "Adventure" },
      { emoji: "🍿", label: "Movies" },
      { emoji: "🍽️", label: "Restaurant" },
      { emoji: "🎮", label: "Gaming" },
      { emoji: "🎉", label: "Party" },
    ],
  },
  {
    title: "Holiday",
    prompt: "Rank your ideal holiday, best first.",
    items: [
      { emoji: "🏝️", label: "Beach resort" },
      { emoji: "🏙️", label: "Big city" },
      { emoji: "🏔️", label: "Mountains" },
      { emoji: "🎒", label: "Backpacking" },
      { emoji: "🚗", label: "Road trip" },
    ],
  },
  {
    title: "What Matters",
    prompt: "Rank these by importance in your life.",
    items: [
      { emoji: "❤️", label: "Relationships" },
      { emoji: "💰", label: "Financial security" },
      { emoji: "🧠", label: "Personal growth" },
      { emoji: "🌍", label: "Adventure" },
      { emoji: "🏆", label: "Achievement" },
    ],
  },
  {
    title: "Irresistible",
    prompt: "What makes someone irresistible to you? Rank it.",
    items: [
      { emoji: "😂", label: "Funny" },
      { emoji: "🧠", label: "Intelligent" },
      { emoji: "❤️", label: "Kind" },
      { emoji: "🔥", label: "Attractive" },
      { emoji: "🎯", label: "Ambitious" },
    ],
  },
  {
    title: "Your Life",
    prompt: "Rank what you'd most like your life to have.",
    items: [
      { emoji: "🌍", label: "Travel" },
      { emoji: "❤️", label: "Love" },
      { emoji: "👨‍👩‍👧", label: "Family" },
      { emoji: "💰", label: "Wealth" },
      { emoji: "🎯", label: "Purpose" },
    ],
  },
];

export type RankPhase = "ranking" | "revealing";

export type RankItState = {
  /** 0-based round index; >= RANK_ROUNDS.length means the arc is finished. */
  round: number;
  phase: RankPhase;
  /** userId -> item indices in that player's order (position 0 = rank 1). */
  rankings: Record<string, number[]>;
  rounds_played: number;
};

export type RankItEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialRankItState(): RankItState {
  return { round: 0, phase: "ranking", rankings: {}, rounds_played: 0 };
}

function isPermutation(v: unknown, n: number): v is number[] {
  if (!Array.isArray(v) || v.length !== n) return false;
  const seen = new Set<number>();
  for (const x of v) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 0 || x >= n || seen.has(x)) return false;
    seen.add(x);
  }
  return true;
}

export function rankItFromJson(s: Record<string, unknown> | null): RankItState {
  if (!s) return initialRankItState();
  const round = typeof s.round === "number" && s.round >= 0 ? s.round : 0;
  const n = RANK_ROUNDS[round]?.items.length ?? 5;
  const rankings: Record<string, number[]> = {};
  if (s.rankings && typeof s.rankings === "object") {
    for (const [k, v] of Object.entries(s.rankings as Record<string, unknown>)) {
      if (isPermutation(v, n)) rankings[k] = v;
    }
  }
  return {
    round,
    phase: s.phase === "revealing" ? "revealing" : "ranking",
    rankings,
    rounds_played: typeof s.rounds_played === "number" ? s.rounds_played : 0,
  };
}

export function rankItIsFinished(state: RankItState): boolean {
  return state.round >= RANK_ROUNDS.length;
}

export function reduceRankIt(current: RankItState, event: RankItEvent): RankItState {
  const me = event.userId;
  const evRound = typeof event.payload.round === "number" ? event.payload.round : null;

  switch (event.type) {
    case "submit_ranking": {
      if (rankItIsFinished(current) || current.phase !== "ranking") return current;
      if (evRound !== current.round) return current;
      const n = RANK_ROUNDS[current.round]?.items.length ?? 0;
      if (!isPermutation(event.payload.order, n)) return current;
      if (me in current.rankings) return current;
      // Date rooms hold two players; a late third voice can't join a round
      // that already has both rankings.
      if (Object.keys(current.rankings).length >= 2) return current;
      const rankings = { ...current.rankings, [me]: event.payload.order };
      const both = Object.keys(rankings).length >= 2;
      return { ...current, rankings, phase: both ? "revealing" : "ranking" };
    }
    case "next_round": {
      if (current.phase !== "revealing") return current;
      if (evRound !== current.round) return current;
      return {
        ...current,
        round: current.round + 1,
        phase: "ranking",
        rankings: {},
        rounds_played: current.rounds_played + 1,
      };
    }
    case "restart": {
      if (!rankItIsFinished(current)) return current;
      return initialRankItState();
    }
    default:
      return current;
  }
}

/** 1-based rank of item `item` in `order` (position 0 = rank 1). */
export function rankOf(order: number[], item: number): number {
  return order.indexOf(item) + 1;
}

/**
 * The reveal's two callouts: the item you two placed closest together and
 * the one furthest apart. Ties break toward the earlier item so the result
 * is stable across both clients.
 */
export function compareRankings(
  a: number[],
  b: number[],
): { closest: number; furthest: number; furthestGap: number } {
  let closest = 0;
  let furthest = 0;
  let minGap = Number.POSITIVE_INFINITY;
  let maxGap = -1;
  for (let item = 0; item < a.length; item++) {
    const gap = Math.abs(rankOf(a, item) - rankOf(b, item));
    if (gap < minGap) {
      minGap = gap;
      closest = item;
    }
    if (gap > maxGap) {
      maxGap = gap;
      furthest = item;
    }
  }
  return { closest, furthest, furthestGap: maxGap };
}
