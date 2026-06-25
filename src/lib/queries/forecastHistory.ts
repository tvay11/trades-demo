import { db } from "@/lib/db";

// Strictly-data read for past forecast generations used to evaluate track record.
// Never cached — history is cheap and report generation is already on-demand.

// Cents -> dollars, matching priceForecast.ts pattern.
// Date fields are text and parsed leniently (date-only or full ISO).

const isoDay = (s: string): string => new Date(s).toISOString().slice(0, 10);

export interface ForecastHistoryPoint {
  predDate: string;
  close: number;  // dollars
  lower: number;  // dollars
  upper: number;  // dollars
}

export interface ForecastHistoryRun {
  generatedAt: string;    // ISO date
  horizonDays: number;
  points: ForecastHistoryPoint[];
}

/**
 * Returns past forecast generations for a ticker (skipping the most recent,
 * which is the live forecast), suitable for track-record evaluation.
 *
 * Returns [] on any failure so a broken history never breaks report generation.
 */
export async function getForecastHistory(
  ticker: string,
  limit = 8,
): Promise<ForecastHistoryRun[]> {
  const symbol = ticker.trim().toUpperCase();
  try {
    // Step 1: Get all DISTINCT generatedAt values, ordered desc.
    const genRows = await db.$queryRawUnsafe<{ generatedAt: string }[]>(
      `SELECT DISTINCT CAST(generatedAt AS TEXT) AS generatedAt
         FROM PriceForecast
        WHERE ticker = ?
        ORDER BY generatedAt DESC`,
      symbol,
    );

    if (genRows.length <= 1) {
      // Only one or zero generations — nothing historical to evaluate.
      return [];
    }

    // Skip the most recent (index 0) and take up to `limit` past generations.
    const historicalGens = genRows.slice(1, limit + 1).map((r) => r.generatedAt);
    if (historicalGens.length === 0) return [];

    // Step 2: Fetch all points for those generations.
    // Build a parameterised IN clause.
    const placeholders = historicalGens.map(() => "?").join(", ");
    const pointRows = await db.$queryRawUnsafe<
      {
        generatedAt: string;
        predDate: string;
        close: number;
        lower: number;
        upper: number;
        horizonDays: number;
      }[]
    >(
      `SELECT CAST(generatedAt AS TEXT) AS generatedAt,
              CAST(predDate AS TEXT)    AS predDate,
              close, lower, upper, horizonDays
         FROM PriceForecast
        WHERE ticker = ?
          AND CAST(generatedAt AS TEXT) IN (${placeholders})
        ORDER BY generatedAt DESC, predDate ASC`,
      symbol,
      ...historicalGens,
    );

    // Group by generatedAt.
    const runMap = new Map<string, ForecastHistoryRun>();
    for (const row of pointRows) {
      const genDay = isoDay(row.generatedAt);
      if (!runMap.has(genDay)) {
        runMap.set(genDay, {
          generatedAt: genDay,
          horizonDays: row.horizonDays,
          points: [],
        });
      }
      runMap.get(genDay)!.points.push({
        predDate: isoDay(row.predDate),
        close: row.close / 100,
        lower: row.lower / 100,
        upper: row.upper / 100,
      });
    }

    return Array.from(runMap.values());
  } catch {
    return [];
  }
}
