export interface ScreenerSignals {
  tradeCount90: number;     // unified congress+exec disclosures, 90d
  tradeCount14: number;     // 14d (for acceleration)
  marketCap: number | null;
}

export interface ScreenerIdea {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  marketCap: number | null;
  tradeCount90: number;
  tradeCount14: number;
  accel: number;            // 14d activity vs pro-rated 90d
  score: number;            // composite interest score, ~0..100
  tags: string[];           // e.g. ["heating up", "high activity"]
}

function clamp(x: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, x)); }

export function scoreScreenerRow(s: ScreenerSignals): Omit<ScreenerIdea, "ticker" | "companyName" | "sector"> {
  // Activity: log-scaled 90d disclosure count → 0..65
  const activity = clamp(Math.log10(s.tradeCount90 + 1) * 36, 0, 65);
  // Acceleration: 14d vs pro-rated 90d (14/90 ≈ 0.156). Positive = heating up.
  const expected14 = s.tradeCount90 * (14 / 90);
  const accel = s.tradeCount14 - expected14;
  const accelScore = clamp(accel * 7, -20, 35);
  const score = clamp(activity + accelScore);

  const tags: string[] = [];
  if (accel > 2) tags.push("heating up");
  if (s.tradeCount90 >= 20) tags.push("high activity");

  return {
    marketCap: s.marketCap, tradeCount90: s.tradeCount90, tradeCount14: s.tradeCount14,
    accel: Number(accel.toFixed(1)),
    score: Math.round(score), tags,
  };
}
