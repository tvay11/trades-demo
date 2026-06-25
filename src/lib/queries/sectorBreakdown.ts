import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/money";
import { sectorOf } from "@/lib/sectors";

export type SectorInput = {
  ticker: string;
  amountMin: number | null;
  amountMax: number | null;
};

export type SectorRow = {
  sector: string;
  value: number;
};

function minimum(min: number | null, max: number | null): number {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

export function shapeSectorBreakdown(trades: SectorInput[]): SectorRow[] {
  const agg = new Map<string, number>();
  for (const t of trades) {
    const sector = sectorOf(t.ticker);
    agg.set(sector, (agg.get(sector) ?? 0) + minimum(t.amountMin, t.amountMax));
  }
  return [...agg.entries()]
    .filter(([, value]) => value > 0)
    .map(([sector, value]) => ({ sector, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getSectorBreakdown(daysBack: number): Promise<SectorRow[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000);
  const rows = await db.congressTrade.findMany({
    where: { disclosureDate: { gte: since } },
    select: { ticker: true, amountMinCents: true, amountMaxCents: true },
  });
  return shapeSectorBreakdown(
    rows.map((r) => ({
      ticker: r.ticker,
      amountMin: centsToDollars(r.amountMinCents),
      amountMax: centsToDollars(r.amountMaxCents),
    })),
  );
}
