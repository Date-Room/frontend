import type { CatalogPayload } from "@/lib/catalogBundle";
import { buildDefaultCatalogPayload } from "@/lib/catalogBundle";
import type { ActivityTabId } from "@/lib/appConfigSeed";
import type { PricingPlanKey } from "@/lib/appConfigSeed";
import type { ConnectionIntentId } from "@/lib/connectionIntentSeed";
import type { Pair } from "@/lib/content";

let snapshot: CatalogPayload | null = null;

export function initCatalogFromPayload(payload: CatalogPayload): void {
  snapshot = payload;
}

/** Test / SSR guard: load defaults without hitting the network. */
export function initCatalogDefaultsFromBundle(): void {
  snapshot = buildDefaultCatalogPayload();
}

export function assertCatalogLoaded(): void {
  if (!snapshot) {
    throw new Error("App catalog is not loaded yet (fetch /api/catalog before rendering).");
  }
}

export function getCatalogSnapshot(): CatalogPayload {
  assertCatalogLoaded();
  return snapshot!;
}

export function getPremiumMarketingLines(): readonly string[] {
  return getCatalogSnapshot().appConfig.premiumMarketingLines;
}

export function getQuestions(): string[] {
  return getCatalogSnapshot().questionDeck.questions;
}

export function getPairs(): Pair[] {
  return getCatalogSnapshot().thisOrThat.pairs;
}

export function getActivityTabs(): readonly { id: ActivityTabId; label: string; icon: string }[] {
  return getCatalogSnapshot().appConfig.activityTabs;
}

export function getPricing(): Record<PricingPlanKey, { price: number; label: string; description: string }> {
  return getCatalogSnapshot().appConfig.pricing as Record<
    PricingPlanKey,
    { price: number; label: string; description: string }
  >;
}

export function getReactions(): readonly string[] {
  return getCatalogSnapshot().appConfig.reactions;
}

export function getLimits(): {
  sessionDurationMins: number;
  gracePeriodHours: number;
  skipLimit: number;
  customQuestionLimit: number;
  tradeTimeoutSecs: number;
  djTurnMins: number;
} {
  const L = getCatalogSnapshot().appConfig.limits;
  return {
    sessionDurationMins: L.sessionDurationMins,
    gracePeriodHours: L.gracePeriodHours,
    skipLimit: L.skipLimit,
    customQuestionLimit: L.customQuestionLimit,
    tradeTimeoutSecs: L.tradeTimeoutSecs,
    djTurnMins: L.djTurnMins,
  };
}

export function getConnectionDeepening(): CatalogPayload["connectionDeepening"] {
  return getCatalogSnapshot().connectionDeepening;
}

/** @deprecated Use ConnectionIntentId — kept for components that still narrow to known ids. */
export type ConnectionIntent = ConnectionIntentId;
