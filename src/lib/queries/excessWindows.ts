import { db } from "@/lib/db";
import { excessReturnPct, type PriceRow } from "@/lib/analysis/windowReturns";

export interface ExcessWindowsResult {
  avgExcess7: number | null;
  avgExcess30: number | null;
  avgExcess90: number | null;
  samples30: number;
  positive30Pct: number | null;
}

const ALL_NULL: ExcessWindowsResult = {
  avgExcess7: null,
  avgExcess30: null,
  avgExcess90: null,
  samples30: 0,
  positive30Pct: null,
};

function classifySide(type: string): "long" | "short" | "ignore" {
  const normalized = type.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("purchase")) return "long";
  if (normalized.includes("sell") || normalized.includes("sale")) return "short";
  return "ignore";
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function shapeExcessWindows(
  trades: { transactionType: string; disclosureDate: Date }[],
  tickerRows: PriceRow[],
  spyRows: PriceRow[],
): ExcessWindowsResult {
  const excess7: number[] = [];
  const excess30: number[] = [];
  const excess90: number[] = [];

  for (const trade of trades) {
    const side = classifySide(trade.transactionType);
    if (side === "ignore") continue;
    const start = trade.disclosureDate;

    const r7 = excessReturnPct(side, start, 7, tickerRows, spyRows);
    if (r7) excess7.push(r7.excessPct);

    const r30 = excessReturnPct(side, start, 30, tickerRows, spyRows);
    if (r30) excess30.push(r30.excessPct);

    const r90 = excessReturnPct(side, start, 90, tickerRows, spyRows);
    if (r90) excess90.push(r90.excessPct);
  }

  const samples30 = excess30.length;
  const positive30Pct =
    samples30 > 0 ? (excess30.filter((v) => v > 0).length / samples30) * 100 : null;

  return {
    avgExcess7: avg(excess7),
    avgExcess30: avg(excess30),
    avgExcess90: avg(excess90),
    samples30,
    positive30Pct,
  };
}

export async function getExcessWindows(ticker: string): Promise<ExcessWindowsResult> {
  try {
    const [tickerPrices, spyPrices, trades] = await Promise.all([
      db.tickerPriceCache.findMany({
        where: { ticker },
        orderBy: { date: "asc" },
        select: { date: true, close: true },
      }),
      db.tickerPriceCache.findMany({
        where: { ticker: "SPY" },
        orderBy: { date: "asc" },
        select: { date: true, close: true },
      }),
      db.congressTrade.findMany({
        where: { ticker },
        select: { transactionType: true, disclosureDate: true },
      }),
    ]);

    const tickerRows: PriceRow[] = tickerPrices.map((r) => ({ date: r.date, close: r.close / 100 }));
    const spyRows: PriceRow[] = spyPrices.map((r) => ({ date: r.date, close: r.close / 100 }));

    return shapeExcessWindows(trades, tickerRows, spyRows);
  } catch {
    return ALL_NULL;
  }
}
