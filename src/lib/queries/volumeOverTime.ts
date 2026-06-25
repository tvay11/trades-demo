import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/money";

export type VolumeTradeInput = {
  date: Date;
  amountMin: number | null;
  amountMax: number | null;
  party: string | null;
};

export type VolumeBucket = {
  week: string; // ISO 8601 e.g. "2025-W36"
  total: number;
  dem: number;
  rep: number;
  ind: number;
};

function minimum(min: number | null, max: number | null): number {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

function isoWeekLabel(date: Date): string {
  // Algorithm per ISO 8601: week 1 contains the first Thursday of the year.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function shapeVolumeOverTime(trades: VolumeTradeInput[]): VolumeBucket[] {
  const buckets = new Map<string, VolumeBucket>();
  for (const t of trades) {
    const week = isoWeekLabel(t.date);
    const m = minimum(t.amountMin, t.amountMax);
    const b = buckets.get(week) ?? { week, total: 0, dem: 0, rep: 0, ind: 0 };
    b.total += m;
    if (t.party === "D") b.dem += m;
    else if (t.party === "R") b.rep += m;
    else b.ind += m;
    buckets.set(week, b);
  }
  return [...buckets.values()].sort((a, b) => a.week.localeCompare(b.week));
}

export async function getVolumeOverTime(daysBack = 365): Promise<VolumeBucket[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000);
  const rows = await db.congressTrade.findMany({
    where: { disclosureDate: { gte: since } },
    select: {
      disclosureDate: true,
      amountMinCents: true,
      amountMaxCents: true,
      politician: { select: { party: true } },
    },
  });
  return shapeVolumeOverTime(
    rows.map((r) => ({
      date: r.disclosureDate,
      amountMin: centsToDollars(r.amountMinCents),
      amountMax: centsToDollars(r.amountMaxCents),
      party: r.politician.party,
    })),
  );
}
