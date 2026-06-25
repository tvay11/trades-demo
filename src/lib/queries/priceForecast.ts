import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";

// Strictly-data forecast read side. The forecast itself is produced out-of-band
// by the external forecast runner and written to the
// PriceForecast table; here we just read the latest batch and shape it for the
// chart. Cents -> dollars, mirroring the rest of the app.

export interface PriceForecastRow {
  ticker: string;
  predDate: string; // ISO-ish text; parsed leniently with new Date(...)
  close: number; // cents
  lower: number; // cents
  upper: number; // cents
  generatedAt: string; // ISO-ish text
  model: string;
  sampleCount: number;
  horizonDays: number;
}

export interface ForecastPoint {
  date: string; // YYYY-MM-DD
  close: number; // dollars (median)
  lower: number; // dollars (p10)
  upper: number; // dollars (p90)
}

export interface ForecastMeta {
  model: string;
  sampleCount: number;
  horizonDays: number;
  generatedAt: string; // YYYY-MM-DD
  probUp: number | null;
  expectedMovePct: number | null;
}

export interface ForecastResult {
  points: ForecastPoint[];
  meta: ForecastMeta;
}

const ms = (s: string): number => new Date(s).getTime();
const isoDay = (s: string): string => new Date(s).toISOString().slice(0, 10);

/**
 * Pick the most recent generatedAt batch from raw rows and convert to dollars.
 * Datetime fields are text and parsed leniently, so date-only ("2026-07-10") and
 * microsecond ISO strings both work. Returns null when there is no forecast.
 */
export function shapeForecast(rows: PriceForecastRow[]): ForecastResult | null {
  if (rows.length === 0) return null;

  let latestMs = ms(rows[0].generatedAt);
  for (const r of rows) latestMs = Math.max(latestMs, ms(r.generatedAt));

  const batch = rows
    .filter((r) => ms(r.generatedAt) === latestMs)
    .sort((a, b) => ms(a.predDate) - ms(b.predDate));

  const head = batch[0];
  return {
    points: batch.map((r) => ({
      date: isoDay(r.predDate),
      close: r.close / 100,
      lower: r.lower / 100,
      upper: r.upper / 100,
    })),
    meta: {
      model: head.model,
      sampleCount: head.sampleCount,
      horizonDays: head.horizonDays,
      generatedAt: isoDay(head.generatedAt),
      probUp: null,
      expectedMovePct: null,
    },
  };
}

export async function getPriceForecast(ticker: string): Promise<ForecastResult | null> {
  "use cache";
  applyCacheLife("minutes");

  const symbol = ticker.trim().toUpperCase();
  try {
    const rows = await db.priceForecast.findMany({
      where: { ticker: symbol },
      orderBy: { generatedAt: "desc" },
      take: 400,
    });
    const result = shapeForecast(rows as PriceForecastRow[]);
    if (!result) return null;

    // Attach exact direction stats from ForecastStat if the table exists.
    try {
      const statRows = await db.$queryRawUnsafe<{ probUp: number; expectedMovePct: number }[]>(
        "SELECT probUp, expectedMovePct FROM ForecastStat WHERE ticker = ? ORDER BY generatedAt DESC LIMIT 1",
        symbol,
      );
      if (statRows.length > 0) {
        result.meta.probUp = statRows[0].probUp;
        result.meta.expectedMovePct = statRows[0].expectedMovePct;
      }
    } catch {
      // ForecastStat table may not exist yet (before first forecaster run); leave nulls.
    }

    return result;
  } catch (error) {
    console.error("[priceForecast] query failed", error);
    return null;
  }
}
