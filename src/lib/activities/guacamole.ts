/**
 * Guacamole Panic — the ninth game and the first you play with your hands:
 * ingredients fly in, each wants one of four buttons (chop / smash /
 * squeeze / stir), wrong press = splat. A 75-second race against the same
 * seeded ingredient stream on both screens (fair by construction, nothing
 * to sync mid-round).
 *
 * Settled design (2026-09-08): BUTTONS not gestures; progress is broadcast
 * but HIDDEN — your date's face is the progress bar; peeking at their bowl
 * costs YOUR time and is LOUD on their screen; the once-a-round lime steal
 * freezes them for 3 seconds and announces itself. Sneaky mechanics are
 * loud: this game trades in curiosity, not points.
 *
 * Shared reducer holds the ceremony (ready → countdown → cooking → reveal)
 * and the coarse facts (throttled progress pulses, steals, peeks, results);
 * the moment-to-moment cooking loop is local to each client.
 */

export type GuacAction = "chop" | "smash" | "squeeze" | "stir";

export const GUAC_ACTIONS: { id: GuacAction; emoji: string; label: string }[] = [
  { id: "chop", emoji: "🔪", label: "Chop" },
  { id: "smash", emoji: "👊", label: "Smash" },
  { id: "squeeze", emoji: "🍋", label: "Squeeze" },
  { id: "stir", emoji: "🥄", label: "Stir" },
];

export type GuacIngredient = { emoji: string; name: string; action: GuacAction };

export const GUAC_INGREDIENTS: GuacIngredient[] = [
  { emoji: "🥑", name: "Avocado", action: "smash" },
  { emoji: "🧅", name: "Onion", action: "chop" },
  { emoji: "🍅", name: "Tomato", action: "chop" },
  { emoji: "🌶️", name: "Jalapeño", action: "chop" },
  { emoji: "🌿", name: "Cilantro", action: "chop" },
  { emoji: "🍋", name: "Lime", action: "squeeze" },
  { emoji: "🧄", name: "Garlic", action: "smash" },
  { emoji: "🧂", name: "Salt", action: "stir" },
  { emoji: "🥣", name: "The mix", action: "stir" },
];

export const GUAC_ROUND_MS = 75_000;
export const GUAC_COUNTDOWN_MS = 3_500;
export const GUAC_FREEZE_MS = 3_000;
export const GUAC_PEEK_MS = 2_500;
export const GUAC_PEEKS_PER_BATCH = 2;
/** Bowl reads full at this many completed ingredients. */
export const GUAC_BOWL_TARGET = 36;

/** Deterministic PRNG (mulberry32) — same stream on both screens. */
export function guacRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function guacSeed(roomId: string, batch: number): number {
  let h = 2166136261 ^ batch;
  for (let i = 0; i < roomId.length; i++) {
    h ^= roomId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The whole batch's ingredient order, derived up front (no repeats twice
 *  in a row, so the fingers never coast). */
export function guacStream(roomId: string, batch: number, count = 80): GuacIngredient[] {
  const rng = guacRng(guacSeed(roomId, batch));
  const out: GuacIngredient[] = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let pick = Math.floor(rng() * GUAC_INGREDIENTS.length);
    if (pick === last) pick = (pick + 1) % GUAC_INGREDIENTS.length;
    last = pick;
    out.push(GUAC_INGREDIENTS[pick]);
  }
  return out;
}

/** Time allowed for the nth ingredient — the panic ramps. */
export function guacDeadlineMs(index: number): number {
  return Math.max(950, 2300 - index * 45);
}

/** When each player's once-a-batch lime-steal window opens (their own
 *  screen only — the opponent learns the loud way). */
export function guacStealWindow(roomId: string, batch: number, userId: string): { openMs: number; closeMs: number } {
  const rng = guacRng(guacSeed(roomId + "|" + userId, batch));
  const openMs = 20_000 + Math.floor(rng() * 30_000);
  return { openMs, closeMs: openMs + 6_000 };
}

export type GuacPhase = "prep" | "countdown" | "cooking" | "reveal";

export type GuacResult = { score: number; made: number; splats: number };

export type GuacState = {
  phase: GuacPhase;
  /** 0-based batch index — seeds the stream, so every batch is new. */
  batch: number;
  ready: string[];
  /** Shared start instant (ISO) — both clients count to the same clock. */
  start_at: string | null;
  /** userId -> bowl fill 0..1. Broadcast, HIDDEN in UI except via peek. */
  progress: Record<string, number>;
  results: Record<string, GuacResult>;
  /** userIds who stole the lime this batch (once each, loud). */
  steals: string[];
  /** userId -> peeks used this batch (loud on the other screen). */
  peeks: Record<string, number>;
  batches_played: number;
};

export type GuacEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialGuacState(): GuacState {
  return {
    phase: "prep",
    batch: 0,
    ready: [],
    start_at: null,
    progress: {},
    results: {},
    steals: [],
    peeks: {},
    batches_played: 0,
  };
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function guacFromJson(s: Record<string, unknown> | null): GuacState {
  if (!s) return initialGuacState();
  const phase = s.phase;
  const progress: Record<string, number> = {};
  if (s.progress && typeof s.progress === "object") {
    for (const [k, v] of Object.entries(s.progress as Record<string, unknown>)) {
      if (typeof v === "number") progress[k] = Math.max(0, Math.min(1, v));
    }
  }
  const results: Record<string, GuacResult> = {};
  if (s.results && typeof s.results === "object") {
    for (const [k, v] of Object.entries(s.results as Record<string, unknown>)) {
      const r = (v ?? {}) as Record<string, unknown>;
      results[k] = { score: num(r.score), made: num(r.made), splats: num(r.splats) };
    }
  }
  const peeks: Record<string, number> = {};
  if (s.peeks && typeof s.peeks === "object") {
    for (const [k, v] of Object.entries(s.peeks as Record<string, unknown>)) {
      if (typeof v === "number") peeks[k] = v;
    }
  }
  return {
    phase:
      phase === "countdown" || phase === "cooking" || phase === "reveal" ? phase : "prep",
    batch: Math.max(0, num(s.batch)),
    ready: Array.isArray(s.ready) ? s.ready.filter((x): x is string => typeof x === "string") : [],
    start_at: typeof s.start_at === "string" ? s.start_at : null,
    progress,
    results,
    steals: Array.isArray(s.steals) ? s.steals.filter((x): x is string => typeof x === "string") : [],
    peeks,
    batches_played: num(s.batches_played),
  };
}

export function reduceGuac(current: GuacState, event: GuacEvent): GuacState {
  const me = event.userId;
  const batch = typeof event.payload.batch === "number" ? event.payload.batch : null;

  switch (event.type) {
    case "ready": {
      if (current.phase !== "prep" || batch !== current.batch) return current;
      if (current.ready.includes(me)) return current;
      const ready = [...current.ready, me];
      if (ready.length >= 2) {
        // The completing ready carries the shared start instant, so both
        // clients derive the identical clock from the same event.
        const at = typeof event.payload.start_at === "string" ? event.payload.start_at : null;
        return {
          ...current,
          ready,
          phase: "countdown",
          start_at: at ?? new Date(Date.now() + GUAC_COUNTDOWN_MS).toISOString(),
        };
      }
      return { ...current, ready };
    }
    // Local clocks flip countdown→cooking; the event makes it durable for
    // late hydrators. Either player's begin is accepted once.
    case "begin": {
      if (current.phase !== "countdown" || batch !== current.batch) return current;
      return { ...current, phase: "cooking" };
    }
    case "pulse": {
      if (current.phase !== "cooking" || batch !== current.batch) return current;
      const pct = Math.max(0, Math.min(1, num(event.payload.pct)));
      if (current.progress[me] === pct) return current;
      return { ...current, progress: { ...current.progress, [me]: pct } };
    }
    case "steal": {
      if (current.phase !== "cooking" || batch !== current.batch) return current;
      if (current.steals.includes(me)) return current; // once each, ever loud
      return { ...current, steals: [...current.steals, me] };
    }
    case "peek": {
      if (current.phase !== "cooking" || batch !== current.batch) return current;
      const used = current.peeks[me] ?? 0;
      if (used >= GUAC_PEEKS_PER_BATCH) return current;
      return { ...current, peeks: { ...current.peeks, [me]: used + 1 } };
    }
    case "finish": {
      if ((current.phase !== "cooking" && current.phase !== "countdown") || batch !== current.batch)
        return current;
      if (current.results[me]) return current;
      const results = {
        ...current.results,
        [me]: {
          score: Math.max(0, num(event.payload.score)),
          made: Math.max(0, num(event.payload.made)),
          splats: Math.max(0, num(event.payload.splats)),
        },
      };
      return {
        ...current,
        results,
        progress: { ...current.progress, [me]: Math.max(0, Math.min(1, num(event.payload.pct))) },
        phase: Object.keys(results).length >= 2 ? "reveal" : current.phase,
      };
    }
    // Escape hatch when the partner never finishes (left mid-batch): the
    // player who DID finish may pull the reveal after their own result.
    case "force_reveal": {
      if (current.phase !== "cooking" || batch !== current.batch) return current;
      if (!current.results[me]) return current;
      return { ...current, phase: "reveal" };
    }
    case "next_batch": {
      if (current.phase !== "reveal" || batch !== current.batch) return current;
      return {
        ...initialGuacState(),
        batch: current.batch + 1,
        batches_played: current.batches_played + 1,
      };
    }
    default:
      return current;
  }
}
