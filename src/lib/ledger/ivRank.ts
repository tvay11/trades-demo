/** IV rank: % of this ticker's own historical ATM-IV snapshots strictly below
 * the current value. Needs ≥5 samples; self-accumulates as reports are made. */
export function computeIvRank(currentIvPct: number, historyIvPct: number[]): number | null {
  if (historyIvPct.length < 5) return null;
  const below = historyIvPct.filter((v) => v < currentIvPct).length;
  return Math.round((below / historyIvPct.length) * 100);
}
