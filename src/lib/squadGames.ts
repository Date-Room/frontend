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
  /** What the menu calls it: the mood, not the mechanics. */
  mood: string;
  line: string;
  how: string;
  min: number;
  minutes: string;
};

export const SQUAD_GAMES: Record<SquadGameId, SquadGameInfo> = {
  most_likely: {
    id: "most_likely",
    mood: "Roast each other",
    label: "Most Likely To",
    line: "Point at your friends. Everyone votes at once.",
    how: "Vote for who fits the card. Vote with the room and you score.",
    min: 3,
    minutes: "2 min a card",
  },
  who_said_it: {
    id: "who_said_it",
    mood: "Expose each other",
    label: "Who Said It",
    line: "Finish the line. Then guess whose answer is whose.",
    how: "Everyone finishes the line in secret. Guess who wrote each answer: a right guess scores, and so does fooling people.",
    min: 3,
    minutes: "5 min a card",
  },
  imposter: {
    id: "imposter",
    mood: "Lie to each other",
    label: "Imposter",
    line: "Everyone knows the word but one.",
    how: "Take turns saying one word about the secret word. The imposter doesn't know it and has to blend in. Then vote them out.",
    min: 4,
    minutes: "5 min a round",
  },
  spill_tea: {
    id: "spill_tea",
    mood: "Get messy",
    label: "Spill the Tea",
    line: "Fill the blank. The judge picks the best.",
    how: "Everyone but the judge fills the blank. The judge picks a favourite without knowing who wrote it. The judge changes every round.",
    min: 3,
    minutes: "4 min a card",
  },
  heads_up: {
    id: "heads_up",
    mood: "Get loud",
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
  faces: Record<string, { badge?: "in" | "thinking" | "reading"; picked?: boolean; dim?: boolean; ring?: boolean; tappable?: boolean }>;
  hint: string | null;
  /** Tapping a face casts (or changes) my vote. */
  vote: boolean;
  /** Tapping a face guesses who wrote the answer on screen (Who Said It). */
  guess?: boolean;
};

/** What this device knows that the round doesn't. */
export type CueLocal = {
  /** Imposter: I've tapped "Ready to vote". */
  ready?: boolean;
  /** Who Said It: my guess for the answer on screen. */
  guessPick?: string | null;
  /** Who Said It: I've guessed every answer and am reviewing them. */
  reviewing?: boolean;
  /** People with their first-round card open (participant ids). */
  reading?: string[];
};

const QUIET: CuePlan = { mode: "reading", focus: null, faces: {}, hint: null, vote: false };

/** Pure: how long the soft clock gives the stragglers, in seconds. */
export function softClockFor(round: Round): number {
  if (round.stage === "vote") return 20;
  if (round.stage === "guess") return 30;
  return 45;
}

/** Pure: the stage cue for a round. Faces are the ballot in the voting
 *  games; everyone shrinks to a strip while reading or writing; once you've
 *  moved the faces take over, marked in or still thinking; the reveal puts
 *  one face forward; the Clue Me In guesser stays big all round. */
export function stageCueFor(
  round: Round | null,
  mine: MyView | null,
  me: string | null,
  settingUp: boolean,
  local: CueLocal = {},
): CuePlan {
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
  const reading = new Set(local.reading ?? []);
  const faces: CuePlan["faces"] = {};
  for (const p of round.players) {
    if (!expected.has(p)) faces[p] = {};
    else if (!still.has(p)) faces[p] = { badge: "in" };
    else faces[p] = { badge: reading.has(p) ? "reading" : "thinking" };
  }
  const turn = myTurn(round, me);
  const moved = me ? round.submitted.includes(me) : false;
  const count = `${round.submitted.length} of ${expected.size}`;
  // Moved, or nothing for me to do this stage: the room takes over.
  const waiting = (hint: string): CuePlan => ({ mode: "waiting", focus: null, faces, hint, vote: false });

  if (round.stage === "vote") {
    if (round.game === "imposter" && turn && !moved && !local.ready) {
      // Talking first: the word fills the screen, voting waits for "Ready to vote".
      return { ...QUIET, faces };
    }
    for (const p of round.players) {
      const self = round.game === "imposter" && p === me;
      faces[p] = { ...faces[p], tappable: turn && !self, picked: mine?.my_move === p, dim: self };
    }
    const hint = moved
      ? `You're in · ${count}. Tap another face to change.`
      : round.game === "imposter"
        ? "Tap who you think it is."
        : "Tap a face to vote. Only you see your pick.";
    return { mode: moved ? "waiting" : "deciding", focus: null, faces, hint, vote: turn };
  }

  if (round.game === "spill_tea" && round.lead_id) faces[round.lead_id] = { ...faces[round.lead_id], ring: true };

  if (round.stage === "guess" && turn && !moved && !local.reviewing) {
    for (const p of round.players) {
      faces[p] = { ...faces[p], tappable: p !== me, picked: p === local.guessPick, dim: p === me };
    }
    return { mode: "deciding", focus: null, faces, hint: "Tap who you think wrote it.", vote: false, guess: true };
  }

  if (round.stage === "answer" && round.game === "spill_tea" && me === round.lead_id) {
    return waiting(`You're judging · ${count} in.`);
  }
  if (moved) return waiting(`You're in · ${count}.`);
  // Writing, reviewing or judging: the card needs the room; faces are a strip.
  return { ...QUIET, faces };
}

/** Pure: who to poke (still thinking, not me), and the line for it. */
export function pokeLine(round: Round, me: string | null, nameOf: (pid: string) => string): { pids: string[]; label: string } | null {
  const pids = waitingOn(round).filter((p) => p !== me);
  return pids.length ? { pids, label: `Poke ${listNames(pids.map(nameOf))}` } : null;
}

/** Tonight's energy, remembered per room on this device. */
const ENERGY_KEY = (roomId: string) => `dr_squad_energy:${roomId}`;

export function readEnergy(roomId: string): Deck | null {
  try {
    const v = localStorage.getItem(ENERGY_KEY(roomId));
    return v === "mild" || v === "spicy" ? v : null;
  } catch {
    return null;
  }
}

export function saveEnergy(roomId: string, deck: Deck): void {
  try {
    localStorage.setItem(ENERGY_KEY(roomId), deck);
  } catch {
    /* private mode: it'll ask again next time */
  }
}

/* ───────────────── Learning a game ───────────────── */

/** The part you play this round. It decides your first-time card and the
 *  one line under the round header. */
export type SquadRole = "player" | "imposter" | "word" | "judge" | "writer" | "guesser" | "clue";

/** Pure: my role this round, or null when I'm not in it. */
export function roleFor(round: Round | null, mine: MyView | null, me: string | null): SquadRole | null {
  if (!round || !me || !round.players.includes(me) || !mine?.playing) return null;
  switch (round.game) {
    case "imposter":
      return mine.card?.imposter ? "imposter" : "word";
    case "spill_tea":
      return round.lead_id === me ? "judge" : "writer";
    case "heads_up":
      return round.lead_id === me ? "guesser" : "clue";
    default:
      return "player";
  }
}

export type RoleCard = { title: string; steps: { glyph: string; text: string }[]; score: string };

/** What each role needs to know the first time, in three lines. The full
 *  rules sit behind the ? (ActivityHelp). */
export const ROLE_CARDS: Record<string, RoleCard> = {
  "most_likely:player": {
    title: "Most Likely To",
    steps: [
      { glyph: "🃏", text: "Read the card together." },
      { glyph: "👆", text: "Tap the friend who fits it best. Only you see your pick." },
      { glyph: "🗳️", text: "The reveal shows who the room chose, never who voted for whom." },
    ],
    score: "Vote with the room: 1 point",
  },
  "who_said_it:player": {
    title: "Who Said It",
    steps: [
      { glyph: "✍️", text: "Finish the line in secret." },
      { glyph: "🔀", text: "The answers come back shuffled, with no names." },
      { glyph: "🕵️", text: "Guess who wrote each one." },
    ],
    score: "Right guess: 1 point. Fool someone: 1 point",
  },
  "imposter:imposter": {
    title: "You're the imposter",
    steps: [
      { glyph: "🤫", text: "Everyone else knows a secret word. You don't." },
      { glyph: "👂", text: "Listen to the words before your turn." },
      { glyph: "🎭", text: "When it's your turn, say one word that blends in." },
    ],
    score: "Survive the vote: 2 points",
  },
  "imposter:word": {
    title: "You know the word",
    steps: [
      { glyph: "🔑", text: "Everyone knows the word except one imposter." },
      { glyph: "🗣️", text: "In the order shown, say one word about it, out loud." },
      { glyph: "🕵️", text: "Then tap the face you think is faking." },
    ],
    score: "Catch the imposter: 1 point each",
  },
  "spill_tea:writer": {
    title: "Spill the Tea",
    steps: [
      { glyph: "✍️", text: "Fill the blank in secret." },
      { glyph: "👑", text: "The judge reads every answer without names." },
      { glyph: "🫖", text: "They pick a favourite. The judge changes every round." },
    ],
    score: "Get picked: 1 point",
  },
  "spill_tea:judge": {
    title: "You're the judge",
    steps: [
      { glyph: "⏳", text: "Everyone else fills the blank. You wait." },
      { glyph: "📜", text: "Read their answers. Nobody's name is on them." },
      { glyph: "👑", text: "Tap your favourite." },
    ],
    score: "Whoever you pick gets 1 point",
  },
  "heads_up:guesser": {
    title: "You're guessing",
    steps: [
      { glyph: "🙈", text: "You can't see the words. The squad can." },
      { glyph: "👂", text: "They describe each word without saying it." },
      { glyph: "📣", text: "Shout your guesses. 60 seconds." },
    ],
    score: "1 point for every word you get",
  },
  "heads_up:clue": {
    title: "You're giving clues",
    steps: [
      { glyph: "🗣️", text: "Describe the word without saying it." },
      { glyph: "✅", text: "Tap Got it when they say it." },
      { glyph: "⏭️", text: "Tap Pass to skip a hard one. 60 seconds." },
    ],
    score: "The guesser gets 1 point a word",
  },
};

export function roleCard(game: SquadGameId, role: SquadRole): RoleCard | null {
  return ROLE_CARDS[`${game}:${role}`] ?? null;
}

/** Pure: the reminder under the header, every round. Short enough to read
 *  while someone is talking. */
export function roleLine(round: Round, role: SquadRole | null, nameOf: (pid: string) => string): string | null {
  const lead = round.lead_id ? nameOf(round.lead_id) : "Someone";
  if (!role) {
    if (round.game === "spill_tea") return `👑 ${lead} is judging this round.`;
    if (round.game === "heads_up") return `🎯 ${lead} is guessing this round.`;
    return null;
  }
  switch (role) {
    case "player":
      if (round.game === "most_likely") return "👆 Tap who fits the card. Match the room to score.";
      return round.stage === "answer"
        ? "✍️ Finish the line. Nobody sees who wrote it."
        : "🕵️ Guess who wrote each answer.";
    case "imposter":
      return "🤫 You don't know the word. Blend in.";
    case "word":
      return "🔑 One word each about it, then find the faker.";
    case "judge":
      return "👑 You're judging. Wait for their answers, then pick your favourite. Nobody knows who wrote what.";
    case "writer":
      return `✍️ Fill the blank. ${lead} picks the best one without names.`;
    case "guesser":
      return "🎯 You're guessing. Listen and shout.";
    case "clue":
      return `🗣️ Describe the word to ${lead}. Don't say it.`;
  }
}

/** Role cards this device has seen ("imposter:word"). Per browser, like the
 *  game intros: squads meet in the same room, but people switch rooms. */
const ROLE_SEEN_KEY = "dr:squad-role-seen:v1";

function readRoleSeen(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ROLE_SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function hasSeenRole(game: SquadGameId, role: SquadRole): boolean {
  return readRoleSeen().has(`${game}:${role}`);
}

export function markRoleSeen(game: SquadGameId, role: SquadRole): void {
  try {
    const seen = readRoleSeen();
    seen.add(`${game}:${role}`);
    localStorage.setItem(ROLE_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage off: the card shows again next time */
  }
}
