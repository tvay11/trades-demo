import { db } from "@/lib/db";
import { minimumDollars, type Cents } from "@/lib/money";

type BacktestPriceRow = {
  date: Date;
  close: number;
};

export type BacktestInputTrade = {
  id: number;
  ticker: string;
  transactionType: string;
  transactionDate: Date;
  disclosureDate: Date;
  amountMinCents: Cents;
  amountMaxCents: Cents;
};

export type BacktestPositionResult = {
  tradeId: number;
  ticker: string;
  side: "long" | "short";
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  returnPercent: number;
  estimatedCapital: number;
};

export type DisclosureBacktestResult = {
  horizonDays: number;
  positions: BacktestPositionResult[];
  averageReturnPercent: number;
  winRate: number;
  totalEstimatedCapital: number;
};

export function computeDisclosureBacktest({
  trades,
  pricesByTicker,
  horizonDays,
}: {
  trades: BacktestInputTrade[];
  pricesByTicker: Map<string, BacktestPriceRow[]>;
  horizonDays: number;
}): DisclosureBacktestResult {
  const positions: BacktestPositionResult[] = [];

  for (const trade of trades) {
    const closes = pricesByTicker.get(trade.ticker) ?? [];
    const entry = closeOnOrAfter(trade.disclosureDate, closes);
    const exit = closeOnOrAfter(addDays(trade.disclosureDate, horizonDays), closes);
    const side = classifySide(trade.transactionType);

    if (!entry || !exit || side === "ignore" || entry.close <= 0) continue;

    const longReturn = ((exit.close - entry.close) / entry.close) * 100;
    const returnPercent = Number((side === "long" ? longReturn : -longReturn).toFixed(2));

    positions.push({
      tradeId: trade.id,
      ticker: trade.ticker,
      side,
      entryDate: entry.date,
      exitDate: exit.date,
      entryPrice: entry.close,
      exitPrice: exit.close,
      returnPercent,
      estimatedCapital: minimumDollars(trade.amountMinCents, trade.amountMaxCents),
    });
  }

  const averageReturnPercent = positions.length
    ? Number((positions.reduce((sum, row) => sum + row.returnPercent, 0) / positions.length).toFixed(2))
    : 0;
  const wins = positions.filter((row) => row.returnPercent > 0).length;

  return {
    horizonDays,
    positions,
    averageReturnPercent,
    // Percent in [0, 100], not a 0..1 ratio — the datasets table renders
    // this with kind:"percent" which adds a `%` suffix without scaling.
    winRate: positions.length ? (wins / positions.length) * 100 : 0,
    totalEstimatedCapital: positions.reduce((sum, row) => sum + row.estimatedCapital, 0),
  };
}

export async function getDisclosureBacktestSnapshot(horizonDays = 30) {
  const trades = await db.congressTrade.findMany({
    orderBy: { disclosureDate: "desc" },
    take: 500,
    select: {
      id: true,
      ticker: true,
      transactionType: true,
      transactionDate: true,
      disclosureDate: true,
      amountMinCents: true,
      amountMaxCents: true,
    },
  });
  const tickers = [...new Set(trades.map((trade) => trade.ticker))];
  const prices = await db.tickerPriceCache.findMany({
    where: { ticker: { in: tickers } },
    orderBy: [{ ticker: "asc" }, { date: "asc" }],
  });
  const pricesByTicker = new Map<string, BacktestPriceRow[]>();

  for (const price of prices) {
    const rows = pricesByTicker.get(price.ticker) ?? [];
    rows.push({ date: price.date, close: price.close / 100 });
    pricesByTicker.set(price.ticker, rows);
  }

  return computeDisclosureBacktest({ trades, pricesByTicker, horizonDays });
}

function classifySide(type: string): BacktestPositionResult["side"] | "ignore" {
  const normalized = type.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("purchase")) return "long";
  if (normalized.includes("sell") || normalized.includes("sale")) return "short";
  return "ignore";
}

function closeOnOrAfter(date: Date, closes: BacktestPriceRow[]) {
  const sorted = [...closes].sort((a, b) => a.date.getTime() - b.date.getTime());
  return sorted.find((close) => close.date.getTime() >= date.getTime()) ?? null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
