/**
 * The 36 — TS port of mobile's `the36_module.dart` (3 sets of 12 prompts).
 * Either player advances; `done` flips after the last prompt of set 3.
 * Prompts are copied verbatim from mobile's `kThe36` so both clients match.
 */

export type The36State = { set_index: number; question_index: number; done: boolean };
export type The36Event = { type: string; payload: Record<string, unknown>; userId: string };

export const SETS_COUNT = 3;
export const PER_SET = 12;

export const THE_36: string[][] = [
  [
    "If you could swap lives with anyone for one day, who — and what's the first thing you'd do?",
    "What's the smallest thing today that made you feel like yourself?",
    "Describe your ideal slow Sunday in three sentences.",
    "What did you Google most recently at an odd hour?",
    "If you had to teach a thirty-minute class tomorrow, on anything, what?",
    "What's a small ritual in your week you'd protect at all costs?",
    "What's the last thing that made you laugh out loud when you were alone?",
    "If you could master one skill overnight, which?",
    "What's something you used to love that you've quietly grown out of?",
    "Name a smell that takes you straight to a specific memory.",
    "If this week had a soundtrack, what's playing on Wednesday afternoon?",
    "What's a tiny thing about your hometown nobody else would get?",
  ],
  [
    "What's a compliment you received that you're still holding onto?",
    "When did you last feel completely understood — and by whom?",
    "What's a belief you held five years ago that you've since put down?",
    "What's a part of yourself you've had to work to like?",
    "Tell me about a stranger who changed something in you.",
    'What does the word "home" mean to you right now?',
    "What's a fear you've made some peace with?",
    "When was the last time you felt genuinely brave?",
    "What would you want your younger self to know without giving away the ending?",
    "What's a question you've been quietly carrying around lately?",
    "What's the most loved you've ever felt in a single moment?",
    "What part of you doesn't get to come out often, but you wish it did?",
  ],
  [
    "What's something you'd want me to know about you that doesn't come up easily?",
    "When did you first sense you'd want real time with me?",
    "What part of yourself are you hoping I'll see one day?",
    "What's a fear you have about being known too well?",
    "Describe the last time you cried — what set it off?",
    "What's a memory you've never told anyone?",
    "What's a hope you have for us that you haven't said out loud?",
    "If something happened to me tomorrow, what would you most regret not having said?",
    "What in your life right now feels heavier than it looks from the outside?",
    "When you picture us a year from now, what's the first detail that comes to mind?",
    "Name one thing you've forgiven yourself for and one you're still working on.",
    'Looking at me now, finish this: "I wish I had a way to tell you that ___."',
  ],
];

export const SET_LABELS = ["Set 1 · warming up", "Set 2 · going deeper", "Set 3 · closest"];

export function initialThe36State(): The36State {
  return { set_index: 0, question_index: 0, done: false };
}

export function the36FromJson(s: Record<string, unknown> | null): The36State {
  if (!s) return initialThe36State();
  return {
    set_index: typeof s.set_index === "number" ? s.set_index : 0,
    question_index: typeof s.question_index === "number" ? s.question_index : 0,
    done: s.done === true,
  };
}

export function reduceThe36(current: The36State, event: The36Event): The36State {
  if (event.type !== "advance" || current.done) return current;
  // Idempotency: drop advances that lag the current cursor (double taps).
  const fromSet = event.payload.from_set;
  const fromQ = event.payload.from_q;
  if (typeof fromSet === "number" && typeof fromQ === "number") {
    if (fromSet < current.set_index || (fromSet === current.set_index && fromQ < current.question_index)) {
      return current;
    }
  }
  const nextQ = current.question_index + 1;
  if (nextQ < PER_SET) return { ...current, question_index: nextQ };
  const nextSet = current.set_index + 1;
  if (nextSet >= SETS_COUNT) return { ...current, done: true };
  return { ...current, set_index: nextSet, question_index: 0 };
}
