import { db } from "@/lib/db";

export interface ReportSignals {
  rating: "BUY" | "SELL" | "HOLD";
  generatedAt: string;
}

export function extractReportSignals(payload: string, generatedAt: string): ReportSignals | null {
  try {
    const parsed = JSON.parse(payload) as { houseCall?: { rating?: string } };
    const rating = parsed.houseCall?.rating;
    if (rating !== "BUY" && rating !== "SELL" && rating !== "HOLD") return null;
    return {
      rating,
      generatedAt,
    };
  } catch {
    return null;
  }
}

/** Latest report signals per ticker. Tickers without reports are absent. Never throws. */
export async function getLatestReportSignals(tickers: string[]): Promise<Map<string, ReportSignals>> {
  if (tickers.length === 0) return new Map();
  try {
    const rows = await db.$queryRawUnsafe<{ ticker: string; generatedAt: string; payload: string }[]>(
      `SELECT ticker, generatedAt, payload FROM Report
       WHERE ticker IN (${tickers.map(() => "?").join(",")})
       AND id IN (SELECT MAX(id) FROM Report GROUP BY ticker)`,
      ...tickers.map((t) => t.toUpperCase()),
    );
    const map = new Map<string, ReportSignals>();
    for (const row of rows) {
      const s = extractReportSignals(row.payload, row.generatedAt);
      if (s) map.set(row.ticker, s);
    }
    return map;
  } catch {
    return new Map();
  }
}
