// Normal CDF via Abramowitz-Stegun erf approximation (no deps).
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export interface ForecastDirection {
  probUp: number;          // 0..100
  expectedMovePct: number; // % vs last close
}

/**
 * Approximate P(final > lastClose) and expected move from a log-normal implied by
 * the p10/median/p90 band. Used when exact ForecastStat is unavailable.
 */
export function approxForecastDirection(
  lastClose: number,
  p10: number,
  median: number,
  p90: number,
): ForecastDirection {
  if (lastClose <= 0 || median <= 0 || p10 <= 0 || p90 <= 0 || p90 <= p10) {
    return { probUp: 50, expectedMovePct: 0 };
  }
  const mu = Math.log(median);                       // log-normal median = exp(mu)
  const sigma = (Math.log(p90) - Math.log(p10)) / (2 * 1.2815515655446004); // p10/p90 = ±1.2816σ
  if (sigma <= 0) return { probUp: median > lastClose ? 100 : 0, expectedMovePct: (median / lastClose - 1) * 100 };
  const probUp = normCdf((mu - Math.log(lastClose)) / sigma) * 100;
  const mean = Math.exp(mu + (sigma * sigma) / 2);   // log-normal mean
  const expectedMovePct = (mean / lastClose - 1) * 100;
  return { probUp, expectedMovePct };
}
