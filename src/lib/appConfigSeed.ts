/**
 * Canonical product config seeded into catalog (`app_config` row).
 */

export const ACTIVITY_TAB_SEEDS = [
  { id: "questions", label: "Questions", icon: "💬" },
  { id: "thisorthat", label: "This or That", icon: "⚖️" },
  { id: "watch", label: "Watch", icon: "📺" },
  { id: "dj", label: "DJ", icon: "🎵" },
  { id: "chat", label: "Chat", icon: "💭" },
] as const;

export type ActivityTabId = (typeof ACTIVITY_TAB_SEEDS)[number]["id"];

export type PricingPlanSeed = {
  price: number;
  label: string;
  description: string;
};

export const PRICING_SEEDS = {
  singlePass: { price: 4.99, label: "Lunar Evening Pass", description: "One 45‑minute session window · same features as every tier" },
  fivePack: { price: 14.99, label: "5‑Pack Lunar", description: "Five longer evenings — best per‑night value" },
  monthly: { price: 9.99, label: "Orbit Monthly", description: "Unlimited time in the room · same full feature set" },
  annual: { price: 79.99, label: "Orbit Annual", description: "A year of unhurried orbit · save ~33%" },
} satisfies Record<string, PricingPlanSeed>;

export type PricingPlanKey = keyof typeof PRICING_SEEDS;

export const REACTION_EMOJI_SEEDS = ["❤️", "🥹", "😂", "🤔", "🫂"] as const;

export const LIMIT_SEEDS = {
  sessionDurationMins: 45,
  gracePeriodHours: 24,
  skipLimit: 2,
  customQuestionLimit: 3,
  tradeTimeoutSecs: 60,
  djTurnMins: 15,
} as const;

/** Pricing page checklist — seeded into `app_config` for API delivery. */
export const PRICING_PAGE_FEATURE_SEEDS = [
  "Every tier includes Watch, DJ, Capture, all moods, planning prompts, and custom questions",
  "Spark (free): a focused 20‑minute countdown together",
  "Lunar passes: extend the same experience to 45 minutes per session",
  "Orbit membership: no timer — stay in the room as long as you like",
  "Priority seasonal drops · memory capsules · concierge polish (roadmap)",
] as const;
