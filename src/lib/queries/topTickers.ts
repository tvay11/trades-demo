import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/money";

export type TopTickerInput = {
  ticker: string;
  amountMin: number | null;
  amountMax: number | null;
};

export type TopTickerRow = {
  ticker: string;
  count: number;
  total: number;
};

function minimum(min: number | null, max: number | null): number {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

export function shapeTopTickers(trades: TopTickerInput[], limit: number): TopTickerRow[] {
  const agg = new Map<string, TopTickerRow>();
  for (const t of trades) {
    const row = agg.get(t.ticker) ?? { ticker: t.ticker, count: 0, total: 0 };
    row.count += 1;
    row.total += minimum(t.amountMin, t.amountMax);
    agg.set(t.ticker, row);
  }
  return [...agg.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export async function getTopTickers(daysBack: number, limit = 15): Promise<TopTickerRow[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000);
  // Pull both branches in parallel. Congressional disclosures gate on
  // `disclosureDate` (when the public saw the trade); executive OGE-278
  // disclosures don't carry a separate disclosure date so we gate on
  // `transactionDate`. Both feed the same per-ticker aggregator so the
  // ranking reflects all disclosed activity, not just congressional.
  const [congressRows, executiveRows] = await Promise.all([
    db.congressTrade.findMany({
      where: { disclosureDate: { gte: since } },
      select: { ticker: true, amountMinCents: true, amountMaxCents: true },
    }),
    db.executiveTrade.findMany({
      where: { transactionDate: { gte: since }, ticker: { not: null } },
      select: { ticker: true, amountMinCents: true, amountMaxCents: true },
    }),
  ]);

  const inputs: TopTickerInput[] = [
    ...congressRows.map((r) => ({
      ticker: r.ticker,
      amountMin: centsToDollars(r.amountMinCents),
      amountMax: centsToDollars(r.amountMaxCents),
    })),
    ...executiveRows
      // Filter step is belt-and-suspenders: the Prisma `where` already
      // excludes null tickers, but the schema marks the column nullable so
      // narrow it for TypeScript here.
      .filter((r): r is typeof r & { ticker: string } => r.ticker != null)
      .map((r) => ({
        ticker: r.ticker,
        amountMin: centsToDollars(r.amountMinCents),
        amountMax: centsToDollars(r.amountMaxCents),
      })),
  ];

  return shapeTopTickers(inputs, limit);
}
