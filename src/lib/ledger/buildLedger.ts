import { sma } from "@/lib/ta/indicators";
import { approxForecastDirection } from "@/lib/forecast/direction";
import { buildHouseCall, type HouseCallInputs } from "./houseCall";
import { buildScorecard } from "./scorecard";
import { momentumRows } from "./momentumStats";
import { newsSkew } from "./news";
import { buildTradeLens } from "./tradeLens";
import { scoreForensics } from "@/lib/analysis/forensics";
import type { Confidence, ForecastSummary, Ledger, LedgerInputs } from "./types";

const SNAPSHOT_BARS = 260;

function confidenceFromBand(bandPct: number): Confidence {
  if (bandPct < 5) return "NARROW";
  if (bandPct <= 10) return "MODERATE";
  return "WIDE";
}

export function assessForecastSuspect(args: {
  movePct: number;
  bandPct: number;
  probUp: number | null;
}): { suspect: boolean; suspectReason: string | null } {
  const absMove = Math.abs(args.movePct);
  if (absMove >= 35 && args.bandPct < 5) {
    return {
      suspect: true,
      suspectReason: `±${args.bandPct.toFixed(1)}% band on a ${args.movePct >= 0 ? "+" : ""}${args.movePct.toFixed(0)}% move — model likely mean-reverting to stale price levels`,
    };
  }
  if (args.probUp != null && (args.probUp >= 99 || args.probUp <= 1) && absMove >= 25) {
    return {
      suspect: true,
      suspectReason: `P(up) ${args.probUp.toFixed(0)}% on a ${args.movePct >= 0 ? "+" : ""}${args.movePct.toFixed(0)}% move — near-certain probabilities on large moves are a model failure signature`,
    };
  }
  return { suspect: false, suspectReason: null };
}

function summarizeForecast(
  lastClose: number | null,
  forecast: LedgerInputs["forecast"],
): ForecastSummary | null {
  if (!forecast || forecast.points.length === 0 || lastClose == null) return null;
  const finalPt = forecast.points[forecast.points.length - 1];
  const predictedClose = finalPt.close;
  const halfBand = (finalPt.upper - finalPt.lower) / 2;
  const bandPct = predictedClose ? (halfBand / predictedClose) * 100 : 0;
  const exact = forecast.probUp != null && forecast.expectedMovePct != null;
  const dir = exact
    ? { probUp: forecast.probUp!, expectedMovePct: forecast.expectedMovePct! }
    : approxForecastDirection(lastClose, finalPt.lower, finalPt.close, finalPt.upper);
  const changePctValue = lastClose ? ((predictedClose - lastClose) / lastClose) * 100 : 0;
  const { suspect, suspectReason } = assessForecastSuspect({
    movePct: dir.expectedMovePct ?? changePctValue,
    bandPct,
    probUp: dir.probUp,
  });
  return {
    lastClose,
    predictedClose,
    changePct: changePctValue,
    bandPct,
    confidence: confidenceFromBand(bandPct),
    horizonDays: forecast.horizonDays,
    probUp: dir.probUp,
    expectedMovePct: dir.expectedMovePct,
    suspect,
    suspectReason,
  };
}

/** Re-derive HouseCallInputs from a finished ledger so generateReport can
 * recompute the house call after street-momentum is available.
 * Uses the same logic as buildLedger: sma50 from ledger.bars, all other
 * inputs from the ledger fields that were set during build. */
export function houseCallInputsFromLedger(ledger: Ledger): HouseCallInputs {
  const closes = ledger.bars.map((b) => b.close);
  const sma50Arr = sma(closes, 50);
  const sma50 = sma50Arr[sma50Arr.length - 1] ?? null;
  return {
    scorecard: ledger.scorecard,
    lastClose: ledger.lastClose,
    sma50,
    signals: ledger.signals ? { congressNetFlowLabel: ledger.signals.congressNetFlowLabel } : null,
    fundamentals: ledger.fundamentals ? { revenueYoYPct: ledger.fundamentals.annual?.revenueYoYPct ?? null } : null,
    macro: ledger.macro ?? null,
    options: ledger.options ?? null,
    valuation: ledger.valuation ?? null,
    analyst: ledger.analyst ?? null,
    altFlow: ledger.altFlow
      ? { darkShortExcessPp: ledger.altFlow.darkShort?.excessPp ?? null, govContractUsd180d: ledger.altFlow.govContracts?.totalUsd180d ?? null }
      : null,
  };
}

export function buildLedger(inputs: LedgerInputs): Ledger {
  const { scorecard: baseScorecard, trendGrid } = buildScorecard(inputs.bars);
  const barsForMomentum = inputs.bars.map((b) => ({ date: b.date, close: b.close }));
  const scorecard = [
    ...baseScorecard,
    ...momentumRows(barsForMomentum, inputs.benchmarkBars ?? null),
  ];
  const closes = inputs.bars.map((b) => b.close);
  const lastClose = closes.length ? closes[closes.length - 1] : null;
  const sma50Arr = sma(closes, 50);
  const sma50 = sma50Arr[sma50Arr.length - 1] ?? null;

  const forecast = summarizeForecast(lastClose, inputs.forecast);

  const analyst = inputs.analyst
    ? {
        ...inputs.analyst,
        upsidePct:
          inputs.analyst.targetMean != null && lastClose != null && lastClose !== 0
            ? (inputs.analyst.targetMean / lastClose - 1) * 100
            : inputs.analyst.upsidePct,
      }
    : null;

  const altFlow = inputs.altFlow ?? null;
  const houseCall = buildHouseCall({
    scorecard,
    lastClose,
    sma50,
    signals: inputs.signals ? { congressNetFlowLabel: inputs.signals.congressNetFlowLabel } : null,
    fundamentals: inputs.fundamentals ? { revenueYoYPct: inputs.fundamentals.annual?.revenueYoYPct ?? null } : null,
    macro: inputs.macro ?? null,
    options: inputs.options ?? null,
    valuation: inputs.valuation ?? null,
    analyst,
    altFlow: altFlow ? { darkShortExcessPp: altFlow.darkShort?.excessPp ?? null, govContractUsd180d: altFlow.govContracts?.totalUsd180d ?? null } : null,
  });

  return {
    ticker: inputs.ticker,
    companyName: inputs.companyName,
    generatedAt: new Date().toISOString(),
    lastClose,
    scorecard,
    trendGrid,
    houseCall,
    forecast,
    fundamentals: inputs.fundamentals,
    signals: inputs.signals,
    news: inputs.news,
    newsSkew: newsSkew(inputs.news),
    consensusTarget: inputs.consensusTarget,
    bars: inputs.bars.slice(-SNAPSHOT_BARS),
    forecastPoints: inputs.forecast?.points ?? [],
    analystNote: null,
    analystAnalysis: null,
    geopolitical: null,
    fundamentalsInsight: null,
    longTermPlay: null,
    officialTrades: inputs.officialTrades ?? [],
    insiderTrades: inputs.insiderTrades ?? [],
    macro: inputs.macro ?? null,
    options: inputs.options ?? null,
    valuation: inputs.valuation ?? null,
    analyst,
    shortInterest: inputs.shortInterest ?? null,
    nextEarnings: null,
    tradeLens: buildTradeLens(forecast, inputs.options ?? null, altFlow?.wsb?.crowded ?? false),
    forecastTrackRecord: null,
    streetMomentum: null,
    altFlow,
    riskShift: null,
    forensics: scoreForensics(inputs.fundamentals?.forensicsSeries ?? []),
    segments: null,
  };
}
