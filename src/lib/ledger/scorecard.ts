import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { atr, bollinger, macd, rsi, sma, volumeVsAvg } from "@/lib/ta/indicators";
import type { ScorecardRow, Signal, TrendLens } from "./types";

const last = <T,>(arr: T[]): T | undefined => arr[arr.length - 1];

function rsiSignal(v: number | null): Signal {
  if (v == null) return "NEUTRAL";
  if (v >= 70) return "BULL";
  if (v <= 30) return "BEAR";
  return "NEUTRAL";
}

export function buildScorecard(bars: BarPoint[]): {
  scorecard: ScorecardRow[];
  trendGrid: TrendLens[];
} {
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const sma50 = last(sma(closes, 50)) ?? null;
  const sma200 = last(sma(closes, 200)) ?? null;
  const rsiVal = last(rsi(closes, 14)) ?? null;
  const { histogram } = macd(closes, 12, 26, 9);
  const macdHist = closes.length ? histogram[histogram.length - 1] : null;
  const { percentB } = bollinger(closes, 20, 2);
  const pctB = last(percentB) ?? null;
  const atrVal = last(atr(bars, 14)) ?? null;
  const lastClose = last(closes) ?? null;
  const atrPct = atrVal != null && lastClose ? (atrVal / lastClose) * 100 : null;
  const volRel = volumeVsAvg(volumes, 20);

  const trendSignal: Signal =
    sma50 != null && sma200 != null ? (sma50 > sma200 ? "BULL" : "BEAR") : "NEUTRAL";
  const macdSignal: Signal =
    macdHist == null ? "NEUTRAL" : macdHist > 0 ? "BULL" : macdHist < 0 ? "BEAR" : "NEUTRAL";
  const pctBSignal: Signal =
    pctB == null ? "NEUTRAL" : pctB > 0.8 ? "BULL" : pctB < 0.2 ? "BEAR" : "NEUTRAL";
  const volSignal: Signal =
    volRel == null ? "NEUTRAL" : volRel > 0.1 ? "BULL" : volRel < -0.1 ? "BEAR" : "NEUTRAL";

  const fmt = (v: number | null, suffix = "", digits = 2) =>
    v == null ? "—" : `${v.toFixed(digits)}${suffix}`;

  const scorecard: ScorecardRow[] = [
    { label: "Trend (50>200)", value: sma50 != null && sma200 != null ? (sma50 > sma200 ? "✓ above" : "✗ below") : "—", signal: trendSignal },
    { label: "MACD histogram", value: fmt(macdHist), signal: macdSignal },
    { label: "RSI(14)", value: fmt(rsiVal, "", 1), signal: rsiSignal(rsiVal) },
    { label: "Bollinger %B", value: fmt(pctB), signal: pctBSignal },
    { label: "ATR volatility", value: fmt(atrPct, "%/day", 1), signal: "NEUTRAL" },
    { label: "Volume vs 20d", value: volRel == null ? "—" : `${volRel >= 0 ? "+" : ""}${(volRel * 100).toFixed(0)}%`, signal: volSignal },
  ];

  const trendGrid: TrendLens[] = [
    { label: "Long-term trend", verdict: sma50 != null && sma200 != null ? `${(sma50 / sma200 * 100 - 100).toFixed(1)}% ${sma50 > sma200 ? "above" : "below"}` : "—", signal: trendSignal },
    { label: "Momentum (MACD)", verdict: macdHist != null ? `${macdHist >= 0 ? "+" : ""}${macdHist.toFixed(2)}` : "—", signal: macdSignal },
    { label: "RSI (14)", verdict: rsiVal != null ? rsiVal.toFixed(1) : "—", signal: rsiSignal(rsiVal) },
    { label: "Bollinger %B", verdict: pctB != null ? pctB.toFixed(2) : "—", signal: pctBSignal },
    { label: "ATR", verdict: atrPct != null ? `${atrPct.toFixed(1)}%/day` : "—", signal: "NEUTRAL" },
    { label: "Volume vs 20d", verdict: volRel != null ? `${volRel >= 0 ? "+" : ""}${(volRel * 100).toFixed(0)}%` : "—", signal: volSignal },
  ];

  return { scorecard, trendGrid };
}
