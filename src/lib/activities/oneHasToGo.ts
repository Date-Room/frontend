/**
 * One Has To Go — four options, each player secretly eliminates one, then
 * guesses which one their date eliminated before the reveal. No compatibility
 * scoring: the running tally counts "reads" (correct guesses about the other
 * person), which measures how well you're figuring each other out.
 *
 * Round flow: cutting → guessing → revealing → next_round. Content is a fixed
 * ten-round arc that escalates from food to the dangerous one.
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
    title: "Drinks",
    lead: "One of these never touches your lips again.",
    options: [
      { emoji: "☕", label: "Coffee" },
      { emoji: "🍵", label: "Tea" },
      { emoji: "🍷", label: "Wine" },
      { emoji: "🥤", label: "Soft drinks" },
    ],
    clashLine: "Defend your beverage.",
    matchLine: "Same sacrifice. The bar just got simpler.",
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
    title: "Entertainment",
    lead: "One art form leaves your life entirely.",
    options: [
      { emoji: "🎵", label: "Music" },
      { emoji: "📚", label: "Books" },
      { emoji: "🎬", label: "Films" },
      { emoji: "📺", label: "Series" },
    ],
    clashLine: "Now you know what their evenings look like.",
    matchLine: "Culturally compatible. Or culturally ruthless.",
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
    title: "Getaways",
    lead: "One kind of trip you can never take again.",
    options: [
      { emoji: "🏖️", label: "Beach week" },
      { emoji: "🏔️", label: "Mountain cabin" },
      { emoji: "🏙️", label: "City break" },
      { emoji: "🛣️", label: "Road trip" },
    ],
    clashLine: "Someone just lost their dream holiday.",
    matchLine: "Same map, fewer arguments.",
  },
  {
    title: "Little Joys",
    lead: "A small pleasure disappears forever.",
    options: [
      { emoji: "🛏️", label: "Sleeping in" },
      { emoji: "🚿", label: "Long hot showers" },
      { emoji: "🍫", label: "Midnight snacks" },
      { emoji: "🌅", label: "Golden hour walks" },
    ],
    clashLine: "This says more than it should.",
    matchLine: "You'd both suffer the same way. Sweet.",
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
    title: "Date Night",
    lead: "One of these date nights is off the table for good.",
    options: [
      { emoji: "🍳", label: "Cooking together" },
      { emoji: "🕯️", label: "Fancy dinner out" },
      { emoji: "🛋️", label: "Movie night in" },
      { emoji: "🎢", label: "A spontaneous adventure" },
    ],
    clashLine: "Useful intel for date number two.",
    matchLine: "Planning the next one just got easy.",
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

/**
 * The reveal's beat timeline: your guess pins → their cut stamps down →
 * the read verdict → did they read you → settle. Pacing tightens as the
 * arc deepens — full theatre while the rhythm is new, quicker stamps by
 * the time the stakes are high (ten rounds of slow reveals would drag).
 */
export function ohtgRevealSteps(round: number): { id: string; at: number }[] {
  const factor = round <= 2 ? 1 : round <= 5 ? 0.72 : 0.5;
  const base: [string, number][] = [
    ["pin", 0],
    ["stamp", 1000],
    ["verdict", 2200],
    ["mirror", 3100],
    ["settle", 3900],
  ];
  return base.map(([id, at]) => ({ id, at: Math.round(at * factor) }));
}

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
