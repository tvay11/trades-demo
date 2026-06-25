import { db } from "@/lib/db";

export type DelayInput = {
  transactionDate: Date;
  disclosureDate: Date;
};

export type DelayBucket = {
  bucket: string;
  count: number;
};

const BUCKETS: { label: string; max: number | null }[] = [
  { label: "0–7", max: 7 },
  { label: "8–14", max: 14 },
  { label: "15–30", max: 30 },
  { label: "31–45", max: 45 },
  { label: "46+", max: null },
];

const ONE_DAY_MS = 86_400_000;

export function shapeDisclosureDelay(trades: DelayInput[]): DelayBucket[] {
  const counts = BUCKETS.map(() => 0);
  for (const t of trades) {
    const days = Math.floor(
      (t.disclosureDate.getTime() - t.transactionDate.getTime()) / ONE_DAY_MS,
    );
    if (days < 0) continue;
    let placed = false;
    for (let i = 0; i < BUCKETS.length; i++) {
      const max = BUCKETS[i].max;
      if (max === null || days <= max) {
        counts[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) counts[counts.length - 1] += 1;
  }
  return BUCKETS.map((b, i) => ({ bucket: b.label, count: counts[i] }));
}

export async function getDisclosureDelay(): Promise<DelayBucket[]> {
  const rows = await db.congressTrade.findMany({
    select: { transactionDate: true, disclosureDate: true },
  });
  return shapeDisclosureDelay(rows);
}
