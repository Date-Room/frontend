/**
 * Unified default catalog consumed by `/api/catalog` and local test/bootstrap.
 */

import type { Pair } from "@/lib/content";
import { QUESTIONS, PAIRS } from "@/lib/content";
import {
  CONNECTION_INTENT_SEEDS,
  INTENT_SUGGESTED_QUESTION_INDEXES,
  PLANNING_BLOCK_SEEDS,
  type ConnectionIntentSeed,
  type PlanningBlockSeed,
} from "@/lib/connectionIntentSeed";
import {
  ACTIVITY_TAB_SEEDS,
  LIMIT_SEEDS,
  PRICING_PAGE_FEATURE_SEEDS,
  PRICING_SEEDS,
  REACTION_EMOJI_SEEDS,
  type ActivityTabId,
} from "@/lib/appConfigSeed";

export type ActivityTabSeed = {
  id: ActivityTabId;
  label: string;
  icon: string;
};

export interface CatalogPayload {
  questionDeck: { questions: string[] };
  thisOrThat: { pairs: Pair[] };
  connectionDeepening: {
    intents: ConnectionIntentSeed[];
    suggestedQuestionIndexes: Record<string, number[]>;
    planningBlocks: PlanningBlockSeed[];
  };
  appConfig: {
    activityTabs: ActivityTabSeed[];
    pricing: Record<string, { price: number; label: string; description: string }>;
    reactions: readonly string[];
    limits: Record<string, number>;
    premiumMarketingLines: string[];
  };
  updated_at: string;
}

export function buildDefaultCatalogPayload(): CatalogPayload {
  const now = new Date().toISOString();
  return {
    questionDeck: { questions: [...QUESTIONS] },
    thisOrThat: { pairs: [...PAIRS] },
    connectionDeepening: {
      intents: [...CONNECTION_INTENT_SEEDS],
      suggestedQuestionIndexes: { ...INTENT_SUGGESTED_QUESTION_INDEXES },
      planningBlocks: [...PLANNING_BLOCK_SEEDS],
    },
    appConfig: {
      activityTabs: [...ACTIVITY_TAB_SEEDS],
      pricing: { ...PRICING_SEEDS },
      reactions: [...REACTION_EMOJI_SEEDS],
      limits: { ...LIMIT_SEEDS },
      premiumMarketingLines: [...PRICING_PAGE_FEATURE_SEEDS],
    },
    updated_at: now,
  };
}
