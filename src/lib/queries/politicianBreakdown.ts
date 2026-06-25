import { classifyAction } from "@/lib/trades/classify";

export type BreakdownInput = {
  ticker: string;
  transactionType: string;
  amountMin: number | null;
  amountMax: number | null;
};

export type PieSlice = { name: string; value: number };

export type BuySellStats = {
  buyCount: number;
  sellCount: number;
  otherCount: number;
  buyTotal: number;
  sellTotal: number;
  ratio: number | null;
};

function minimum(min: number | null, max: number | null): number {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

export function shapeTickerBreakdown(trades: BreakdownInput[], topN: number): PieSlice[] {
  const agg = new Map<string, number>();
  for (const t of trades) {
    agg.set(t.ticker, (agg.get(t.ticker) ?? 0) + minimum(t.amountMin, t.amountMax));
  }
  const sorted = [...agg.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= topN) return sorted;
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const other = rest.reduce((acc, r) => acc + r.value, 0);
  return [...top, { name: "Other", value: other }];
}

export function computeBuySellStats(trades: BreakdownInput[]): BuySellStats {
  let buyCount = 0;
  let sellCount = 0;
  let otherCount = 0;
  let buyTotal = 0;
  let sellTotal = 0;
  for (const t of trades) {
    const m = minimum(t.amountMin, t.amountMax);
    const cls = classifyAction(t.transactionType);
    if (cls === "buy") {
      buyCount += 1;
      buyTotal += m;
    } else if (cls === "sell") {
      sellCount += 1;
      sellTotal += m;
    } else {
      otherCount += 1;
    }
  }
  return {
    buyCount,
    sellCount,
    otherCount,
    buyTotal,
    sellTotal,
    ratio: sellCount === 0 ? null : buyCount / sellCount,
  };
}
