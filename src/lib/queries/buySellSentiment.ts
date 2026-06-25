import { centsToDollars } from "@/lib/money";
import { classifyAction } from "@/lib/trades/classify";
import { fetchAllTrades } from "@/lib/trades/unified";

export type SentimentInput = {
  date: Date;
  transactionType: string;
  amountMin: number | null;
  amountMax: number | null;
};

export type SentimentBucket = {
  week: string;
  sentiment: number;
};

function minimum(min: number | null, max: number | null): number {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function shapeBuySellSentiment(trades: SentimentInput[]): SentimentBucket[] {
  const buckets = new Map<string, number>();
  for (const t of trades) {
    const week = isoWeekLabel(t.date);
    const m = minimum(t.amountMin, t.amountMax);
    const cls = classifyAction(t.transactionType);
    const delta = cls === "buy" ? m : cls === "sell" ? -m : 0;
    buckets.set(week, (buckets.get(week) ?? 0) + delta);
  }
  return [...buckets.entries()]
    .map(([week, sentiment]) => ({ week, sentiment }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export async function getBuySellSentiment(daysBack = 365): Promise<SentimentBucket[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000);
  // Unioned: includes Executive disclosures so the weekly buy/sell
  // sentiment line reflects both branches. Executive rows use
  // transactionDate (proxy disclosure date) — see fetchAllTrades.
  const rows = await fetchAllTrades({ since });
  return shapeBuySellSentiment(
    rows.map((r) => ({
      date: r.disclosureDate ?? r.transactionDate,
      transactionType: r.transactionType,
      amountMin: centsToDollars(r.amountMinCents),
      amountMax: centsToDollars(r.amountMaxCents),
    })),
  );
}
