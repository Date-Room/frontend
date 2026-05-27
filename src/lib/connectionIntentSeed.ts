/**
 * Canonical seed definitions for connection intent UI (also written to catalog via API).
 */

export type ConnectionIntentId = "playful" | "heartfelt" | "electric" | "reconnect";

export type ConnectionIntentSeed = {
  id: ConnectionIntentId;
  emoji: string;
  label: string;
  shortLabel: string;
  description: string;
  deckHint: string;
};

export const CONNECTION_INTENT_SEEDS = [
  {
    id: "playful",
    emoji: "✨",
    label: "Playful",
    shortLabel: "Playful energy",
    description: "Keep things light — jokes, stories, curiosity without pressure.",
    deckHint: "Favor sillier prompts, quick stories, and small surprises.",
  },
  {
    id: "heartfelt",
    emoji: "🫂",
    label: "Heartfelt",
    shortLabel: "Heartfelt depth",
    description: "Make space for tenderness, honesty, and being seen.",
    deckHint: "Slow down — ask follow-ups before moving to the next card.",
  },
  {
    id: "electric",
    emoji: "🔥",
    label: "Electric",
    shortLabel: "Brave & flirt-forward",
    description: "Turn up curiosity and chemistry — still respect each other’s pace.",
    deckHint: "Lean into flirtier questions only when both of you welcome it.",
  },
  {
    id: "reconnect",
    emoji: "🌿",
    label: "Repair & reconnect",
    shortLabel: "Repair & soften",
    description: "Rebuild warmth after drift or tension — no blame, gentle repair.",
    deckHint: "Name feelings before positions; prioritize understanding over winning.",
  },
] as const satisfies readonly ConnectionIntentSeed[];

/** Indices into the question deck — thematic nudges, not exclusive. */
export const INTENT_SUGGESTED_QUESTION_INDEXES: Record<ConnectionIntentId, number[]> = {
  playful: [6, 10, 28, 26, 16, 20, 7, 11],
  heartfelt: [12, 14, 43, 44, 45, 24, 8, 9],
  electric: [4, 25, 32, 36, 30, 37, 15, 24],
  reconnect: [12, 26, 45, 8, 43, 5, 11, 20],
};

export type PlanningBlockSeed = {
  id: string;
  title: string;
  emoji: string;
  prompts: string[];
};

export const PLANNING_BLOCK_SEEDS = [
  {
    id: "trip",
    title: "Plan a getaway",
    emoji: "✈️",
    prompts: [
      "Where would we both feel excited to disappear for a weekend this year?",
      "What pace feels right — plan every hour or wing it?",
      "What matters more to you here: scenery, food, or doing nothing side by side?",
    ],
  },
  {
    id: "boundaries_meetfriends",
    title: "Meet each other’s people",
    emoji: "🤝",
    prompts: [
      "When feels right for you to introduce me to someone who matters?",
      "What tends to overwhelm you around new social circles?",
      "What would make you proud to show me off (subtly) to someone you love?",
    ],
  },
  {
    id: "home_future",
    title: "Closer together",
    emoji: "🏠",
    prompts: [
      'What would "living nearer" change for how we nurture this?',
      "What’s one rhythm you’d want to protect before any big logistics?",
      "What’s a compromise you fear — and how could we soften it?",
    ],
  },
  {
    id: "budget_date",
    title: "Budget date nights",
    emoji: "🍝",
    prompts: [
      "What counts as romance when money is tight?",
      "Rotate who plans — what would make that feel fair to you?",
      "What tiny ritual would you want every week anyway?",
    ],
  },
] as const satisfies readonly PlanningBlockSeed[];
