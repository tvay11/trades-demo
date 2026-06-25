export function normalizeNewsScore(score: unknown): number {
  const value = typeof score === "number" ? score : typeof score === "string" ? Number(score) : Number.NaN;
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
