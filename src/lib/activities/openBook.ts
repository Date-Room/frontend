/**
 * Open Book — the questions game, rebuilt. You draft TOPICS, not questions:
 * alternating claims from a 12-topic board tagged Warm / Real / Close. Each
 * claimed topic deals exactly three questions, drawn randomly from that
 * topic's pool but always one OPENER, one SPECIFIC, one COSTLY, so every trio
 * escalates no matter the roll. Writing one question of your own replaces a
 * card instead of adding one, and buys you a veto of one topic your date
 * chose (they wrote one too, so one of yours goes the same way). Two passes
 * for the whole night; everything survives to the recap. Questions you two
 * have seen are excluded on later nights.
 *
 * NOTE: retires mobile's `questions` deck wire format on web (parity list).
 */

export type ObHeat = "Warm" | "Real" | "Close";

export type ObTopic = {
  id: string;
  name: string;
  note: string;
  heat: ObHeat;
  /** Rank buckets: the deal takes one from each, in this order. */
  open: string[];
  specific: string[];
  costly: string[];
};

export const OB_TOPICS: ObTopic[] = [
  {
    id: "firsts",
    name: "Firsts",
    note: "Beginnings, and what you remember wrong",
    heat: "Warm",
    open: [
      "What did you think of me in the first ten seconds, honestly?",
      "What do first dates usually get wrong about you?",
      "What's the first thing you notice about a person, truthfully?",
    ],
    specific: [
      "What was the first thing you told someone else about me?",
      "What's a first time you'd love to have again?",
      "What's the best first impression you've ever made, and was it accurate?",
    ],
    costly: [
      "When did you decide this was worth something?",
      "What almost stopped you from being here tonight?",
      "What's a beginning you regret rushing?",
    ],
  },
  {
    id: "work",
    name: "Work & ambition",
    note: "What you're chasing and what it costs",
    heat: "Warm",
    open: [
      "If money stopped mattering on Monday, what would you do by Friday?",
      "What did you want to be at ten years old?",
      "What's the best thing you've ever made or built?",
    ],
    specific: [
      "What part of your work would you never let go of?",
      "What does a genuinely good work day look like for you?",
      "Who do you most want to make proud with your work?",
    ],
    costly: [
      "What have you given up for your career that you still think about?",
      "What ambition are you quietly afraid to say out loud?",
      "If your work disappeared tomorrow, who would you be?",
    ],
  },
  {
    id: "home",
    name: "Home & family",
    note: "Where you're from, and what you kept",
    heat: "Warm",
    open: [
      "What tradition from your childhood do you want to keep?",
      "What smell takes you straight back home?",
      "Who cooked in your house, and what dish do you miss?",
    ],
    specific: [
      "What would your mother warn me about?",
      "What's a family rule you've kept without noticing?",
      "Which relative are you most like, and does that scare you?",
    ],
    costly: [
      "What did your parents teach you about love without ever saying it?",
      "What part of home did you have to leave in order to grow?",
      "What do you want to do differently from how you were raised?",
    ],
  },
  {
    id: "money",
    name: "Money",
    note: "The unromantic one that decides everything",
    heat: "Real",
    open: [
      "What's the best money you've ever spent?",
      "What's the most you'd spend on something nobody else could see the value of?",
      "Saver or spender, and who taught you that?",
    ],
    specific: [
      "Security or freedom, and which have you actually chosen so far?",
      "What's a money habit you'd want a partner to just accept?",
      "What did money feel like in the house you grew up in?",
    ],
    costly: [
      "If we pooled everything, what would worry you first?",
      "What's the most broke you've ever been, and what did it teach you?",
      "What's a financial decision you're still defending to yourself?",
    ],
  },
  {
    id: "past",
    name: "The people before",
    note: "History, without the highlight reel",
    heat: "Real",
    open: [
      "What did the last one get right about you?",
      "What's the kindest thing an ex ever did for you?",
      "What's a lesson you only learned by getting it wrong with someone?",
    ],
    specific: [
      "What pattern of yours keeps showing up in relationships?",
      "What do you do when you start losing interest, honestly?",
      "How do you act when you're hurt: loud, quiet, or gone?",
    ],
    costly: [
      "What did you forgive that you swore you never would?",
      "What's an apology you still owe someone?",
      "What ended the relationship you thought would last?",
    ],
  },
  {
    id: "fear",
    name: "Fear",
    note: "The things you'd rather not name out loud",
    heat: "Real",
    open: [
      "What's a small fear you've never grown out of?",
      "What's the bravest thing you've done that nobody clapped for?",
      "What scared you as a kid that somehow still does?",
    ],
    specific: [
      "What's the version of your future that scares you?",
      "When did you last feel genuinely alone in a room with someone?",
      "What do you do at 3am when you can't sleep?",
    ],
    costly: [
      "What are you most afraid I'll find out?",
      "What fear have you built your life around avoiding?",
      "Who are you afraid of becoming?",
    ],
  },
  {
    id: "body",
    name: "Attraction",
    note: "What pulls you, and why",
    heat: "Close",
    open: [
      "What's the first thing you find attractive in a person, before anything is said?",
      "When do you feel most attractive?",
      "What compliment about your looks do you never get but want?",
    ],
    specific: [
      "What do I do that you find attractive and have never mentioned?",
      "What kind of touch says more than words for you?",
      "What's something unconventional you find completely charming?",
    ],
    costly: [
      "Where do you like being touched that isn't obvious?",
      "What's the difference between wanting someone and wanting to be wanted?",
      "When did you last feel desired the way you wanted to be?",
    ],
  },
  {
    id: "desire",
    name: "Desire",
    note: "Explicit. Choose it on purpose.",
    heat: "Close",
    open: [
      "What's your idea of a perfect slow evening together?",
      "What makes you feel safe enough to want someone?",
      "Flirting: obvious, or barely there?",
    ],
    specific: [
      "What have you wanted to ask me for and haven't?",
      "What's something you'd try only with someone you trusted completely?",
      "What's a yes you've never been asked for?",
    ],
    costly: [
      "What turns you off faster than anything?",
      "What do you want more of that you've never said plainly?",
      "What's the boldest thing you've ever asked for, anywhere?",
    ],
  },
  {
    id: "jealousy",
    name: "Jealousy",
    note: "The feeling everyone claims not to have",
    heat: "Close",
    open: [
      "Are you the jealous type, or the type that pretends not to be?",
      "What's the pettiest jealousy you've ever felt?",
      "Whose life do you envy, honestly?",
    ],
    specific: [
      "When were you last jealous over someone?",
      "What would count as a betrayal even if nothing physical happened?",
      "How much of a partner's past do you actually want to know?",
    ],
    costly: [
      "What does your jealousy look like from the inside?",
      "Have you ever made someone jealous on purpose?",
      "What insecurity does your jealousy guard?",
    ],
  },
  {
    id: "future",
    name: "Us, later",
    note: "Five years out, said plainly",
    heat: "Real",
    open: [
      "Where do you want to be living in five years, specifically?",
      "What does a good ordinary Tuesday look like in your future?",
      "What are you most looking forward to this year?",
    ],
    specific: [
      "What do you need from a partner that you usually don't ask for?",
      "What's non-negotiable in the life you're building?",
      "Kids, pets, plants: what's the honest ranking?",
    ],
    costly: [
      "What would make you walk away from something good?",
      "What part of your future won't you compromise on, even for love?",
      "What scares you about being truly known for a long time?",
    ],
  },
  {
    id: "play",
    name: "Nonsense",
    note: "Light on purpose, a place to breathe",
    heat: "Warm",
    open: [
      "What would your reality show be called?",
      "What's your most defendable useless opinion?",
      "What's the weirdest thing you're quietly excellent at?",
    ],
    specific: [
      "What's the pettiest thing you've ever held against someone?",
      "Which of my habits would you secretly like to ban?",
      "What food crime do you commit regularly and refuse to apologise for?",
    ],
    costly: [
      "What's the most embarrassing thing you've done to impress someone?",
      "What tiny lie do you tell most often?",
      "If we swapped phones for an hour, what would I find first?",
    ],
  },
  {
    id: "faith",
    name: "Belief",
    note: "Meaning, doubt, and what you hope is true",
    heat: "Real",
    open: [
      "What do you believe that you'd struggle to defend?",
      "What are you a little superstitious about?",
      "What restores you when you're empty?",
    ],
    specific: [
      "What have you changed your mind about completely?",
      "What was belief like in your childhood home?",
      "What do you practice, in any sense of the word?",
    ],
    costly: [
      "What do you hope happens after all this?",
      "What doubt do you carry quietly?",
      "What would you need to believe to be at peace?",
    ],
  },
];

export const OB_HEATS: ObHeat[] = ["Warm", "Real", "Close"];
export const OB_REACTIONS = ["❤️", "🥹", "😂", "🤔", "🔥"];
export const OB_PASSES = 2;
export const OB_WRITE_MIN = 6;
export const OB_WRITE_MAX = 240;

export function obTopic(id: string): ObTopic | null {
  return OB_TOPICS.find((t) => t.id === id) ?? null;
}

const heatRank = (h: ObHeat) => OB_HEATS.indexOf(h);
const BUCKETS = ["open", "specific", "costly"] as const;

/** Encode a consumed question as bucket*100 + index (for the seen ledger). */
export const obSeenCode = (bucket: number, index: number) => bucket * 100 + index;

/**
 * Deal three question indices for a topic: one random unseen per bucket, so
 * the trio always runs opener → specific → costly. A drained bucket falls
 * back to any index rather than blocking the draft.
 */
export function rollTopicQuestions(
  topic: ObTopic,
  seen: number[],
  random: () => number = Math.random,
): [number, number, number] {
  const out: number[] = [];
  BUCKETS.forEach((bucket, b) => {
    const pool = topic[bucket];
    const unseen = pool.map((_, i) => i).filter((i) => !seen.includes(obSeenCode(b, i)));
    const from = unseen.length ? unseen : pool.map((_, i) => i);
    out.push(from[Math.floor(random() * from.length)] ?? 0);
  });
  return out as [number, number, number];
}

export type ObPhase = "setup" | "draft" | "write" | "veto" | "play" | "done";

export type ObClaim = { user: string; topic: string; q: [number, number, number] };
export type ObVeto = { binned: string; swap: string; q: [number, number, number] };

/** The listener's ruling on an answer — noticing, not scoring (from Closer). */
export type ObVerdict = "answered" | "half" | "dodged";

export type ObState = {
  phase: ObPhase;
  target: 15 | 21;
  /** Chose the length; drafts first; their written card lands at ~55%. */
  starter_id: string | null;
  claims: ObClaim[];
  writes: Record<string, string>;
  vetoes: Record<string, ObVeto>;
  card: number;
  /** The current card's answerer said "That's my answer" — awaiting a ruling. */
  answered: boolean;
  /** cardIndex (as string) -> the card owner's ruling on the answer. */
  rulings: Record<string, ObVerdict>;
  /** Shared pool: card indices passed on, max OB_PASSES per night. */
  passes: number[];
  /** cardIndex (as string) -> userId -> emoji. */
  reacts: Record<string, Record<string, string>>;
  /** topicId -> consumed seen-codes, preserved across nights. */
  seen: Record<string, number[]>;
  nights: number;
};

export type ObEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function obSlots(target: number): number {
  return Math.round(target / 3);
}

export function initialObState(): ObState {
  return {
    phase: "setup",
    target: 15,
    starter_id: null,
    claims: [],
    writes: {},
    vetoes: {},
    card: 0,
    answered: false,
    rulings: {},
    passes: [],
    reacts: {},
    seen: {},
    nights: 0,
  };
}

export type ObCard = {
  q: string;
  topicName: string;
  heat: ObHeat;
  by: string;
  written?: boolean;
};

/** The night's deck, derived deterministically from shared state. */
export function buildObDeck(state: ObState): ObCard[] {
  const vetoList = Object.values(state.vetoes);
  const effective = state.claims.map((c) => {
    const v = vetoList.find((x) => x.binned === c.topic);
    return v ? { user: c.user, topic: v.swap, q: v.q } : c;
  });
  let cards: ObCard[] = effective.flatMap((c) => {
    const t = obTopic(c.topic);
    if (!t) return [];
    return BUCKETS.map((bucket, b) => ({
      q: t[bucket][c.q[b]] ?? t[bucket][0],
      topicName: t.name,
      heat: t.heat,
      by: c.user,
    }));
  });
  cards = [...cards].sort((a, b) => heatRank(a.heat) - heatRank(b.heat));
  const writers = Object.keys(state.writes);
  const starterFirst = writers.sort((a, b) =>
    a === state.starter_id ? -1 : b === state.starter_id ? 1 : 0,
  );
  starterFirst.forEach((uid, i) => {
    const text = state.writes[uid]?.trim();
    if (!text || cards.length < 3) return;
    const at = i === 0 ? Math.floor(cards.length * 0.55) : cards.length - 2;
    cards[at] = { q: text, topicName: "Written for you", heat: "Close", by: uid, written: true };
  });
  return cards.slice(0, state.target);
}

function takenTopics(state: ObState): Set<string> {
  const s = new Set(state.claims.map((c) => c.topic));
  for (const v of Object.values(state.vetoes)) s.add(v.swap);
  return s;
}

function validQ(topicId: string, q: unknown): q is [number, number, number] {
  const t = obTopic(topicId);
  if (!t || !Array.isArray(q) || q.length !== 3) return false;
  return BUCKETS.every((bucket, b) => {
    const i = q[b];
    return typeof i === "number" && Number.isInteger(i) && i >= 0 && i < t[bucket].length;
  });
}

function consumeSeen(state: ObState): Record<string, number[]> {
  const seen = { ...state.seen };
  const fold = (topicId: string, q: [number, number, number]) => {
    const prev = seen[topicId] ?? [];
    const codes = q.map((idx, b) => obSeenCode(b, idx)).filter((c) => !prev.includes(c));
    seen[topicId] = [...prev, ...codes];
  };
  const vetoList = Object.values(state.vetoes);
  for (const c of state.claims) {
    const v = vetoList.find((x) => x.binned === c.topic);
    if (v) fold(v.swap, v.q);
    else fold(c.topic, c.q);
  }
  return seen;
}

export function reduceOb(current: ObState, event: ObEvent): ObState {
  const me = event.userId;
  switch (event.type) {
    case "choose_length": {
      if (current.phase !== "setup") return current;
      const target = event.payload.target === 21 ? 21 : 15;
      return { ...current, phase: "draft", target, starter_id: me };
    }
    // Alternating claims, starter first. The claimer rolls the three question
    // indices (one per bucket, unseen-first) and carries them in the event so
    // both clients deal the identical deck.
    case "claim": {
      if (current.phase !== "draft" || current.starter_id == null) return current;
      const starterTurn = current.claims.length % 2 === 0;
      if (starterTurn ? me !== current.starter_id : me === current.starter_id) return current;
      const topicId = typeof event.payload.topic === "string" ? event.payload.topic : "";
      if (!obTopic(topicId) || takenTopics(current).has(topicId)) return current;
      if (!validQ(topicId, event.payload.q)) return current;
      const claims = [...current.claims, { user: me, topic: topicId, q: event.payload.q as [number, number, number] }];
      const done = claims.length >= obSlots(current.target);
      return { ...current, claims, phase: done ? "write" : "draft" };
    }
    case "write": {
      if (current.phase !== "write" || me in current.writes) return current;
      const text = typeof event.payload.text === "string" ? event.payload.text.trim() : "";
      if (text.length < OB_WRITE_MIN || text.length > OB_WRITE_MAX) return current;
      const writes = { ...current.writes, [me]: text };
      return { ...current, writes, phase: Object.keys(writes).length >= 2 ? "veto" : "write" };
    }
    // Writing bought you this: bin one topic your date claimed, choose its
    // replacement from the untaken board (with a fresh question roll).
    case "veto": {
      if (current.phase !== "veto" || me in current.vetoes) return current;
      const binned = typeof event.payload.binned === "string" ? event.payload.binned : "";
      const swap = typeof event.payload.swap === "string" ? event.payload.swap : "";
      const target = current.claims.find((c) => c.topic === binned);
      if (!target || target.user === me) return current;
      if (Object.values(current.vetoes).some((v) => v.binned === binned)) return current;
      if (!obTopic(swap) || takenTopics(current).has(swap)) return current;
      if (!validQ(swap, event.payload.q)) return current;
      const vetoes = { ...current.vetoes, [me]: { binned, swap, q: event.payload.q as [number, number, number] } };
      const done = Object.keys(vetoes).length >= 2;
      const next = { ...current, vetoes, phase: done ? ("play" as const) : ("veto" as const), card: 0, answered: false };
      return done ? { ...next, seen: consumeSeen(next) } : next;
    }
    case "react": {
      if (current.phase !== "play" && current.phase !== "done") return current;
      const idx = typeof event.payload.index === "number" ? event.payload.index : -1;
      const emoji = typeof event.payload.emoji === "string" ? event.payload.emoji : "";
      if (idx < 0 || !OB_REACTIONS.includes(emoji)) return current;
      const key = String(idx);
      return {
        ...current,
        reacts: { ...current.reacts, [key]: { ...(current.reacts[key] ?? {}), [me]: emoji } },
      };
    }
    // The Closer mechanic, ported: the card's non-owner answers out loud and
    // says "That's my answer"; only then does the card's OWNER rule it —
    // answered, half of it, or dodged it — and the ruling turns the card.
    case "my_answer": {
      if (current.phase !== "play" || current.answered) return current;
      const idx = typeof event.payload.index === "number" ? event.payload.index : -1;
      if (idx !== current.card) return current;
      const c = buildObDeck(current)[idx];
      if (!c || me === c.by) return current;
      return { ...current, answered: true };
    }
    case "rule": {
      if (current.phase !== "play" || !current.answered) return current;
      const idx = typeof event.payload.index === "number" ? event.payload.index : -1;
      if (idx !== current.card) return current;
      const v = event.payload.verdict;
      if (v !== "answered" && v !== "half" && v !== "dodged") return current;
      const deck = buildObDeck(current);
      const c = deck[idx];
      if (!c || me !== c.by) return current;
      const nextCard = current.card + 1;
      return {
        ...current,
        rulings: { ...current.rulings, [String(idx)]: v },
        answered: false,
        card: nextCard,
        phase: nextCard >= deck.length ? "done" : "play",
      };
    }
    // Legacy advance (pre-rulings clients) still turns the card, un-ruled, so
    // a mixed-version room can't stall.
    case "advance":
    case "pass": {
      if (current.phase !== "play") return current;
      const idx = typeof event.payload.index === "number" ? event.payload.index : -1;
      if (idx !== current.card) return current;
      const isPass = event.type === "pass";
      if (isPass && current.passes.length >= OB_PASSES) return current;
      // Passing is the answerer's move, made before an answer is locked.
      if (isPass && current.answered) return current;
      if (isPass) {
        const c = buildObDeck(current)[idx];
        if (c && me === c.by) return current;
      }
      const deckLen = buildObDeck(current).length;
      const nextCard = current.card + 1;
      return {
        ...current,
        card: nextCard,
        answered: false,
        passes: isPass ? [...current.passes, idx] : current.passes,
        phase: nextCard >= deckLen ? "done" : "play",
      };
    }
    case "restart": {
      if (current.phase !== "done") return current;
      return { ...initialObState(), seen: current.seen, nights: current.nights + 1 };
    }
    default:
      return current;
  }
}

function asStrMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

export function obFromJson(s: Record<string, unknown> | null): ObState {
  if (!s) return initialObState();
  const claims: ObClaim[] = Array.isArray(s.claims)
    ? (s.claims as unknown[]).flatMap((c) => {
        const r = (c ?? {}) as Record<string, unknown>;
        const topic = typeof r.topic === "string" ? r.topic : "";
        return typeof r.user === "string" && validQ(topic, r.q)
          ? [{ user: r.user, topic, q: r.q as [number, number, number] }]
          : [];
      })
    : [];
  const vetoes: Record<string, ObVeto> = {};
  if (s.vetoes && typeof s.vetoes === "object") {
    for (const [k, v] of Object.entries(s.vetoes as Record<string, unknown>)) {
      const r = (v ?? {}) as Record<string, unknown>;
      const swap = typeof r.swap === "string" ? r.swap : "";
      if (typeof r.binned === "string" && validQ(swap, r.q)) {
        vetoes[k] = { binned: r.binned, swap, q: r.q as [number, number, number] };
      }
    }
  }
  const reacts: Record<string, Record<string, string>> = {};
  if (s.reacts && typeof s.reacts === "object") {
    for (const [k, v] of Object.entries(s.reacts as Record<string, unknown>)) {
      reacts[k] = asStrMap(v);
    }
  }
  const seen: Record<string, number[]> = {};
  if (s.seen && typeof s.seen === "object") {
    for (const [k, v] of Object.entries(s.seen as Record<string, unknown>)) {
      if (Array.isArray(v)) seen[k] = v.filter((x): x is number => typeof x === "number");
    }
  }
  const phase = s.phase;
  return {
    phase:
      phase === "draft" || phase === "write" || phase === "veto" || phase === "play" || phase === "done"
        ? phase
        : "setup",
    target: s.target === 21 ? 21 : 15,
    starter_id: typeof s.starter_id === "string" ? s.starter_id : null,
    claims,
    writes: asStrMap(s.writes),
    vetoes,
    card: typeof s.card === "number" && s.card >= 0 ? s.card : 0,
    answered: s.answered === true,
    rulings: (() => {
      const out: Record<string, ObVerdict> = {};
      if (s.rulings && typeof s.rulings === "object") {
        for (const [k, v] of Object.entries(s.rulings as Record<string, unknown>)) {
          if (v === "answered" || v === "half" || v === "dodged") out[k] = v;
        }
      }
      return out;
    })(),
    passes: Array.isArray(s.passes) ? s.passes.filter((x): x is number => typeof x === "number") : [],
    reacts,
    seen,
    nights: typeof s.nights === "number" ? s.nights : 0,
  };
}
