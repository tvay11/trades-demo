import type { ConvictionComponent } from "./convictionScore";
import type { TradeSide } from "./windowReturns";

export interface ScoredTrade {
  ticker: string;
  side: TradeSide;
  score: number;
  breakdown: ConvictionComponent[];
  tradeId: number;
}

export interface TickerConviction {
  ticker: string;
  side: TradeSide;
  score: number;
  breakdown: ConvictionComponent[];
  topTradeId: number;
}

/** Per-ticker conviction = the single strongest scored trade for that ticker. */
export function rollupTickerConviction(trades: ScoredTrade[]): TickerConviction[] {
  const best = new Map<string, ScoredTrade>();
  for (const t of trades) {
    const cur = best.get(t.ticker);
    if (!cur || t.score > cur.score) best.set(t.ticker, t);
  }
  return [...best.values()].map((t) => ({
    ticker: t.ticker,
    side: t.side,
    score: t.score,
    breakdown: t.breakdown,
    topTradeId: t.tradeId,
  }));
}
