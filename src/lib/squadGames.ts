/**
 * The five squad games, the client side of backend services/games/engine.
 * Each round is prompt -> private moves -> reveal (Clue Me In runs on a
 * 60-second clock). The server keeps the secrets and hands each person
 * only their own card and move; after every change the room channel gets
 * a `durable.update` on activity "game_<game>" and everyone refetches.
 */
import { api } from "@/lib/api";

export type SquadGameId = "most_likely" | "who_said_it" | "imposter" | "spill_tea" | "heads_up";
export type Deck = "mild" | "spicy";

export const SQUAD_GAME_IDS: SquadGameId[] = ["most_likely", "who_said_it", "imposter", "spill_tea", "heads_up"];

export type SquadGameInfo = {
  id: SquadGameId;
  label: string;
  line: string;
  how: string;
  min: number;
  minutes: string;
};

export const SQUAD_GAMES: Record<SquadGameId, SquadGameInfo> = {
  most_likely: {
    id: "most_likely",
    label: "Most Likely To",
    line: "Point at your friends. Everyone votes at once.",
    how: "Vote for who fits the card. Vote with the room and you score.",
    min: 3,
    minutes: "2 min a card",
  },
  who_said_it: {
    id: "who_said_it",
    label: "Who Said It",
    line: "Finish the line. Then guess whose answer is whose.",
    how: "Everyone finishes the line in secret. Guess who wrote each answer: a right guess scores, and so does fooling people.",
    min: 3,
    minutes: "5 min a card",
  },
  imposter: {
    id: "imposter",
    label: "Imposter",
    line: "Everyone knows the word but one.",
    how: "Take turns saying one word about the secret word. The imposter doesn't know it and has to blend in. Then vote them out.",
    min: 4,
    minutes: "5 min a round",
  },
  spill_tea: {
    id: "spill_tea",
    label: "Spill the Tea",
    line: "Fill the blank. The judge picks the best.",
    how: "Everyone but the judge fills the blank. The judge picks a favourite without knowing who wrote it. The judge changes every round.",
    min: 3,
    minutes: "4 min a card",
  },
  heads_up: {
    id: "heads_up",
    // Shown as "Clue Me In"; the id stays heads_up (the server, decks and
    // league all key on it).
    label: "Clue Me In",
    line: "One of you guesses, the squad gives clues. 60 seconds.",
    how: "The guesser can't see the words. Everyone else describes them; tap Got it or Pass. The guesser changes every round.",
    min: 2,
    minutes: "1 min a round",
  },
};

export function isSquadGame(id: string): id is SquadGameId {
  return (SQUAD_GAME_IDS as string[]).includes(id);
}

export type Round = {
  id: string;
  game: SquadGameId;
  number: number;
  deck: Deck;
  stage: "vote" | "answer" | "guess" | "pick" | "playing" | "revealed";
  prompt: {
    id: string;
    text?: string;
    category?: string;
    /** Imposter: the order to take turns in (participant ids). */
    order?: string[];
  } | null;
  players: string[];
  /** Spill the tea: the judge. Clue Me In: the guesser. */
  lead_id: string | null;
  deadline_at: string | null;
  /** Who has moved this stage (never what they moved). */
  submitted: string[];
  public: {
    answers?: { key: string; text: string }[];
    results?: Record<string, unknown>;
  };
  heads_up?: { index: number; total: number };
};

export type MyView = {
  playing: boolean;
  card?: { imposter?: boolean; word?: string | null; index?: number };
  my_answer_key?: string | null;
  my_move?: unknown;
};

export type RoundState = { round: Round | null; me: MyView | null };

const base = (roomId: string, game: SquadGameId) => `/v1/rooms/${roomId}/games/${game}`;

export function getRound(roomId: string, game: SquadGameId) {
  return api.get<RoundState>(`${base(roomId, game)}/current`);
}

export function startRound(roomId: string, game: SquadGameId, deck: Deck, players: string[]) {
  return api.post<RoundState>(`${base(roomId, game)}/rounds`, { deck, players });
}

export function makeMove(roomId: string, game: SquadGameId, value: unknown) {
  return api.post<RoundState>(`${base(roomId, game)}/current/moves`, { value });
}

/** Skip the card before anyone plays it: a fresh one is dealt, no points,
 *  and the skip counts against the card (what the beta skips gets cut). */
export function skipCard(roomId: string, game: SquadGameId) {
  return api.post<RoundState>(`${base(roomId, game)}/current/skip`, {});
}

/** Pure: can this card still be skipped (nobody has played it yet)? */
export function canSkip(round: Round, me: string | null): boolean {
  if (!me || !round.players.includes(me) || round.stage === "revealed") return false;
  if (round.game === "heads_up") return (round.heads_up?.index ?? 0) === 0;
  const first = round.game === "most_likely" || round.game === "imposter" ? "vote" : "answer";
  return round.stage === first && round.submitted.length === 0;
}

export function closeStage(roomId: string, game: SquadGameId) {
  return api.post<RoundState>(`${base(roomId, game)}/current/close`, {});
}

/** Pure: who this stage is still waiting on (participant ids). */
export function waitingOn(round: Round): string[] {
  if (round.stage === "revealed" || round.game === "heads_up") return [];
  let expected = round.players;
  if (round.game === "spill_tea") {
    expected =
      round.stage === "answer"
        ? round.players.filter((p) => p !== round.lead_id)
        : round.lead_id
          ? [round.lead_id]
          : [];
  }
  return expected.filter((p) => !round.submitted.includes(p));
}

/** Pure: may I move this stage? */
export function myTurn(round: Round, me: string | null): boolean {
  if (!me || !round.players.includes(me) || round.stage === "revealed") return false;
  if (round.game === "spill_tea") {
    return round.stage === "answer" ? me !== round.lead_id : me === round.lead_id;
  }
  if (round.game === "heads_up") return me !== round.lead_id;
  return true;
}

/** Pure: seconds left on a Clue Me In clock (never below 0). */
export function secondsLeft(deadline: string | null, now: number): number {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

/** Pure: a vote tally as rows, most votes first (ties by name). */
export function tallyRows(
  tally: Record<string, number>,
  nameOf: (pid: string) => string,
): { pid: string; name: string; votes: number }[] {
  return Object.entries(tally)
    .map(([pid, votes]) => ({ pid, name: nameOf(pid), votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
}

/** Pure: "Amaka", "Amaka and Kofi", "Amaka, Kofi and Tobi". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Pure: why Start is off, or null when a round can start. */
export function startBlocker(game: SquadGameId, players: number): string | null {
  const min = SQUAD_GAMES[game].min;
  return players >= min ? null : `${SQUAD_GAMES[game].label} needs at least ${min} players.`;
}

/** What the call should do for this round, keyed by participant id (the
 *  game maps ids to call identities). See SquadStageContext. */
export type CuePlan = {
  mode: "reading" | "deciding" | "waiting" | "spotlight" | "hero";
  focus: string | null;
  faces: Record<string, { badge?: "in" | "thinking"; picked?: boolean; dim?: boolean; ring?: boolean; tappable?: boolean }>;
  hint: string | null;
  /** Tapping a face casts (or changes) my vote. */
  vote: boolean;
};

const QUIET: CuePlan = { mode: "reading", focus: null, faces: {}, hint: null, vote: false };

/** Pure: the stage cue for a round. Faces are the ballot in the voting
 *  games; everyone shrinks to a strip while reading or writing; the reveal
 *  puts one face forward; the Clue Me In guesser stays big all round. */
export function stageCueFor(round: Round | null, mine: MyView | null, me: string | null, settingUp: boolean): CuePlan {
  if (!round || settingUp) return QUIET;
  if (round.stage === "revealed") {
    const r = (round.public.results ?? {}) as Record<string, unknown>;
    let focus: string | null = null;
    if (round.game === "most_likely") {
      const top = r.top as string[] | undefined;
      focus = top && top.length === 1 ? top[0] : null;
    } else if (round.game === "imposter") focus = (r.imposter as string) ?? null;
    else if (round.game === "spill_tea") focus = (r.winner as string) ?? null;
    else if (round.game === "heads_up") focus = (r.guesser as string) ?? null;
    return focus ? { ...QUIET, mode: "spotlight", focus } : QUIET;
  }
  if (round.game === "heads_up") {
    // Everyone watches the guesser; the guesser watches the room giving clues.
    return round.lead_id === me
      ? { ...QUIET, mode: "deciding", hint: "You're guessing. Listen to the squad." }
      : { ...QUIET, mode: "hero", focus: round.lead_id };
  }

  const still = new Set(waitingOn(round));
  const expected = new Set([...still, ...round.submitted]);
  const faces: CuePlan["faces"] = {};
  for (const p of round.players) {
    if (expected.has(p)) faces[p] = { badge: still.has(p) ? "thinking" : "in" };
    else faces[p] = {};
  }

  if (round.stage === "vote") {
    const turn = myTurn(round, me);
    const moved = me ? round.submitted.includes(me) : false;
    for (const p of round.players) {
      const self = round.game === "imposter" && p === me;
      faces[p] = { ...faces[p], tappable: turn && !self, picked: mine?.my_move === p, dim: self };
    }
    const hint = moved
      ? `You're in · ${round.submitted.length} of ${round.players.length}. Tap another face to change.`
      : round.game === "imposter"
        ? "When you've all spoken, tap who you think it is."
        : "Tap a face to vote. Only you see your pick.";
    return { mode: moved ? "waiting" : "deciding", focus: null, faces, hint, vote: turn };
  }

  // Writing, guessing or judging: the card needs the room; faces are a strip.
  if (round.game === "spill_tea" && round.lead_id) faces[round.lead_id] = { ...faces[round.lead_id], ring: true };
  return { ...QUIET, faces };
}
