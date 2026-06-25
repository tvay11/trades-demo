import type { LongShortCandidate } from "./marketSignals";
import type { TickerCongressTrade } from "./tickerDetail";

export type LongShortFactMetrics = {
  tradeCount: number;
  buyCountPercent: number;
  sellCountPercent: number;
  buyDollarPercent: number;
  sellDollarPercent: number;
  totalPressure: number;
  averageDisclosureLagDays: number;
};

export type StockTradeFacts = {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  otherCount: number;
  estimatedVolume: number;
  buyVolume: number;
  sellVolume: number;
  buyCountPercent: number;
  sellCountPercent: number;
  buyDollarPercent: number;
  sellDollarPercent: number;
  averageReturn7d: number | null;
  averageReturn30d: number | null;
  averageReturn90d: number | null;
  positiveReturn30dPercent: number;
  committeeRelevantTradeCount: number;
  committeeRelevantTradePercent: number;
};

export function safePercent(part: number, total: number, digits = 1) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return round((part / total) * 100, digits);
}

export function longShortFactMetrics(candidate: LongShortCandidate): LongShortFactMetrics {
  const tradeCount = candidate.buyCount + candidate.sellCount;
  const totalPressure = candidate.estimatedBuyVolume + candidate.estimatedSellVolume;

  return {
    tradeCount,
    buyCountPercent: safePercent(candidate.buyCount, tradeCount),
    sellCountPercent: safePercent(candidate.sellCount, tradeCount),
    buyDollarPercent: safePercent(candidate.estimatedBuyVolume, totalPressure),
    sellDollarPercent: safePercent(candidate.estimatedSellVolume, totalPressure),
    totalPressure,
    averageDisclosureLagDays: candidate.averageDisclosureLagDays,
  };
}

export function stockTradeFacts(trades: TickerCongressTrade[]): StockTradeFacts {
  const buyRows = trades.filter((trade) => trade.action === "buy");
  const sellRows = trades.filter((trade) => trade.action === "sell");
  const otherRows = trades.filter((trade) => trade.action === "other");
  const buyVolume = buyRows.reduce((sum, trade) => sum + trade.amountMinimum, 0);
  const sellVolume = sellRows.reduce((sum, trade) => sum + trade.amountMinimum, 0);
  const estimatedVolume = trades.reduce((sum, trade) => sum + trade.amountMinimum, 0);
  const returns30d = nonNull(trades.map((trade) => trade.return30dFromDisclosure));
  const committeeRelevantTradeCount = trades.filter(
    (trade) =>
      trade.committeeRelevance.label !== "Low" || trade.committeeRelevance.score > 0,
  ).length;

  return {
    tradeCount: trades.length,
    buyCount: buyRows.length,
    sellCount: sellRows.length,
    otherCount: otherRows.length,
    estimatedVolume,
    buyVolume,
    sellVolume,
    buyCountPercent: safePercent(buyRows.length, trades.length),
    sellCountPercent: safePercent(sellRows.length, trades.length),
    buyDollarPercent: safePercent(buyVolume, buyVolume + sellVolume),
    sellDollarPercent: safePercent(sellVolume, buyVolume + sellVolume),
    averageReturn7d: average(nonNull(trades.map((trade) => trade.return7dFromDisclosure))),
    averageReturn30d: average(returns30d),
    averageReturn90d: average(nonNull(trades.map((trade) => trade.return90dFromDisclosure))),
    positiveReturn30dPercent: safePercent(
      returns30d.filter((value) => value > 0).length,
      returns30d.length,
    ),
    committeeRelevantTradeCount,
    committeeRelevantTradePercent: safePercent(committeeRelevantTradeCount, trades.length),
  };
}

function nonNull(values: Array<number | null>) {
  return values.filter((value): value is number => value != null);
}

function average(values: number[]) {
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function round(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
