/**
 * 21 Questions reducer — faithful TS port of mobile's `questions_module.dart`
 * so web and mobile compute identical state from the same event stream.
 *
 * Setup: each user builds an ordered 24-card list (`setup[userId]`) of built-in
 * question indices + custom-card ids (>= CUSTOM_ID_BASE). When both `send_deck`,
 * decks swap (each plays the OTHER's list) and play begins. Play alternates
 * turns; shared budgets of 3 skips and 2 trades.
 */

export type QuestionsPhase = "setup" | "play" | "done";
export type Trade = { proposer_id: string; started_at: string } | null;

export type QuestionsState = {
  phase: QuestionsPhase;
  setup: Record<string, number[]>;
  customs_used: Record<string, number>;
  customs: Record<string, string>;
  sent: Record<string, boolean>;
  deck: Record<string, number[]>;
  turn: string | null;
  skips_left: number;
  trades_left: number;
  trade: Trade;
};

export type QuestionsEvent = { type: string; payload: Record<string, unknown>; userId: string };

export const TARGET_SETUP_COUNT = 24;
export const MAX_CUSTOMS = 3;
export const TOTAL_SKIPS = 3;
export const TOTAL_TRADES = 2;
export const CUSTOM_ID_BASE = 1_000_000;

export function initialQuestionsState(): QuestionsState {
  return {
    phase: "setup",
    setup: {},
    customs_used: {},
    customs: {},
    sent: {},
    deck: {},
    turn: null,
    skips_left: TOTAL_SKIPS,
    trades_left: TOTAL_TRADES,
    trade: null,
  };
}

function asNumArrMap(v: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (Array.isArray(val)) out[k] = val.filter((n): n is number => typeof n === "number");
    }
  }
  return out;
}

export function questionsFromJson(s: Record<string, unknown> | null): QuestionsState {
  const base = initialQuestionsState();
  if (!s) return base;
  const phase = s.phase === "play" || s.phase === "done" ? s.phase : "setup";
  const trade =
    s.trade && typeof s.trade === "object"
      ? {
          proposer_id: String((s.trade as Record<string, unknown>).proposer_id ?? ""),
          started_at: String((s.trade as Record<string, unknown>).started_at ?? ""),
        }
      : null;
  return {
    phase,
    setup: asNumArrMap(s.setup),
    customs_used:
      s.customs_used && typeof s.customs_used === "object"
        ? Object.fromEntries(
            Object.entries(s.customs_used as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0]),
          )
        : {},
    customs:
      s.customs && typeof s.customs === "object"
        ? Object.fromEntries(Object.entries(s.customs as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
        : {},
    sent:
      s.sent && typeof s.sent === "object"
        ? Object.fromEntries(Object.entries(s.sent as Record<string, unknown>).map(([k, v]) => [k, v === true]))
        : {},
    deck: asNumArrMap(s.deck),
    turn: typeof s.turn === "string" ? s.turn : null,
    skips_left: typeof s.skips_left === "number" ? s.skips_left : TOTAL_SKIPS,
    trades_left: typeof s.trades_left === "number" ? s.trades_left : TOTAL_TRADES,
    trade,
  };
}

function advanceTurn(s: QuestionsState, askerId: string): QuestionsState {
  const myDeck = [...(s.deck[askerId] ?? [])];
  if (myDeck.length) myDeck.shift();
  const nextDeck = { ...s.deck, [askerId]: myDeck };
  const other = Object.keys(s.deck).find((k) => k !== askerId) ?? "";
  const everyoneEmpty = Object.values(nextDeck).every((d) => d.length === 0);
  return {
    ...s,
    deck: nextDeck,
    turn: everyoneEmpty || !other ? null : other,
    phase: everyoneEmpty ? "done" : s.phase,
  };
}

export function reduceQuestions(current: QuestionsState, event: QuestionsEvent): QuestionsState {
  const me = event.userId;
  switch (event.type) {
    case "toggle_card": {
      if (current.phase !== "setup") return current;
      const cardId = typeof event.payload.card_id === "number" ? event.payload.card_id : null;
      if (cardId == null) return current;
      const list = [...(current.setup[me] ?? [])];
      const i = list.indexOf(cardId);
      if (i >= 0) list.splice(i, 1);
      else {
        if (list.length >= TARGET_SETUP_COUNT) return current;
        list.push(cardId);
      }
      return { ...current, setup: { ...current.setup, [me]: list } };
    }
    case "add_custom": {
      if (current.phase !== "setup") return current;
      const id = typeof event.payload.custom_id === "number" ? event.payload.custom_id : null;
      const text = typeof event.payload.text === "string" ? event.payload.text.trim() : "";
      if (id == null || !text || id < CUSTOM_ID_BASE) return current;
      const used = current.customs_used[me] ?? 0;
      if (used >= MAX_CUSTOMS) return current;
      const list = [...(current.setup[me] ?? [])];
      if (list.length >= TARGET_SETUP_COUNT || list.includes(id)) return current;
      list.push(id);
      return {
        ...current,
        setup: { ...current.setup, [me]: list },
        customs: { ...current.customs, [String(id)]: text },
        customs_used: { ...current.customs_used, [me]: used + 1 },
      };
    }
    case "send_deck": {
      if (current.phase !== "setup") return current;
      const list = current.setup[me] ?? [];
      if (list.length !== TARGET_SETUP_COUNT) return current;
      const nextSent = { ...current.sent, [me]: true };
      const sentUsers = Object.keys(nextSent).filter((k) => nextSent[k]);
      if (sentUsers.length < 2) return { ...current, sent: nextSent };
      const users = Object.keys(current.setup);
      if (users.length < 2) return { ...current, sent: nextSent };
      const [a, b] = users;
      return {
        ...current,
        phase: "play",
        sent: nextSent,
        deck: { [a]: [...(current.setup[b] ?? [])], [b]: [...(current.setup[a] ?? [])] },
        turn: a,
      };
    }
    case "answered":
      if (current.phase !== "play" || current.turn !== me) return current;
      return advanceTurn(current, me);
    case "skip": {
      if (current.phase !== "play" || current.skips_left <= 0 || current.turn !== me) return current;
      const next = advanceTurn(current, me);
      return { ...next, skips_left: current.skips_left - 1 };
    }
    case "propose_trade":
      if (current.phase !== "play" || current.trade != null || current.trades_left <= 0) return current;
      return {
        ...current,
        trade: { proposer_id: me, started_at: new Date().toISOString() },
      };
    case "decline_trade":
      return { ...current, trade: null };
    case "accept_trade": {
      const trade = current.trade;
      if (!trade) return current;
      if (me === trade.proposer_id) return current;
      if (current.trades_left <= 0) return { ...current, trade: null };
      const pDeck = [...(current.deck[trade.proposer_id] ?? [])];
      const aDeck = [...(current.deck[me] ?? [])];
      if (pDeck.length === 0 || aDeck.length === 0) return { ...current, trade: null };
      const tmp = pDeck[0];
      pDeck[0] = aDeck[0];
      aDeck[0] = tmp;
      return {
        ...current,
        deck: { ...current.deck, [trade.proposer_id]: pDeck, [me]: aDeck },
        trades_left: current.trades_left - 1,
        trade: null,
      };
    }
    default:
      return current;
  }
}
