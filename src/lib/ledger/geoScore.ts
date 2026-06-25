type LegacyGeoMagnitude = "high" | "medium" | "low";

const LEGACY_MAGNITUDE_SCORE: Record<LegacyGeoMagnitude, number> = {
  high: 0.85,
  medium: 0.55,
  low: 0.25,
};

export function scoreFromLegacyMagnitude(value: unknown): number {
  const magnitude = String(value ?? "").toLowerCase();
  if (magnitude === "high" || magnitude === "medium" || magnitude === "low") {
    return LEGACY_MAGNITUDE_SCORE[magnitude];
  }
  return 0.5;
}

export function normalizeGeoScore(score: unknown, legacyMagnitude?: unknown): number {
  const value = typeof score === "number" ? score : typeof score === "string" ? Number(score) : Number.NaN;
  if (Number.isFinite(value)) return Math.min(1, Math.max(0, value));
  return scoreFromLegacyMagnitude(legacyMagnitude);
}
