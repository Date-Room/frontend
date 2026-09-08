/**
 * Rank It — five things, each player secretly orders them, then the two
 * rankings reveal side by side. The point is never agreement: the reveal
 * calls out where you're closest and where you're furthest apart, and the
 * furthest-apart item is the conversation.
 *
 * Eight fixed rounds: Saturday → Holiday → Food World → What Matters →
 * Free Time → Irresistible → Green Flags → Your Life. No scoring of any kind.
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
    title: "Food World",
    prompt: "Rank the cuisines you'd happily eat forever.",
    items: [
      { emoji: "🍕", label: "Italian" },
      { emoji: "🍣", label: "Japanese" },
      { emoji: "🌮", label: "Mexican" },
      { emoji: "🍛", label: "Indian" },
      { emoji: "🍔", label: "American" },
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
    title: "Free Time",
    prompt: "Rank how you'd actually spend a free afternoon.",
    items: [
      { emoji: "🎨", label: "Creating something" },
      { emoji: "🏃", label: "Moving / sport" },
      { emoji: "📚", label: "Learning something new" },
      { emoji: "🧑‍🤝‍🧑", label: "Time with people" },
      { emoji: "😴", label: "Pure rest" },
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
    title: "Green Flags",
    prompt: "Rank what wins you over on a first date.",
    items: [
      { emoji: "😄", label: "Makes you laugh early" },
      { emoji: "🎧", label: "Actually listens" },
      { emoji: "💬", label: "Asks good questions" },
      { emoji: "⏰", label: "Shows up on time" },
      { emoji: "✨", label: "Brings the energy" },
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

/**
 * The chaptered reveal's timeline, as stagecraft steps. Chapter 1 reveals
 * the partner's list from last place up (one row per beat), then the clash
 * cards, then the agreement cards, then the settled board.
 */
export function rankRevealSteps(
  rowCount: number,
  clashCount: number,
  agreeCount: number,
): { id: string; at: number }[] {
  const steps: { id: string; at: number }[] = [{ id: "dim", at: 0 }];
  let t = 900;
  for (let k = 1; k <= rowCount; k++) {
    steps.push({ id: `theirs:${k}`, at: t });
    t += 700;
  }
  t += 700; // hold on the completed list
  for (let k = 1; k <= clashCount; k++) {
    steps.push({ id: `clash:${k}`, at: t });
    t += 900;
  }
  t += 600;
  for (let k = 1; k <= agreeCount; k++) {
    steps.push({ id: `agree:${k}`, at: t });
    t += 900;
  }
  steps.push({ id: "board", at: t + 700 });
  return steps;
}

export type RankInsights = {
  /** Item indices with the widest rank gaps, widest first. */
  clashes: number[];
  /** Smallest-gap items excluding the clashes, closest first. */
  agreements: number[];
  /** The single widest-gap item (head of clashes) and its gap. */
  widest: number;
  widestGap: number;
};

/**
 * The reveal chapters' data: top-N clashes and the closest agreements,
 * with clash items excluded from agreements so nothing repeats. Ties break
 * toward the earlier item index — deterministic on both clients.
 */
export function rankInsights(
  a: number[],
  b: number[],
  clashCount = 2,
  agreeCount = 2,
): RankInsights {
  const gaps = a
    .map((_, item) => ({ item, gap: Math.abs(rankOf(a, item) - rankOf(b, item)) }))
    .sort((x, y) => y.gap - x.gap || x.item - y.item);
  const clashes = gaps.slice(0, clashCount).map((g) => g.item);
  const agreements = gaps
    .slice(clashCount)
    .sort((x, y) => x.gap - y.gap || x.item - y.item)
    .slice(0, agreeCount)
    .map((g) => g.item);
  return {
    clashes,
    agreements,
    widest: gaps[0]?.item ?? 0,
    widestGap: gaps[0]?.gap ?? 0,
  };
}
