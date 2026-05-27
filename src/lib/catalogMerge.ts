import type { CatalogPayload } from "@/lib/catalogBundle";
import { buildDefaultCatalogPayload } from "@/lib/catalogBundle";

const CATALOG_KEYS = ["question_deck", "this_or_that", "connection_deepening", "app_config"] as const;

/** Deep-merge optional DB JSON fragments into the default catalog. */
export function mergeCatalogFromFragments(
  fragments: Partial<Record<(typeof CATALOG_KEYS)[number], string>>,
): CatalogPayload {
  const base = buildDefaultCatalogPayload();

  if (fragments.question_deck) {
    try {
      const j = JSON.parse(fragments.question_deck) as { questions?: unknown };
      if (Array.isArray(j.questions) && j.questions.every((q) => typeof q === "string" && q.trim().length > 0)) {
        base.questionDeck = { questions: j.questions as string[] };
      }
    } catch {
      /* ignore */
    }
  }

  if (fragments.this_or_that) {
    try {
      const j = JSON.parse(fragments.this_or_that) as { pairs?: unknown };
      if (
        Array.isArray(j.pairs) &&
        j.pairs.length > 0 &&
        j.pairs.every(
          (p) =>
            p &&
            typeof p === "object" &&
            "a" in p &&
            "b" in p &&
            typeof (p as { a: { label?: string } }).a?.label === "string" &&
            typeof (p as { b: { label?: string } }).b?.label === "string",
        )
      ) {
        base.thisOrThat = { pairs: j.pairs as CatalogPayload["thisOrThat"]["pairs"] };
      }
    } catch {
      /* ignore */
    }
  }

  if (fragments.connection_deepening) {
    try {
      const j = JSON.parse(fragments.connection_deepening) as CatalogPayload["connectionDeepening"];
      if (Array.isArray(j.intents) && j.intents.length > 0) {
        base.connectionDeepening.intents = j.intents as CatalogPayload["connectionDeepening"]["intents"];
      }
      if (j.suggestedQuestionIndexes && typeof j.suggestedQuestionIndexes === "object") {
        base.connectionDeepening.suggestedQuestionIndexes = j.suggestedQuestionIndexes;
      }
      if (Array.isArray(j.planningBlocks) && j.planningBlocks.length > 0) {
        base.connectionDeepening.planningBlocks = j.planningBlocks as CatalogPayload["connectionDeepening"]["planningBlocks"];
      }
    } catch {
      /* ignore */
    }
  }

  if (fragments.app_config) {
    try {
      const j = JSON.parse(fragments.app_config) as CatalogPayload["appConfig"];
      if (Array.isArray(j.activityTabs) && j.activityTabs.length > 0) {
        base.appConfig.activityTabs = j.activityTabs as CatalogPayload["appConfig"]["activityTabs"];
      }
      if (j.pricing && typeof j.pricing === "object") {
        base.appConfig.pricing = j.pricing as CatalogPayload["appConfig"]["pricing"];
      }
      if (Array.isArray(j.reactions) && j.reactions.length > 0) {
        base.appConfig.reactions = j.reactions as string[];
      }
      if (j.limits && typeof j.limits === "object") {
        base.appConfig.limits = { ...base.appConfig.limits, ...(j.limits as Record<string, number>) };
      }
      if (Array.isArray(j.premiumMarketingLines) && j.premiumMarketingLines.length > 0) {
        base.appConfig.premiumMarketingLines = j.premiumMarketingLines.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
      }
    } catch {
      /* ignore */
    }
  }

  base.updated_at = new Date().toISOString();
  return base;
}

export function catalogSeedFragmentsFromDefaults(): Record<(typeof CATALOG_KEYS)[number], string> {
  const d = buildDefaultCatalogPayload();
  return {
    question_deck: JSON.stringify(d.questionDeck),
    this_or_that: JSON.stringify(d.thisOrThat),
    connection_deepening: JSON.stringify(d.connectionDeepening),
    app_config: JSON.stringify(d.appConfig),
  };
}
