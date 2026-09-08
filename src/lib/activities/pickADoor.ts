/**
 * Pick a Door — three closed doors, each hiding a question. Both players pick
 * a door blind, then the chosen doors open and each person answers what's
 * behind theirs out loud. The fun is committing to a category before knowing
 * the question.
 *
 * Five fixed rounds that earn their depth: Get to Know You → Your Kind of
 * Life → A Little Deeper → Chemistry → The Big One. No scoring at all; the
 * reveal is the payoff.
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

export type PickADoorState = {
  /** 0-based round index; >= DOOR_ROUNDS.length means the arc is finished. */
  round: number;
  phase: DoorPhase;
  /** userId -> door index that player picked this round. */
  picks: Record<string, number>;
  rounds_played: number;
};

export type PickADoorEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function initialPickADoorState(): PickADoorState {
  return { round: 0, phase: "picking", picks: {}, rounds_played: 0 };
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
      return { ...current, picks, phase: bothPicked ? "revealing" : "picking" };
    }
    case "next_round": {
      if (current.phase !== "revealing") return current;
      if (evRound !== current.round) return current;
      return {
        ...current,
        round: current.round + 1,
        phase: "picking",
        picks: {},
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
