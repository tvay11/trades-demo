import type { GeoChannel, GeoExposure, GeoStatus } from "./types";

/** Deterministic geopolitical-importance rubric. The LLM supplies categorical
 * facets; this module — not the LLM — owns the 0–1 number, so the score means
 * the same thing on every report and vague macro chatter structurally cannot
 * score high. Mirrors newsImportance.ts. */

export const CHANNEL_BASE: Record<GeoChannel, number> = {
  sanctions_export_controls: 0.9,
  tariffs_trade: 0.85,
  regulation_policy: 0.7,
  armed_conflict_security: 0.65,
  energy_commodities: 0.55,
  monetary_fiscal: 0.5,
  elections_political: 0.4,
  diplomacy_summits: 0.3,
};

export const EXPOSURE_MULT: Record<GeoExposure, number> = {
  company_targeted: 1,
  sector_supply_chain: 0.55,
  macro_broad: 0.25,
};

export const STATUS_MULT: Record<GeoStatus, number> = {
  in_effect: 1,
  proposed_likely: 0.7,
  speculative_rumor: 0.4,
};

export function computeGeoImportance(
  exposure: GeoExposure,
  channel: GeoChannel,
  status: GeoStatus,
): number {
  const raw = CHANNEL_BASE[channel] * EXPOSURE_MULT[exposure] * STATUS_MULT[status];
  return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
}

function cleanToken(value: unknown): string {
  return String(value ?? "").toLowerCase().trim().replace(/[^a-z_]/g, "");
}

/** Unknown/missing facets fall back to the most conservative option so
 * malformed LLM output scores low, never high. */
export function normGeoChannel(value: unknown): GeoChannel {
  const v = cleanToken(value);
  return v in CHANNEL_BASE ? (v as GeoChannel) : "diplomacy_summits";
}

export function normGeoExposure(value: unknown): GeoExposure {
  const v = cleanToken(value);
  return v === "company_targeted" || v === "sector_supply_chain" ? v : "macro_broad";
}

export function normGeoStatus(value: unknown): GeoStatus {
  const v = cleanToken(value);
  return v === "in_effect" || v === "proposed_likely" ? v : "speculative_rumor";
}
