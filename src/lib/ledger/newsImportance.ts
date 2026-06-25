import type { NewsEventType, NewsRelevance, NewsSurprise } from "./types";

/** Deterministic news-importance rubric. The LLM supplies categorical facets;
 * this module — not the LLM — owns the 0–1 number, so the score means the
 * same thing on every report and junk structurally cannot score high. */

export const EVENT_BASE: Record<NewsEventType, number> = {
  earnings_guidance: 0.95,
  ma_strategic: 0.9,
  regulatory_legal: 0.75,
  analyst_action: 0.55,
  product_demand: 0.5,
  insider_institutional: 0.3,
  commentary_listicle: 0.15,
  routine_filing: 0.08,
};

export const RELEVANCE_MULT: Record<NewsRelevance, number> = {
  direct: 1,
  sector: 0.45,
  macro: 0.25,
  unrelated: 0.05,
};

export const SURPRISE_MULT: Record<NewsSurprise, number> = {
  new_material: 1,
  incremental: 0.75,
  recycled_known: 0.45,
};

export function computeNewsImportance(
  relevance: NewsRelevance,
  eventType: NewsEventType,
  surprise: NewsSurprise,
): number {
  const raw = EVENT_BASE[eventType] * RELEVANCE_MULT[relevance] * SURPRISE_MULT[surprise];
  return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
}

function cleanToken(value: unknown): string {
  return String(value ?? "").toLowerCase().trim().replace(/[^a-z_]/g, "");
}

/** Unknown/missing facets fall back to the most conservative option so
 * malformed LLM output scores low, never high. */
export function normRelevance(value: unknown): NewsRelevance {
  const v = cleanToken(value);
  return v === "direct" || v === "sector" || v === "macro" ? v : "unrelated";
}

export function normEventType(value: unknown): NewsEventType {
  const v = cleanToken(value);
  return v in EVENT_BASE ? (v as NewsEventType) : "commentary_listicle";
}

export function normSurprise(value: unknown): NewsSurprise {
  const v = cleanToken(value);
  return v === "new_material" || v === "incremental" ? v : "recycled_known";
}
