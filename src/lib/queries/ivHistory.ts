import { db } from "@/lib/db";

/** ATM-IV history pulled from this ticker's own past report snapshots (one per day, newest first, ≤40). */
export async function getIvHistory(ticker: string): Promise<number[]> {
  try {
    const rows = await db.report.findMany({
      where: { ticker },
      orderBy: { generatedAt: "desc" },
      take: 40,
      select: { generatedAt: true, payload: true },
    });
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const day = row.generatedAt.slice(0, 10);
      if (byDay.has(day)) continue;
      try {
        const parsed = JSON.parse(row.payload) as { options?: { atmIvPct?: number | null } | null };
        const iv = parsed.options?.atmIvPct;
        if (typeof iv === "number" && Number.isFinite(iv)) byDay.set(day, iv);
      } catch { /* skip bad payloads */ }
    }
    const today = new Date().toISOString().slice(0, 10);
    byDay.delete(today);
    return [...byDay.values()];
  } catch (e) {
    console.error(`[ivHistory] failed for ${ticker}:`, (e as Error).message);
    return [];
  }
}
