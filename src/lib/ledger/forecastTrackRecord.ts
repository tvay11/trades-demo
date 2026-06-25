import type { ForecastRunResult, ForecastTrackRecord } from "./types";

interface ForecastHistoryPoint {
  predDate: string;
  close: number;
  lower: number;
  upper: number;
}

interface ForecastHistoryRun {
  generatedAt: string;
  horizonDays: number;
  points: ForecastHistoryPoint[];
}

interface Bar {
  date: string;
  close: number;
}

function isoDay(s: string): string {
  return new Date(s).toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Evaluate past forecast runs against realized price bars.
 *
 * For each run:
 *  - Anchor = last bar whose date <= generatedAt date
 *  - Eval point = latest forecast point whose predDate has a realized bar
 *    (exact match preferred, else nearest bar <= predDate but > anchor date)
 *  - Require >= 5 bars between anchor and eval bar, else skip.
 *  - predictedChangePct = (point.close / anchor.close - 1) * 100
 *  - realizedChangePct  = (evalBar.close / anchor.close - 1) * 100
 *  - directionHit: signs agree (ties < 0.5% are a hit if both predicted and
 *    realized are also < 0.5%)
 *  - withinBand: evalBar.close >= point.lower && evalBar.close <= point.upper
 */
export function evaluateForecastRuns(
  runs: ForecastHistoryRun[],
  bars: Bar[],
): ForecastTrackRecord {
  const results: ForecastRunResult[] = [];

  for (const run of runs) {
    const anchorDateStr = isoDay(run.generatedAt);

    // Find anchor bar: last bar with date <= anchorDateStr
    let anchorIdx = -1;
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].date <= anchorDateStr) {
        anchorIdx = i;
        break;
      }
    }
    if (anchorIdx === -1) continue;
    const anchorBar = bars[anchorIdx];

    // Sort points by predDate descending and try each until we find one with a bar
    const sortedPoints = [...run.points].sort(
      (a, b) => new Date(b.predDate).getTime() - new Date(a.predDate).getTime(),
    );

    let evalBar: Bar | null = null;
    let evalPoint: ForecastHistoryPoint | null = null;
    let evalBarIdx = -1;

    for (const pt of sortedPoints) {
      const predDayStr = isoDay(pt.predDate);

      // Try exact match first
      let candidateIdx = bars.findIndex((b) => b.date === predDayStr);

      // Else nearest bar <= predDate but > anchor date
      if (candidateIdx === -1) {
        for (let i = bars.length - 1; i > anchorIdx; i--) {
          if (bars[i].date <= predDayStr) {
            candidateIdx = i;
            break;
          }
        }
      }

      if (candidateIdx > anchorIdx) {
        evalBarIdx = candidateIdx;
        evalBar = bars[candidateIdx];
        evalPoint = pt;
        break;
      }
    }

    if (!evalBar || !evalPoint) continue;

    // Require >= 5 bars between anchor and eval bar (exclusive of anchor, inclusive of eval)
    const daysElapsed = evalBarIdx - anchorIdx;
    if (daysElapsed < 5) continue;

    const predictedChangePct = (evalPoint.close / anchorBar.close - 1) * 100;
    const realizedChangePct = (evalBar.close / anchorBar.close - 1) * 100;

    // Direction hit: signs agree; treat |move| < 0.5% as a miss only if predicted >= 0.5%
    const absRealized = Math.abs(realizedChangePct);
    const absPredicted = Math.abs(predictedChangePct);
    let directionHit: boolean;
    if (absPredicted < 0.5 && absRealized < 0.5) {
      directionHit = true; // both flat
    } else if (absRealized < 0.5) {
      directionHit = false; // realized flat but predicted a move
    } else {
      directionHit = Math.sign(predictedChangePct) === Math.sign(realizedChangePct);
    }

    const withinBand =
      evalBar.close >= evalPoint.lower && evalBar.close <= evalPoint.upper;

    results.push({
      generatedAt: run.generatedAt,
      horizonDays: run.horizonDays,
      daysElapsed,
      predictedChangePct,
      realizedChangePct,
      directionHit,
      withinBand,
    });
  }

  const n = results.length;
  if (n === 0) {
    return { runs: results, n: 0, hitRate: null, medianAbsErrPct: null, bandCoveragePct: null };
  }

  const hits = results.filter((r) => r.directionHit).length;
  const within = results.filter((r) => r.withinBand).length;
  const absErrors = results.map((r) => Math.abs(r.predictedChangePct - r.realizedChangePct));

  return {
    runs: results,
    n,
    hitRate: (hits / n) * 100,
    medianAbsErrPct: median(absErrors),
    bandCoveragePct: (within / n) * 100,
  };
}
