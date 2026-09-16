/**
 * Closer — the 36 questions (Aron et al., 1997) without the homework. You
 * commit to a stretch of 3, 6 or 12 questions, never to the set. Turns are
 * explicit: the answerer declares "That's my answer" and the LISTENER rules
 * it Answered / Half of it / Dodged it — engagement is witnessed, never
 * self-certified. Each stretch ends on a keep (each player privately notes
 * one answer they heard) and a real landing where stopping saves your place.
 * The night can close on the study's four minutes of silent eye contact.
 *
 * Rulings are noticing, not scoring: the close reviews engagement and frames
 * dodges as unfinished, worth returning to. Questions paraphrased from the
 * published protocol. NOTE: retires mobile's the_36 wire format (parity list).
 */

export type ClSet = 1 | 2 | 3;

export const CL_SET_NAMES: Record<ClSet, string> = {
  1: "Warming up",
  2: "Going deeper",
  3: "Closest",
};

export const CL_QUESTIONS: { set: ClSet; q: string }[] = [
  { set: 1, q: "Given the choice of anyone in the world, who would you want as a dinner guest?" },
  { set: 1, q: "Would you like to be famous? In what way?" },
  { set: 1, q: "Before making a phone call, do you ever rehearse what you'll say? Why?" },
  { set: 1, q: "What would constitute a perfect day for you?" },
  { set: 1, q: "When did you last sing to yourself? And to someone else?" },
  { set: 1, q: "If you could live to 90 with either the mind or the body of a 30-year-old, which would you take?" },
  { set: 1, q: "Do you have a secret hunch about how you will die?" },
  { set: 1, q: "Name three things we appear to have in common." },
  { set: 1, q: "What are you most grateful for in your life?" },
  { set: 1, q: "If you could change anything about the way you were raised, what would it be?" },
  { set: 1, q: "Take four minutes and tell me your life story in as much detail as you can." },
  { set: 1, q: "If you could wake up tomorrow having gained one quality or ability, what would it be?" },
  { set: 2, q: "If a crystal ball could tell you the truth about anything, what would you want to know?" },
  { set: 2, q: "Is there something you've dreamed of doing for a long time? Why haven't you?" },
  { set: 2, q: "What is the greatest accomplishment of your life?" },
  { set: 2, q: "What do you value most in a friendship?" },
  { set: 2, q: "What is your most treasured memory?" },
  { set: 2, q: "What is your most terrible memory?" },
  { set: 2, q: "If you knew you'd die suddenly in a year, would you change anything about how you live? Why?" },
  { set: 2, q: "What does friendship mean to you?" },
  { set: 2, q: "What roles do love and affection play in your life?" },
  { set: 2, q: "Take turns naming a positive characteristic of the other, five things each." },
  { set: 2, q: "How close and warm is your family? Was your childhood happier than most?" },
  { set: 2, q: "How do you feel about your relationship with your mother?" },
  { set: 3, q: "Make three true 'we' statements each. For instance: 'We are both in this room feeling…'" },
  { set: 3, q: "Complete this sentence: 'I wish I had someone with whom I could share…'" },
  { set: 3, q: "If we were to become close, what would be important for me to know?" },
  { set: 3, q: "Tell me what you like about me. Be honest, say things you might not say to someone you just met." },
  { set: 3, q: "Share an embarrassing moment in your life." },
  { set: 3, q: "When did you last cry in front of another person? And by yourself?" },
  { set: 3, q: "Tell me something you like about me already." },
  { set: 3, q: "What, if anything, is too serious to be joked about?" },
  { set: 3, q: "If you died tonight with no chance to speak to anyone, what would you most regret not saying? Why haven't you said it?" },
  { set: 3, q: "Your house catches fire. After saving loved ones and pets, you can make one last dash. What do you take?" },
  { set: 3, q: "Of all the people in your family, whose death would you find most disturbing? Why?" },
  { set: 3, q: "Share a personal problem and ask my advice on how I might handle it. Then ask how I think you feel about it." },
];

export const CL_TOTAL = CL_QUESTIONS.length;
export const CL_SPEAK_SECONDS = 90;
export const CL_EYES_SECONDS = 240;
export const CL_EYES_UNLOCK = 6;
export const CL_NOTE_MAX = 140;

export type ClVerdict = "answered" | "half" | "dodged";

export function isClVerdict(v: unknown): v is ClVerdict {
  return v === "answered" || v === "half" || v === "dodged";
}
export type ClPhase = "setup" | "turns" | "keep" | "landing" | "eyes" | "done";

export type ClRuling = { q: number; answerer: string; verdict: ClVerdict };
export type ClKeep = { by: string; q: number; note: string };

export type ClState = {
  phase: ClPhase;
  stretch: 3 | 6 | 12;
  /** Current question index (0-based into CL_QUESTIONS). */
  n: number;
  /** Questions completed inside the current stretch. */
  in_stretch: number;
  starter_id: string | null;
  /** 0 = first answerer of this question, 1 = second. First alternates by question. */
  turn: 0 | 1;
  sub: "answering" | "ruling";
  /** Who declared the answer now awaiting a ruling. */
  answerer_id: string | null;
  rulings: ClRuling[];
  keeps: ClKeep[];
  /** Users who have kept this stretch (cleared each keep phase). */
  keep_done: string[];
  continue_votes: string[];
  eyes_started_at: string | null;
  banked: boolean;
  did_eyes: boolean;
};

export type ClEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialClState(): ClState {
  return {
    phase: "setup",
    stretch: 3,
    n: 0,
    in_stretch: 0,
    starter_id: null,
    turn: 0,
    sub: "answering",
    answerer_id: null,
    rulings: [],
    keeps: [],
    keep_done: [],
    continue_votes: [],
    eyes_started_at: null,
    banked: false,
    did_eyes: false,
  };
}

/** Whether the current answerer seat belongs to the starter. The first
 *  answerer alternates each question so nobody always goes first. */
export function clAnswererIsStarter(state: ClState): boolean {
  const firstIsStarter = state.n % 2 === 0;
  return state.turn === 0 ? firstIsStarter : !firstIsStarter;
}

export function clAtEnd(state: ClState): boolean {
  return state.n >= CL_TOTAL - 1;
}

/** Question indices covered by the stretch that just finished. */
export function clStretchWindow(state: ClState): number[] {
  const count = Math.max(state.in_stretch, 1);
  const from = Math.max(0, state.n - count + 1);
  return Array.from({ length: state.n - from + 1 }, (_, i) => from + i);
}

export function reduceCloser(current: ClState, event: ClEvent): ClState {
  const me = event.userId;
  switch (event.type) {
    case "begin": {
      if (current.phase !== "setup") return current;
      const stretch = event.payload.stretch === 6 ? 6 : event.payload.stretch === 12 ? 12 : 3;
      const rawStart = typeof event.payload.start_at === "number" ? event.payload.start_at : 0;
      const n = Math.max(0, Math.min(CL_TOTAL - 1, Math.floor(rawStart)));
      return { ...current, phase: "turns", stretch, n, in_stretch: 0, turn: 0, sub: "answering", starter_id: me };
    }
    // The answerer declares. Declaring is not certifying: the listener rules.
    case "my_answer": {
      if (current.phase !== "turns" || current.sub !== "answering" || current.starter_id == null) return current;
      const answererIsStarter = clAnswererIsStarter(current);
      if (answererIsStarter ? me !== current.starter_id : me === current.starter_id) return current;
      return { ...current, sub: "ruling", answerer_id: me };
    }
    // Only the listener rules: Answered / Half of it / Dodged it.
    case "rule": {
      if (current.phase !== "turns" || current.sub !== "ruling" || current.answerer_id == null) return current;
      if (me === current.answerer_id) return current;
      const v = event.payload.verdict;
      if (!isClVerdict(v)) return current;
      const rulings: ClRuling[] = [...current.rulings, { q: current.n, answerer: current.answerer_id, verdict: v }];
      if (current.turn === 0) {
        return { ...current, rulings, turn: 1, sub: "answering", answerer_id: null };
      }
      const done = current.in_stretch + 1;
      if (done >= current.stretch || clAtEnd(current)) {
        return { ...current, rulings, in_stretch: done, phase: "keep", keep_done: [], answerer_id: null };
      }
      return { ...current, rulings, in_stretch: done, n: current.n + 1, turn: 0, sub: "answering", answerer_id: null };
    }
    // Each player privately keeps one answer they HEARD, as a typed note.
    case "keep": {
      if (current.phase !== "keep" || current.keep_done.includes(me)) return current;
      const q = typeof event.payload.q === "number" ? event.payload.q : -1;
      if (!clStretchWindow(current).includes(q)) return current;
      const note = typeof event.payload.note === "string" ? event.payload.note.trim().slice(0, CL_NOTE_MAX) : "";
      if (note.length < 2) return current;
      const keep_done = [...current.keep_done, me];
      return {
        ...current,
        keeps: [...current.keeps, { by: me, q, note }],
        keep_done,
        phase: keep_done.length >= 2 ? "landing" : "keep",
        continue_votes: [],
      };
    }
    // Continuing needs both. One stop stops the night: a real off-ramp.
    case "continue": {
      if (current.phase !== "landing" || clAtEnd(current) || current.continue_votes.includes(me)) return current;
      const votes = [...current.continue_votes, me];
      if (votes.length < 2) return { ...current, continue_votes: votes };
      return { ...current, continue_votes: [], n: current.n + 1, in_stretch: 0, turn: 0, sub: "answering", phase: "turns" };
    }
    case "stop": {
      if (current.phase !== "landing") return current;
      return { ...current, banked: true, phase: "done" };
    }
    case "start_eyes": {
      if (current.phase !== "landing") return current;
      if (!clAtEnd(current) && current.n + 1 < CL_EYES_UNLOCK) return current;
      const at = typeof event.payload.at === "string" ? event.payload.at : new Date().toISOString();
      return { ...current, eyes_started_at: at, phase: "eyes" };
    }
    case "end_eyes": {
      if (current.phase !== "eyes") return current;
      return { ...current, did_eyes: true, phase: "done" };
    }
    case "restart": {
      if (current.phase !== "done") return current;
      return initialClState();
    }
    default:
      return current;
  }
}

export function clEngagement(state: ClState, userId: string): Record<ClVerdict, number> {
  const out: Record<ClVerdict, number> = { answered: 0, half: 0, dodged: 0 };
  for (const r of state.rulings) {
    if (r.answerer === userId) out[r.verdict] += 1;
  }
  return out;
}

function asRulings(v: unknown): ClRuling[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((r) => {
    const x = (r ?? {}) as Record<string, unknown>;
    const verdict = x.verdict;
    return typeof x.q === "number" &&
      typeof x.answerer === "string" &&
      (verdict === "answered" || verdict === "half" || verdict === "dodged")
      ? [{ q: x.q, answerer: x.answerer, verdict }]
      : [];
  });
}

export function clFromJson(s: Record<string, unknown> | null): ClState {
  if (!s) return initialClState();
  const phase = s.phase;
  const keeps: ClKeep[] = Array.isArray(s.keeps)
    ? (s.keeps as unknown[]).flatMap((k) => {
        const x = (k ?? {}) as Record<string, unknown>;
        return typeof x.by === "string" && typeof x.q === "number" && typeof x.note === "string"
          ? [{ by: x.by, q: x.q, note: x.note }]
          : [];
      })
    : [];
  const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    phase:
      phase === "turns" || phase === "keep" || phase === "landing" || phase === "eyes" || phase === "done"
        ? phase
        : "setup",
    stretch: s.stretch === 6 ? 6 : s.stretch === 12 ? 12 : 3,
    n: typeof s.n === "number" && s.n >= 0 ? Math.min(s.n, CL_TOTAL - 1) : 0,
    in_stretch: typeof s.in_stretch === "number" && s.in_stretch >= 0 ? s.in_stretch : 0,
    starter_id: typeof s.starter_id === "string" ? s.starter_id : null,
    turn: s.turn === 1 ? 1 : 0,
    sub: s.sub === "ruling" ? "ruling" : "answering",
    answerer_id: typeof s.answerer_id === "string" ? s.answerer_id : null,
    rulings: asRulings(s.rulings),
    keeps,
    keep_done: strList(s.keep_done),
    continue_votes: strList(s.continue_votes),
    eyes_started_at: typeof s.eyes_started_at === "string" ? s.eyes_started_at : null,
    banked: s.banked === true,
    did_eyes: s.did_eyes === true,
  };
}
