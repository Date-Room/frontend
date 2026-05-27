import { getCatalogSnapshot, type ConnectionIntent } from "@/lib/catalogRuntime";

export type { ConnectionIntent } from "@/lib/catalogRuntime";

export function getConnectionIntentRows() {
  return getCatalogSnapshot().connectionDeepening.intents;
}

export function connectionIntentMeta(id: ConnectionIntent | string | null | undefined) {
  const intents = getCatalogSnapshot().connectionDeepening.intents;
  const row = intents.find((c) => c.id === id);
  return row ?? intents.find((i) => i.id === "heartfelt") ?? intents[0];
}

export function getIntentSuggestedIndexes(): Record<string, number[]> {
  return getCatalogSnapshot().connectionDeepening.suggestedQuestionIndexes;
}

export function getPlanningBlocks() {
  return getCatalogSnapshot().connectionDeepening.planningBlocks;
}

export function coerceConnectionIntent(s: string | null | undefined): ConnectionIntent {
  const intents = getCatalogSnapshot().connectionDeepening.intents;
  if (typeof s === "string" && intents.some((x) => x.id === s)) {
    return s as ConnectionIntent;
  }
  return "heartfelt";
}
