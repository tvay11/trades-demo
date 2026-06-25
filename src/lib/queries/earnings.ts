import { db } from "@/lib/db";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { getEarningsSnapshot, type EarningsSnapshot } from "@/lib/yahoo/client";

export type EarningsEvent = EarningsSnapshot & {
  ticker: string;
  source: string;
  fetchedAt: Date;
  updatedAt: Date;
};

type RawEarningsEvent = {
  ticker: string;
  earningsDate: Date | string | null;
  earningsCallDate: Date | string | null;
  isEstimate: boolean | number;
  epsAverage: number | null;
  epsLow: number | null;
  epsHigh: number | null;
  revenueAverage: number | null;
  revenueLow: number | null;
  revenueHigh: number | null;
  source: string;
  fetchedAt: Date | string;
  updatedAt: Date | string;
};

const EARNINGS_CACHE_MS = 12 * 60 * 60 * 1000;

export async function getEarningsEvent(ticker: string): Promise<EarningsEvent | null> {
  const normalized = normalizeWatchlistTicker(ticker);
  if (!normalized) return null;

  const cached = await readEarningsEvent(normalized);
  if (cached && Date.now() - cached.fetchedAt.getTime() < EARNINGS_CACHE_MS) {
    return cached;
  }

  const snapshot = await getEarningsSnapshot(normalized);
  await writeEarningsEvent(normalized, snapshot);

  return {
    ticker: normalized,
    ...snapshot,
    source: "yahoo",
    fetchedAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function refreshEarningsEvents(tickers: string[]): Promise<void> {
  const normalized = [...new Set(tickers.map(normalizeWatchlistTicker).filter((t): t is string => t != null))];

  for (const ticker of normalized) {
    await getEarningsEvent(ticker);
  }
}

async function readEarningsEvent(ticker: string): Promise<EarningsEvent | null> {
  const rows = await db.$queryRaw<RawEarningsEvent[]>`
    SELECT
      "ticker",
      "earningsDate",
      "earningsCallDate",
      "isEstimate",
      "epsAverage",
      "epsLow",
      "epsHigh",
      "revenueAverage",
      "revenueLow",
      "revenueHigh",
      "source",
      "fetchedAt",
      "updatedAt"
    FROM "EarningsEvent"
    WHERE "ticker" = ${ticker}
  `;

  return rows[0] ? mapEarningsRow(rows[0]) : null;
}

async function writeEarningsEvent(ticker: string, snapshot: EarningsSnapshot) {
  await db.$executeRaw`
    INSERT INTO "EarningsEvent" (
      "ticker",
      "earningsDate",
      "earningsCallDate",
      "isEstimate",
      "epsAverage",
      "epsLow",
      "epsHigh",
      "revenueAverage",
      "revenueLow",
      "revenueHigh",
      "source",
      "fetchedAt",
      "updatedAt"
    )
    VALUES (
      ${ticker},
      ${snapshot.earningsDate},
      ${snapshot.earningsCallDate},
      ${snapshot.isEstimate},
      ${snapshot.epsAverage},
      ${snapshot.epsLow},
      ${snapshot.epsHigh},
      ${snapshot.revenueAverage},
      ${snapshot.revenueLow},
      ${snapshot.revenueHigh},
      'yahoo',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT("ticker") DO UPDATE SET
      "earningsDate" = excluded."earningsDate",
      "earningsCallDate" = excluded."earningsCallDate",
      "isEstimate" = excluded."isEstimate",
      "epsAverage" = excluded."epsAverage",
      "epsLow" = excluded."epsLow",
      "epsHigh" = excluded."epsHigh",
      "revenueAverage" = excluded."revenueAverage",
      "revenueLow" = excluded."revenueLow",
      "revenueHigh" = excluded."revenueHigh",
      "source" = excluded."source",
      "fetchedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export function mapEarningsRow(row: RawEarningsEvent): EarningsEvent {
  return {
    ticker: row.ticker,
    earningsDate: coerceDate(row.earningsDate),
    earningsCallDate: coerceDate(row.earningsCallDate),
    isEstimate: Boolean(row.isEstimate),
    epsAverage: row.epsAverage,
    epsLow: row.epsLow,
    epsHigh: row.epsHigh,
    revenueAverage: row.revenueAverage,
    revenueLow: row.revenueLow,
    revenueHigh: row.revenueHigh,
    source: row.source,
    fetchedAt: coerceDate(row.fetchedAt) ?? new Date(0),
    updatedAt: coerceDate(row.updatedAt) ?? new Date(0),
  };
}

function coerceDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
