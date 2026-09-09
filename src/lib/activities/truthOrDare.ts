/**
 * Truth or Dare — the night redesign. Your date deals and DECIDES truth or
 * dare for you (you never pick your own card, that asymmetry is the game).
 * The deck escalates across three named heats (Warm → Bold → Bare), stakes
 * are take / double (two tokens) / burn (two per night), the judge rules
 * delivered or dodged, and everything avoided lands in a Vault that reopens
 * at the end of the night as the conversation.
 *
 * Card ids 0-99 are kept from the original pool (truths 0-49, dares 50-99);
 * heat tiers are authored over those ids so content stays stable. NOTE: the
 * v1 hands/skips/trades wire format (mobile's tod_module) is retired on web;
 * a web↔mobile Truth or Dare game is incompatible until mobile ports this.
 */

export type TodKind = "truth" | "dare";
export type TodCard = { id: number; kind: TodKind; text: string };
export type TodHeat = 1 | 2 | 3;

export const TOD_HEATS: Record<TodHeat, { name: string; note: string }> = {
  1: { name: "Warm", note: "Easy in. Nothing to lose yet." },
  2: { name: "Bold", note: "The deck stops being polite." },
  3: { name: "Bare", note: "Last heat. No hiding." },
};

/** Turns per heat (one per player), so a night is 6 cards. */
export const TOD_TURNS_PER_HEAT = 2;
export const TOD_NIGHT_TURNS = TOD_TURNS_PER_HEAT * 3;
export const TOD_BURNS_PER_NIGHT = 2;

const TRUTHS = [
  "What first made you trust me?",
  "When did you know you liked me?",
  "What is something you have not told anyone in years?",
  "What part of me are you most attracted to right now?",
  "What did you almost say tonight but held back?",
  "When did you last cry, and why?",
  "What is your most embarrassing memory with me?",
  "What is a small thing I do that you love?",
  "What is a fear you want me to know about?",
  "What do you wish I asked you more often?",
  "What is something you are proud of but never brag about?",
  "What would you change about today if you could?",
  "What memory of us replays in your head the most?",
  "What is a compliment you have been holding back?",
  "What do you think I do not notice about you?",
  "What story from your childhood would I have loved?",
  "What part of your day did you want to tell me about?",
  "What is your favourite version of me to spend time with?",
  "What is a habit of mine you secretly enjoy?",
  "When did you last feel completely yourself with me?",
  "What would make this week feel like a win?",
  "What song reminds you of us, and why?",
  "What did your past self want that you now have?",
  "What is a promise I have kept that mattered to you?",
  "What do you want to be brave enough to ask me?",
  "What did I do this week that made you smile alone?",
  "What is one thing you wish you could do over with me?",
  "What part of your future do you most want to share with me?",
  "When have you felt closest to me?",
  "What do you wish I would teach you?",
  "What is a tiny detail about me that you remember?",
  "What did you fall for in the first month?",
  "What surprises you about how much you care?",
  "What do you do when you miss me?",
  "What did the younger version of you want for love?",
  "What is something kind I do for you on purpose?",
  "What is a moment we shared that you tell other people about?",
  "What is a kindness I have shown that you noticed but never said?",
  "What was your first impression of me, honestly?",
  "What in our relationship makes you feel safest?",
  "What is the most thoughtful thing anyone has done for you?",
  "What about today makes you feel grateful?",
  "What is something you wish I knew without you saying?",
  "When did you last feel proud of me?",
  "What do you want me to know about your week?",
  "What is one thing about us you would not trade for anything?",
  "What story would you tell our future selves?",
  "What kind of love do you most want to give right now?",
  "What is a dream of yours I have not heard yet?",
  "What about me made you feel less alone?",
];

const DARES = [
  "Send me a voice note of you saying my name three different ways.",
  "Show me the most recent photo on your camera roll.",
  "Read me the last thing you typed and deleted.",
  "Hum your favourite song until I guess it.",
  "Tell me a story in exactly 30 seconds.",
  "Do your best impression of me, no warning.",
  "Show me what you are doing right now in one slow pan.",
  "Write me a four-line poem and read it.",
  "Whisper one compliment about me three times.",
  "Describe the room behind me as if it is a museum exhibit.",
  "Show me your current playlist.",
  "Read me the first text we ever sent each other.",
  "Wear something amber for the rest of the call.",
  "Sing the chorus of the song you cannot get out of your head.",
  "Show me a face that means you missed me today.",
  "Tell me what you would order me to eat right now.",
  "Do a dramatic reading of your last meal.",
  "Show me your favourite mug or glass.",
  "Mime your work day in 15 seconds.",
  "Send me the next selfie you take without retaking it.",
  "Read the last note in your notes app.",
  "Show me three random items within arm reach and tell me why each.",
  "Pretend to be a sports commentator narrating my next sip of water.",
  "Slow-dance to whatever song I name.",
  "Tell me a joke and laugh first.",
  "Show me the contents of your bag or pockets.",
  "Speak only in questions for the next two prompts.",
  "Read three random emoji and invent their meaning.",
  "Use only one word to answer the next thing I ask.",
  "Show me your most-used app and explain why.",
  "Recite the alphabet backwards as fast as you can.",
  "Wear something I would not expect for one minute.",
  "Read me a fortune-cookie-style fortune you make up on the spot.",
  "Show me one item that has been with you for years.",
  "Talk to me like a tour guide in your space for 30 seconds.",
  "Show me your favourite face you make in the mirror.",
  "Sing me good night, even though it is not night.",
  "Read me three texts from your group chat with no context.",
  "Pose like you are on a magazine cover.",
  "Pick the next song. Play 10 seconds. We dance.",
  "Describe your perfect Sunday morning with me.",
  "Mimic the way I laugh as best you can.",
  "Speak in a fake accent until your next card.",
  "Read me the most recent screenshot in your camera roll.",
  "Do five slow squats while making intense eye contact.",
  "Tell me what you would tattoo if you had to, right now.",
  "Whisper a secret. It does not have to be real.",
  "Read me the title of the last article you opened.",
  "Imitate any animal I name for 10 seconds.",
  "Send me an emoji-only message describing your mood.",
];

export const TOD_POOL: TodCard[] = [
  ...TRUTHS.map((text, i) => ({ id: i, kind: "truth" as const, text })),
  ...DARES.map((text, i) => ({ id: 50 + i, kind: "dare" as const, text })),
];

export function lookupTodCard(id: number): TodCard | null {
  return TOD_POOL[id] ?? null;
}

/** Authored heat tiers over the stable card ids. Every id appears exactly
 *  once; Bare is deliberately scarce so heat 3 stays scarce. */
export const TOD_HEAT_IDS: Record<TodHeat, Record<TodKind, number[]>> = {
  1: {
    truth: [6, 7, 10, 11, 15, 16, 17, 18, 20, 21, 25, 29, 30, 35, 36, 38, 40, 41, 44],
    dare: [50, 53, 54, 56, 59, 60, 62, 63, 65, 66, 67, 68, 71, 72, 74, 76, 77, 78, 80, 82, 84, 85, 86, 88, 92, 97, 98, 99],
  },
  2: {
    truth: [0, 1, 5, 9, 12, 13, 14, 19, 22, 23, 26, 28, 31, 33, 34, 37, 43, 45, 48],
    dare: [51, 55, 57, 58, 61, 64, 69, 73, 75, 79, 81, 83, 89, 90, 91, 94, 95],
  },
  3: {
    truth: [2, 3, 4, 8, 24, 27, 32, 39, 42, 46, 47, 49],
    dare: [52, 70, 87, 93, 96],
  },
};

export function heatOfCard(id: number): TodHeat {
  for (const heat of [1, 2, 3] as TodHeat[]) {
    if (TOD_HEAT_IDS[heat].truth.includes(id) || TOD_HEAT_IDS[heat].dare.includes(id)) return heat;
  }
  return 1;
}

/**
 * The next card for (heat, kind), skipping anything already used this couple.
 * Falls back down the heats, then to any unused card of that kind, so a
 * drained tier never blocks the night.
 */
export function nextTodCard(used: number[], heat: TodHeat, kind: TodKind): number | null {
  const seen = new Set(used);
  const tiers: TodHeat[] = heat === 3 ? [3, 2, 1] : heat === 2 ? [2, 1, 3] : [1, 2, 3];
  for (const t of tiers) {
    const hit = TOD_HEAT_IDS[t][kind].find((id) => !seen.has(id));
    if (hit != null) return hit;
  }
  return TOD_POOL.find((c) => c.kind === kind && !seen.has(c.id))?.id ?? null;
}

export type TodPhase = "deck" | "decide" | "stakes" | "perform" | "judged" | "done";

export type TodState = {
  phase: TodPhase;
  /** 0-based turn; performer alternates each turn. */
  turn: number;
  performer_id: string | null;
  judge_id: string | null;
  kind: TodKind | null;
  card_id: number | null;
  doubled: boolean;
  delivered: boolean | null;
  tokens: Record<string, number>;
  burns_used: Record<string, number>;
  /** Card ids burned or dodged, resurfaced at the end of the night. */
  vault: number[];
  /** Card ids consumed across nights, so a reshuffle deals fresh cards. */
  used: number[];
};

export type TodEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function todHeatForTurn(turn: number): TodHeat {
  return (Math.min(Math.floor(turn / TOD_TURNS_PER_HEAT), 2) + 1) as TodHeat;
}

export function initialTodState(): TodState {
  return {
    phase: "deck",
    turn: 0,
    performer_id: null,
    judge_id: null,
    kind: null,
    card_id: null,
    doubled: false,
    delivered: null,
    tokens: {},
    burns_used: {},
    vault: [],
    used: [],
  };
}

function asCountMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isInteger(val) && val >= 0) out[k] = val;
  }
  return out;
}

function asIdList(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isInteger(x)) : [];
}

export function todFromJson(s: Record<string, unknown> | null): TodState {
  if (!s) return initialTodState();
  const phase = s.phase;
  return {
    phase:
      phase === "decide" || phase === "stakes" || phase === "perform" || phase === "judged" || phase === "done"
        ? phase
        : "deck",
    turn: typeof s.turn === "number" && s.turn >= 0 ? s.turn : 0,
    performer_id: typeof s.performer_id === "string" ? s.performer_id : null,
    judge_id: typeof s.judge_id === "string" ? s.judge_id : null,
    kind: s.kind === "truth" || s.kind === "dare" ? s.kind : null,
    card_id: typeof s.card_id === "number" ? s.card_id : null,
    doubled: s.doubled === true,
    delivered: typeof s.delivered === "boolean" ? s.delivered : null,
    tokens: asCountMap(s.tokens),
    burns_used: asCountMap(s.burns_used),
    vault: asIdList(s.vault),
    used: asIdList(s.used),
  };
}

export function reduceTod(current: TodState, event: TodEvent): TodState {
  const me = event.userId;
  switch (event.type) {
    // Whoever taps "I'll face the first card" becomes the first performer;
    // their date becomes the dealer/judge.
    case "start_night": {
      if (current.phase !== "deck") return current;
      return { ...current, phase: "decide", performer_id: me };
    }
    // The judge picks truth or dare AND carries the deterministic card pick
    // (validated here) so both clients land on the same card.
    case "choose_kind": {
      if (current.phase !== "decide" || current.performer_id == null || me === current.performer_id) return current;
      const kind = event.payload.kind;
      if (kind !== "truth" && kind !== "dare") return current;
      const cardId = typeof event.payload.card_id === "number" ? event.payload.card_id : null;
      const card = cardId != null ? lookupTodCard(cardId) : null;
      if (!card || card.kind !== kind || current.used.includes(card.id)) return current;
      return {
        ...current,
        phase: "stakes",
        judge_id: me,
        kind,
        card_id: card.id,
        doubled: false,
        delivered: null,
        used: [...current.used, card.id],
      };
    }
    case "take": {
      if (current.phase !== "stakes" || me !== current.performer_id) return current;
      return { ...current, phase: "perform", doubled: event.payload.doubled === true };
    }
    case "burn": {
      if (current.phase !== "stakes" || me !== current.performer_id || current.card_id == null) return current;
      if ((current.burns_used[me] ?? 0) >= TOD_BURNS_PER_NIGHT) return current;
      return {
        ...current,
        phase: "judged",
        delivered: false,
        burns_used: { ...current.burns_used, [me]: (current.burns_used[me] ?? 0) + 1 },
        vault: [...current.vault, current.card_id],
      };
    }
    // Only the judge rules. Delivered pays 1 token (2 if doubled); dodged
    // sends the card to the vault.
    case "rule": {
      if (current.phase !== "perform" || current.performer_id == null || me === current.performer_id) return current;
      const delivered = event.payload.delivered === true;
      const performer = current.performer_id;
      return {
        ...current,
        phase: "judged",
        delivered,
        tokens: delivered
          ? { ...current.tokens, [performer]: (current.tokens[performer] ?? 0) + (current.doubled ? 2 : 1) }
          : current.tokens,
        vault: delivered || current.card_id == null ? current.vault : [...current.vault, current.card_id],
      };
    }
    case "next_turn": {
      if (current.phase !== "judged") return current;
      const turn = current.turn + 1;
      if (turn >= TOD_NIGHT_TURNS) {
        return { ...current, phase: "done", kind: null, card_id: null };
      }
      // Performer and judge swap seats each turn.
      return {
        ...current,
        phase: "decide",
        turn,
        performer_id: current.judge_id ?? current.performer_id,
        judge_id: current.performer_id,
        kind: null,
        card_id: null,
        doubled: false,
        delivered: null,
      };
    }
    case "end_night": {
      if (current.phase !== "judged") return current;
      return { ...current, phase: "done", kind: null, card_id: null };
    }
    // A fresh night: scores reset, but `used` survives so the deck deals
    // cards this couple has never seen.
    case "restart": {
      if (current.phase !== "done") return current;
      return { ...initialTodState(), used: current.used, vault: [] };
    }
    default:
      return current;
  }
}
