/**
 * Truth or Dare — TS port of mobile's `tod_module.dart` + `tod_cards.dart`.
 * Card IDs are part of the wire format (the dealer shares a shuffled
 * `deck_order` of IDs); this pool must match mobile by ID so both clients show
 * the same card text. Truths 0–49, dares 50–99.
 */

export type TodKind = "truth" | "dare";
export type TodCard = { id: number; kind: TodKind; text: string };
export type TodHand = { cards: number[]; skips_used: number };
export type TodTrade = { proposer_id: string; started_at: string } | null;
export type TodState = {
  hands: Record<string, TodHand>;
  deck_cursor: number;
  deck_order: number[];
  revealed: string[];
  trade: TodTrade;
};
export type TodEvent = { type: string; payload: Record<string, unknown>; userId: string };

export const HAND_SIZE = 3;
export const SKIPS_PER_PLAYER = 2;

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

/** Whichever client deals first shuffles all IDs and hands HAND_SIZE to each. */
export function makeDeal(userIds: string[]): { deck_order: number[]; hand_for: Record<string, number[]> } {
  const order = [...Array(TOD_POOL.length).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const hand_for: Record<string, number[]> = {};
  userIds.forEach((uid, idx) => {
    hand_for[uid] = order.slice(idx * HAND_SIZE, idx * HAND_SIZE + HAND_SIZE);
  });
  return { deck_order: order, hand_for };
}

export function initialTodState(): TodState {
  return { hands: {}, deck_cursor: 0, deck_order: [], revealed: [], trade: null };
}

export function todFromJson(s: Record<string, unknown> | null): TodState {
  if (!s) return initialTodState();
  const hands: Record<string, TodHand> = {};
  if (s.hands && typeof s.hands === "object") {
    for (const [k, v] of Object.entries(s.hands as Record<string, unknown>)) {
      const h = v as Record<string, unknown>;
      hands[k] = {
        cards: Array.isArray(h?.cards) ? (h.cards as number[]) : [],
        skips_used: typeof h?.skips_used === "number" ? h.skips_used : 0,
      };
    }
  }
  const trade = s.trade as Record<string, unknown> | undefined;
  return {
    hands,
    deck_cursor: typeof s.deck_cursor === "number" ? s.deck_cursor : 0,
    deck_order: Array.isArray(s.deck_order) ? (s.deck_order as number[]) : [],
    revealed: Array.isArray(s.revealed) ? (s.revealed as string[]) : [],
    trade: trade ? { proposer_id: String(trade.proposer_id ?? ""), started_at: String(trade.started_at ?? "") } : null,
  };
}

function advanceHand(s: TodState, userId: string): TodState {
  const h = s.hands[userId];
  if (!h || h.cards.length === 0) return s;
  const cards = h.cards.slice(1);
  let cursor = s.deck_cursor;
  if (cursor < s.deck_order.length) {
    cards.push(s.deck_order[cursor]);
    cursor += 1;
  }
  return {
    ...s,
    hands: { ...s.hands, [userId]: { ...h, cards } },
    deck_cursor: cursor,
    revealed: s.revealed.filter((id) => id !== userId),
  };
}

export function reduceTod(current: TodState, event: TodEvent): TodState {
  const me = event.userId;
  switch (event.type) {
    case "deal": {
      if (current.deck_order.length > 0) return current;
      const order = Array.isArray(event.payload.deck_order) ? (event.payload.deck_order as number[]) : null;
      const handForRaw = event.payload.hand_for as Record<string, unknown> | undefined;
      if (!order || !handForRaw) return current;
      const hands: Record<string, TodHand> = {};
      let dealt = 0;
      for (const [k, v] of Object.entries(handForRaw)) {
        const cards = Array.isArray(v) ? (v as number[]) : [];
        hands[k] = { cards, skips_used: 0 };
        dealt += cards.length;
      }
      return { ...current, deck_order: order, hands, deck_cursor: dealt };
    }
    case "draw":
      return current.revealed.includes(me) ? current : { ...current, revealed: [...current.revealed, me] };
    case "done":
      return advanceHand(current, me);
    case "skip": {
      const h = current.hands[me];
      if (!h || h.skips_used >= SKIPS_PER_PLAYER) return current;
      const advanced = advanceHand(current, me);
      const ah = advanced.hands[me];
      if (!ah) return advanced;
      return { ...advanced, hands: { ...advanced.hands, [me]: { ...ah, skips_used: h.skips_used + 1 } } };
    }
    case "propose_trade":
      if (current.trade != null) return current;
      return { ...current, trade: { proposer_id: me, started_at: new Date().toISOString() } };
    case "decline_trade":
      return { ...current, trade: null };
    case "accept_trade": {
      const trade = current.trade;
      if (!trade || me === trade.proposer_id) return current;
      const p = current.hands[trade.proposer_id];
      const a = current.hands[me];
      if (!p || !a) return current;
      if (p.cards.length === 0 || a.cards.length === 0) return { ...current, trade: null };
      const pCards = [...p.cards];
      const aCards = [...a.cards];
      [pCards[0], aCards[0]] = [aCards[0], pCards[0]];
      return {
        ...current,
        hands: { ...current.hands, [trade.proposer_id]: { ...p, cards: pCards }, [me]: { ...a, cards: aCards } },
        revealed: current.revealed.filter((id) => id !== trade.proposer_id && id !== me),
        trade: null,
      };
    }
    default:
      return current;
  }
}
