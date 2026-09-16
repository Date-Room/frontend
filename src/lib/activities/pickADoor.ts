/**
 * Pick a Door — three closed doors, each hiding a question. Both players pick
 * a door blind, then the chosen doors open and each person answers what's
 * behind theirs out loud. The fun is committing to a category before knowing
 * the question.
 *
 * Eight fixed rounds that earn their depth: Get to Know You → Tastes → Your
 * Kind of Life → Stories → A Little Deeper → Chemistry → Curveballs → The
 * Big One. No scoring at all; the reveal is the payoff.
 */

export type Door = { emoji: string; name: string; question: string };

export type DoorRound = {
  title: string;
  doors: Door[];
};

export const DOOR_ROUNDS: DoorRound[] = [
  {
    title: "Get to Know You",
    doors: [
      {
        emoji: "🌍",
        name: "Adventure",
        question: "You can wake up tomorrow anywhere in the world. Where are you?",
      },
      {
        emoji: "🍕",
        name: "Indulge",
        question: "You can eat one meal right now with zero consequences. What are you ordering?",
      },
      {
        emoji: "🎲",
        name: "Wild Card",
        question: "You get one completely useless superpower. What are you choosing?",
      },
    ],
  },
  {
    title: "Tastes",
    doors: [
      {
        emoji: "🎵",
        name: "Soundtrack",
        question: "What song would play over the opening credits of a film about your life?",
      },
      {
        emoji: "🍿",
        name: "Comfort",
        question: "What's your go-to comfort watch or comfort meal after a rough week?",
      },
      {
        emoji: "👀",
        name: "Telling",
        question: "What's one thing you own that says the most about who you are?",
      },
    ],
  },
  {
    title: "Your Kind of Life",
    doors: [
      {
        emoji: "🏡",
        name: "Home",
        question:
          "You have to live in one place for the next 10 years. Big city, small town, countryside or somewhere by the sea?",
      },
      {
        emoji: "💼",
        name: "Dream",
        question: "Money isn't an issue. What would you spend your days doing?",
      },
      {
        emoji: "✈️",
        name: "Escape",
        question: "You have a completely free three-month break. How are you spending it?",
      },
    ],
  },
  {
    title: "Stories",
    doors: [
      {
        emoji: "😂",
        name: "Chaos",
        question: "What's the funniest thing that's ever happened to you on a night out?",
      },
      {
        emoji: "🏆",
        name: "Proud",
        question: "What's a moment you wish someone had filmed, because you were brilliant?",
      },
      {
        emoji: "🙈",
        name: "Blush",
        question: "What's something slightly embarrassing you're willing to admit right now?",
      },
    ],
  },
  {
    title: "A Little Deeper",
    doors: [
      {
        emoji: "🧠",
        name: "Mind",
        question: "What's something you'd love to become genuinely good at?",
      },
      {
        emoji: "❤️",
        name: "People",
        question: "What's one quality you value most in the people you keep close?",
      },
      {
        emoji: "🔥",
        name: "Challenge",
        question:
          "What's something you've always wanted to do but haven't had the courage, time or opportunity to do?",
      },
    ],
  },
  {
    title: "Chemistry",
    doors: [
      {
        emoji: "😏",
        name: "Flirt",
        question: "What's something that instantly makes someone more attractive to you?",
      },
      {
        emoji: "👫",
        name: "Date",
        question: "You're planning the perfect date. What's happening?",
      },
      {
        emoji: "😂",
        name: "Chaos",
        question: "You're stuck together in an airport for 12 hours. What's the first thing you're doing?",
      },
    ],
  },
  {
    title: "Curveballs",
    doors: [
      {
        emoji: "🎤",
        name: "Stage",
        question: "You have to perform one song at karaoke to save your life. What is it?",
      },
      {
        emoji: "🐘",
        name: "Odd",
        question: "What's your most irrational fear or your weirdest habit?",
      },
      {
        emoji: "🔮",
        name: "Magic",
        question: "You can learn one true thing about your future. Do you look, and at what?",
      },
    ],
  },
  {
    title: "The Big One",
    doors: [
      {
        emoji: "🪞",
        name: "You",
        question: "What's something people often misunderstand about you?",
      },
      {
        emoji: "🌅",
        name: "Future",
        question: "If life went really well for you over the next 10 years, what would your life look like?",
      },
      {
        emoji: "❤️",
        name: "Connection",
        question: "What's something you think makes two people genuinely click?",
      },
    ],
  },
];

export type DoorPhase = "picking" | "revealing";

/**
 * The reveal is SHARED and strictly turn-based (live-tested: local beats let
 * both players tap "I'm ready" and desync). Stages, same on both screens:
 *   0 — first picker's door is open, they gather themselves ("I'm ready")
 *   1 — they answer under the ring ("Pass it over")
 *   2 — the other door opens, its owner gathers ("I'm ready")
 *   3 — they answer; either player then advances the round
 * Same-door rounds collapse to 0 → 1 → next round, advanced by either.
 * Only the door's owner can advance stages 0-3; one tap moves both clients.
 */
export type PickADoorState = {
  /** 0-based round index; >= DOOR_ROUNDS.length means the arc is finished. */
  round: number;
  phase: DoorPhase;
  /** userId -> door index that player picked this round. */
  picks: Record<string, number>;
  /** Who picked first this round — their door is answered first. */
  first_picker: string | null;
  /** Shared reveal stage, see above. */
  stage: number;
  rounds_played: number;
};

export type PickADoorEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialPickADoorState(): PickADoorState {
  return { round: 0, phase: "picking", picks: {}, first_picker: null, stage: 0, rounds_played: 0 };
}

/** True when both picked the same door — one plaque, answered together. */
export function pickADoorSameDoor(state: PickADoorState): boolean {
  const values = Object.values(state.picks);
  return values.length >= 2 && values[0] === values[1];
}

/** Whose door is on stage (stages 0-1: first picker's; 2-3: the other's). */
export function pickADoorStageOwner(state: PickADoorState): string | null {
  if (state.first_picker == null) return null;
  if (state.stage <= 1) return state.first_picker;
  return Object.keys(state.picks).find((u) => u !== state.first_picker) ?? null;
}

function asIndexMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isInteger(val) && val >= 0) out[k] = val;
  }
  return out;
}

export function pickADoorFromJson(s: Record<string, unknown> | null): PickADoorState {
  if (!s) return initialPickADoorState();
  return {
    round: typeof s.round === "number" && s.round >= 0 ? s.round : 0,
    phase: s.phase === "revealing" ? "revealing" : "picking",
    picks: asIndexMap(s.picks),
    first_picker: typeof s.first_picker === "string" ? s.first_picker : null,
    stage: typeof s.stage === "number" && s.stage >= 0 && s.stage <= 3 ? s.stage : 0,
    rounds_played: typeof s.rounds_played === "number" ? s.rounds_played : 0,
  };
}

export function pickADoorIsFinished(state: PickADoorState): boolean {
  return state.round >= DOOR_ROUNDS.length;
}

export function reducePickADoor(current: PickADoorState, event: PickADoorEvent): PickADoorState {
  const me = event.userId;
  const evRound = typeof event.payload.round === "number" ? event.payload.round : null;
  const door = typeof event.payload.door === "number" ? event.payload.door : null;

  switch (event.type) {
    case "pick": {
      if (pickADoorIsFinished(current) || current.phase !== "picking") return current;
      if (evRound !== current.round) return current;
      const doorCount = DOOR_ROUNDS[current.round]?.doors.length ?? 0;
      if (door == null || door < 0 || door >= doorCount) return current;
      if (me in current.picks) return current;
      // Date rooms hold two players; a late third voice can't join a round
      // that already has both picks.
      if (Object.keys(current.picks).length >= 2) return current;
      const picks = { ...current.picks, [me]: door };
      const bothPicked = Object.keys(picks).length >= 2;
      return {
        ...current,
        picks,
        first_picker: current.first_picker ?? me,
        stage: 0,
        phase: bothPicked ? "revealing" : "picking",
      };
    }
    // One shared, turn-based reveal: only the door's owner advances its
    // stages, and one tap moves both screens.
    case "advance_stage": {
      if (current.phase !== "revealing" || evRound !== current.round) return current;
      const target = typeof event.payload.stage === "number" ? event.payload.stage : -1;
      if (target !== current.stage + 1) return current;
      const same = pickADoorSameDoor(current);
      const maxStage = same ? 1 : 3;
      if (target > maxStage) return current;
      const owner = same ? null : pickADoorStageOwner(current);
      if (owner != null && me !== owner) return current;
      return { ...current, stage: target };
    }
    case "next_round": {
      if (current.phase !== "revealing") return current;
      if (evRound !== current.round) return current;
      const same = pickADoorSameDoor(current);
      if (current.stage < (same ? 1 : 3)) return current;
      return {
        ...current,
        round: current.round + 1,
        phase: "picking",
        picks: {},
        first_picker: null,
        stage: 0,
        rounds_played: current.rounds_played + 1,
      };
    }
    case "restart": {
      if (!pickADoorIsFinished(current)) return current;
      return initialPickADoorState();
    }
    default:
      return current;
  }
}
