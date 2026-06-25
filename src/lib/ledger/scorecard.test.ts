import { describe, expect, it } from "vitest";

import { buildScorecard } from "./scorecard";
import type { BarPoint } from "@/components/charts/TickerPriceChart";

function risingBars(n: number): BarPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i;
    return { date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1000 };
  });
}

describe("buildScorecard", () => {
  it("returns the six scorecard rows and six trend lenses", () => {
    const { scorecard, trendGrid } = buildScorecard(risingBars(260));
    expect(scorecard.map((r) => r.label)).toEqual([
      "Trend (50>200)",
      "MACD histogram",
      "RSI(14)",
      "Bollinger %B",
      "ATR volatility",
      "Volume vs 20d",
    ]);
    expect(trendGrid).toHaveLength(6);
  });

  it("flags a sustained uptrend as bullish trend + high RSI", () => {
    const { scorecard } = buildScorecard(risingBars(260));
    const trend = scorecard.find((r) => r.label === "Trend (50>200)");
    const rsiRow = scorecard.find((r) => r.label === "RSI(14)");
    expect(trend?.signal).toBe("BULL");
    expect(rsiRow?.signal).toBe("BULL");
  });

  it("degrades gracefully on too-few bars (no throw, neutral signals)", () => {
    const { scorecard } = buildScorecard(risingBars(5));
    expect(scorecard).toHaveLength(6);
    expect(scorecard.every((r) => ["BULL", "BEAR", "NEUTRAL"].includes(r.signal))).toBe(true);
  });
});
