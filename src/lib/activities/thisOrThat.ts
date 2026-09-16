/**
 * This or That — the run redesign. Five pairs per run, escalating Easy →
 * Closer → Loaded. A 7-second clock pressures the pick (expiring costs
 * nothing — it exists to stop deliberation, and the hesitation itself is
 * recorded as the insight). After picking, you PREDICT your date's side
 * before the reveal, so every round answers two things: do we want the same
 * thing, and do I actually know them. Authored split/together lines per
 * pair; a persistent board ends the run.
 *
 * NOTE: replaces the catalog-pairs version (mobile's this_or_that wire
 * format) — web↔mobile games diverge until mobile ports the run (parity
 * list). Content lives here now, not in /api/catalog.
 */

export type TotSide = "a" | "b";

export type TotPair = {
  tier: "Easy" | "Closer" | "Loaded";
  a: { emoji: string; label: string };
  b: { emoji: string; label: string };
  /** Authored lines — a split on a loaded pair names its cost. */
  split: string;
  together: string;
};

export const TOT_ROUNDS_PER_RUN = 5;
export const TOT_CLOCK_SECONDS = 7;

export const TOT_SETS: TotPair[][] = [
  [
    {
      tier: "Easy",
      a: { emoji: "🏔️", label: "Mountains" },
      b: { emoji: "🌊", label: "Ocean" },
      split: "One of you wants height. One of you wants horizon.",
      together: "Same landscape. Easy start.",
    },
    {
      tier: "Easy",
      a: { emoji: "⚡", label: "Text back instantly" },
      b: { emoji: "🌙", label: "Take your time" },
      split: "This is the one you argue about without naming it.",
      together: "You both answer at the same speed. Rare.",
    },
    {
      tier: "Closer",
      a: { emoji: "🎉", label: "Loud birthday, everyone there" },
      b: { emoji: "🕯️", label: "Just the two of us" },
      split: "One of you celebrates outward. One of you celebrates inward.",
      together: "You'd spend the same night the same way.",
    },
    {
      tier: "Closer",
      a: { emoji: "🗺️", label: "Tell me everything" },
      b: { emoji: "🌫️", label: "Keep a little mystery" },
      split: "One of you wants the whole map. The other wants some fog.",
      together: "You agree on how much of each other to keep.",
    },
    {
      tier: "Loaded",
      a: { emoji: "✈️", label: "Move for love" },
      b: { emoji: "🌳", label: "Stay for roots" },
      split: "This one has a real cost. Say the cost out loud.",
      together: "You'd pack, or stay, together.",
    },
  ],
  [
    {
      tier: "Easy",
      a: { emoji: "🌅", label: "Early mornings" },
      b: { emoji: "🌃", label: "Late nights" },
      split: "Your best hours don't overlap. Yet.",
      together: "You run on the same clock.",
    },
    {
      tier: "Easy",
      a: { emoji: "🎒", label: "Plan every day" },
      b: { emoji: "🎲", label: "Wing the whole trip" },
      split: "One itinerary, one open road. Pick the driver.",
      together: "You'd travel well together. Probably.",
    },
    {
      tier: "Closer",
      a: { emoji: "🗣️", label: "Fight it out tonight" },
      b: { emoji: "🛌", label: "Sleep on it first" },
      split: "One of you needs the storm. One of you needs the calm first.",
      together: "You handle the hard nights the same way.",
    },
    {
      tier: "Closer",
      a: { emoji: "💼", label: "Dream job, brutal hours" },
      b: { emoji: "🏖️", label: "Fine job, full life" },
      split: "One of you is building. One of you is living. Talk about the timeline.",
      together: "You'd spend the years the same way.",
    },
    {
      tier: "Loaded",
      a: { emoji: "👪", label: "Big family table" },
      b: { emoji: "🚪", label: "Small circle, deep roots" },
      split: "Different sized futures. Worth saying now.",
      together: "You're imagining the same table.",
    },
  ],
  [
    {
      tier: "Easy",
      a: { emoji: "🍳", label: "Cook together" },
      b: { emoji: "🛵", label: "Order in" },
      split: "One kitchen, two philosophies.",
      together: "Dinner is settled forever.",
    },
    {
      tier: "Easy",
      a: { emoji: "📵", label: "Phones away at dinner" },
      b: { emoji: "📱", label: "Phones on the table" },
      split: "One of you guards the hour. One of you shares it.",
      together: "Same table manners. Lucky.",
    },
    {
      tier: "Closer",
      a: { emoji: "💬", label: "Say it the moment you feel it" },
      b: { emoji: "⏳", label: "Wait until you're sure" },
      split: "One heart runs hot, one runs careful. Neither is wrong.",
      together: "You'd find out at the same time.",
    },
    {
      tier: "Closer",
      a: { emoji: "🎭", label: "Together every weekend" },
      b: { emoji: "🧭", label: "Keep some weekends yours" },
      split: "Closeness and air. Name your mix.",
      together: "You want the same amount of us.",
    },
    {
      tier: "Loaded",
      a: { emoji: "💍", label: "Know within a year" },
      b: { emoji: "🌱", label: "Let it take the time it takes" },
      split: "Two clocks, one question. Say the real numbers.",
      together: "Your timelines already match.",
    },
  ],
];

export function totSetForRun(run: number): TotPair[] {
  return TOT_SETS[((run % TOT_SETS.length) + TOT_SETS.length) % TOT_SETS.length];
}

export type TotPhase = "picking" | "revealing";

export type TotRoundRecord = {
  picks: Record<string, TotSide>;
  predictions: Record<string, TotSide>;
  /** Decision time per player, ms from seeing the pair to picking. */
  ms: Record<string, number>;
};

export type TotState = {
  /** Completed runs — rotates the pair set. */
  run: number;
  /** 0-based round in the run; >= TOT_ROUNDS_PER_RUN means the board. */
  round: number;
  phase: TotPhase;
  picks: Record<string, TotSide>;
  predictions: Record<string, TotSide>;
  ms: Record<string, number>;
  /** Correct predictions this run, per player. */
  reads: Record<string, number>;
  same_count: number;
  /** Finished rounds this run, for the persistent board. */
  log: TotRoundRecord[];
};

export type TotEvent = { type: string; payload: Record<string, unknown>; userId: string };

const MAX_MS = 60000;

export function initialTotState(): TotState {
  return {
    run: 0,
    round: 0,
    phase: "picking",
    picks: {},
    predictions: {},
    ms: {},
    reads: {},
    same_count: 0,
    log: [],
  };
}

export function totRunDone(s: TotState): boolean {
  return s.round >= TOT_ROUNDS_PER_RUN;
}

function asSideMap(v: unknown): Record<string, TotSide> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, TotSide> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === "a" || val === "b") out[k] = val;
  }
  return out;
}

function asNumMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && val >= 0) out[k] = Math.min(val, MAX_MS);
  }
  return out;
}

export function totFromJson(s: Record<string, unknown> | null): TotState {
  if (!s) return initialTotState();
  const log: TotRoundRecord[] = Array.isArray(s.log)
    ? (s.log as unknown[]).map((r) => {
        const rec = (r ?? {}) as Record<string, unknown>;
        return { picks: asSideMap(rec.picks), predictions: asSideMap(rec.predictions), ms: asNumMap(rec.ms) };
      })
    : [];
  return {
    run: typeof s.run === "number" && s.run >= 0 ? s.run : 0,
    round: typeof s.round === "number" && s.round >= 0 ? s.round : 0,
    phase: s.phase === "revealing" ? "revealing" : "picking",
    picks: asSideMap(s.picks),
    predictions: asSideMap(s.predictions),
    ms: asNumMap(s.ms),
    reads: asNumMap(s.reads),
    same_count: typeof s.same_count === "number" ? s.same_count : 0,
    log,
  };
}

export function reduceTot(current: TotState, event: TotEvent): TotState {
  const me = event.userId;
  const evRound = typeof event.payload.round === "number" ? event.payload.round : null;
  const side = event.payload.side === "a" || event.payload.side === "b" ? event.payload.side : null;

  switch (event.type) {
    case "pick": {
      if (totRunDone(current) || current.phase !== "picking") return current;
      if (evRound !== current.round || side == null) return current;
      if (me in current.picks || Object.keys(current.picks).length >= 2) return current;
      const rawMs = typeof event.payload.ms === "number" ? event.payload.ms : 0;
      return {
        ...current,
        picks: { ...current.picks, [me]: side },
        ms: { ...current.ms, [me]: Math.max(0, Math.min(rawMs, MAX_MS)) },
      };
    }
    // Call their side before you see it. When both players have picked AND
    // predicted, the reveal computes reads and same-side in one step.
    case "predict": {
      if (totRunDone(current) || current.phase !== "picking") return current;
      if (evRound !== current.round || side == null) return current;
      if (!(me in current.picks) || me in current.predictions) return current;
      const predictions = { ...current.predictions, [me]: side };
      const players = Object.keys(current.picks);
      const done = players.length >= 2 && players.every((p) => p in predictions);
      if (!done) return { ...current, predictions };
      const reads = { ...current.reads };
      for (const p of players) {
        const partner = players.find((q) => q !== p);
        if (partner && predictions[p] === current.picks[partner]) reads[p] = (reads[p] ?? 0) + 1;
      }
      const [x, y] = players;
      const same = x != null && y != null && current.picks[x] === current.picks[y];
      return {
        ...current,
        predictions,
        reads,
        same_count: current.same_count + (same ? 1 : 0),
        phase: "revealing",
      };
    }
    case "next_round": {
      if (current.phase !== "revealing" || evRound !== current.round) return current;
      return {
        ...current,
        round: current.round + 1,
        phase: "picking",
        log: [...current.log, { picks: current.picks, predictions: current.predictions, ms: current.ms }],
        picks: {},
        predictions: {},
        ms: {},
      };
    }
    case "new_run": {
      if (!totRunDone(current)) return current;
      return { ...initialTotState(), run: current.run + 1 };
    }
    default:
      return current;
  }
}
