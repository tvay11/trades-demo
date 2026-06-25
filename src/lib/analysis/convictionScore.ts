import type { TradeSide } from "./windowReturns";

export interface ConvictionInput {
  side: TradeSide;
  daysSinceDisclosure: number;
  amountMinDollars: number;
  trackRecord: { samples: number; hitRate30: number; avgExcess30: number } | null;
  committeeLinked: boolean;
  dualInsiderConfirmed: boolean;
  /** Off-exchange short-volume excess vs baseline, percentage points; null when unknown. */
  darkFlowExcessPp: number | null;
}

export interface ConvictionComponent { label: string; pts: number; max: number }
export interface ConvictionResult { score: number; breakdown: ConvictionComponent[] }

const NEUTRAL_TRACK_PTS = 8;
const MIN_SAMPLES = 5;

function trackRecordPts(tr: ConvictionInput["trackRecord"]): number {
  if (!tr || tr.samples < MIN_SAMPLES) return NEUTRAL_TRACK_PTS;
  const base = tr.avgExcess30 >= 5 ? 24 : tr.avgExcess30 >= 2 ? 18 : tr.avgExcess30 >= 0 ? 12 : tr.avgExcess30 >= -2 ? 6 : 0;
  const bonus = tr.hitRate30 >= 60 ? 6 : tr.hitRate30 >= 50 ? 3 : 0;
  return Math.min(base + bonus, 30);
}

function recencyPts(days: number): number {
  return days <= 3 ? 20 : days <= 7 ? 16 : days <= 14 ? 12 : days <= 30 ? 6 : 2;
}

function sizePts(dollars: number): number {
  return dollars >= 1_000_000 ? 20 : dollars >= 250_000 ? 15 : dollars >= 100_000 ? 11 : dollars >= 50_000 ? 8 : dollars >= 15_000 ? 4 : 2;
}

function darkFlowPts(side: TradeSide, excessPp: number | null): number {
  if (excessPp == null) return 0;
  if (side === "short" && excessPp >= 5) return 10;
  if (side === "long" && excessPp <= -5) return 10;
  return 0;
}

export function scoreTrade(input: ConvictionInput): ConvictionResult {
  const breakdown: ConvictionComponent[] = [
    { label: "Track record", pts: trackRecordPts(input.trackRecord), max: 30 },
    { label: "Recency", pts: recencyPts(input.daysSinceDisclosure), max: 20 },
    { label: "Size", pts: sizePts(input.amountMinDollars), max: 20 },
    { label: "Committee", pts: input.committeeLinked ? 10 : 0, max: 10 },
    { label: "Dual insider", pts: input.dualInsiderConfirmed ? 10 : 0, max: 10 },
    { label: "Dark flow", pts: darkFlowPts(input.side, input.darkFlowExcessPp), max: 10 },
  ];
  return { score: breakdown.reduce((s, c) => s + c.pts, 0), breakdown };
}
