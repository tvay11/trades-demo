import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/money";

export type TopTraderInput = {
  politicianId: number;
  name: string;
  party: string | null;
  state: string | null;
  chamber: string | null;
  amountMin: number | null;
  amountMax: number | null;
};

export type TopTraderRow = {
  politicianId: number;
  name: string;
  party: string | null;
  state: string | null;
  chamber: string | null;
  count: number;
  total: number;
};

function minimum(min: number | null, max: number | null): number {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

export function shapeTopTraders(trades: TopTraderInput[], limit: number): TopTraderRow[] {
  const agg = new Map<number, TopTraderRow>();
  for (const t of trades) {
    const row = agg.get(t.politicianId) ?? {
      politicianId: t.politicianId,
      name: t.name,
      party: t.party,
      state: t.state,
      chamber: t.chamber,
      count: 0,
      total: 0,
    };
    row.count += 1;
    row.total += minimum(t.amountMin, t.amountMax);
    agg.set(t.politicianId, row);
  }
  return [...agg.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export async function getTopTraders(daysBack: number, limit = 15): Promise<TopTraderRow[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000);
  const rows = await db.congressTrade.findMany({
    // Filter by disclosureDate to match getTopTickers — the two functions
    // accept the same `daysBack` and feed the same "Top X over N days" UI,
    // so they must use the same date axis to produce comparable denominators.
    // (Quiver discloses transactions up to 45 days late.)
    where: { disclosureDate: { gte: since } },
    select: {
      amountMinCents: true,
      amountMaxCents: true,
      politician: {
        select: { id: true, name: true, party: true, state: true, chamber: true },
      },
    },
  });
  return shapeTopTraders(
    rows.map((r) => ({
      politicianId: r.politician.id,
      name: r.politician.name,
      party: r.politician.party,
      state: r.politician.state,
      chamber: r.politician.chamber,
      amountMin: centsToDollars(r.amountMinCents),
      amountMax: centsToDollars(r.amountMaxCents),
    })),
    limit,
  );
}
