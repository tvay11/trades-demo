import { db } from "@/lib/db";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { unifiedTradeCountSql } from "@/lib/trades/unified";
import { refreshEarningsEvents } from "@/lib/queries/earnings";

export type WatchlistRow = {
  id: number;
  ticker: string;
  note: string | null;
  createdAt: Date;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  latestClose: number | null;
  latestPriceDate: Date | null;
  earningsDate: Date | null;
  earningsIsEstimate: boolean;
  tradeCount30: number;
  tradeCount90: number;
  tradeCount365: number;
};

type RawWatchlistRow = {
  id: number | bigint;
  ticker: string;
  note: string | null;
  createdAt: Date | string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: string | null;
  latestCloseCents: string | number | bigint | null;
  latestPriceDate: Date | string | null;
  earningsDate: Date | string | null;
  earningsIsEstimate: boolean | number | null;
  tradeCount30: number | bigint;
  tradeCount90: number | bigint;
  tradeCount365: number | bigint;
};

const DAY_MS = 86_400_000;

export async function getWatchedTickerSet(tickers: string[]): Promise<Set<string>> {
  const normalized = [...new Set(tickers.map(normalizeWatchlistTicker).filter((t): t is string => t != null))];
  if (normalized.length === 0) return new Set();

  const placeholders = normalized.map(() => "?").join(", ");
  const rows = await db.$queryRawUnsafe<Array<{ ticker: string }>>(
    `SELECT "ticker" AS "ticker" FROM "WatchlistItem" WHERE "ticker" IN (${placeholders})`,
    ...normalized,
  );

  return new Set(rows.map((row) => row.ticker));
}

export async function isTickerWatched(ticker: string): Promise<boolean> {
  const normalized = normalizeWatchlistTicker(ticker);
  if (!normalized) return false;

  const rows = await db.$queryRaw<Array<{ n: number | bigint }>>`
    SELECT COUNT(*) AS "n" FROM "WatchlistItem" WHERE "ticker" = ${normalized}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function getWatchlistRows(): Promise<WatchlistRow[]> {
  const watchlistTickers = await db.$queryRaw<Array<{ ticker: string }>>`
    SELECT "ticker" AS "ticker" FROM "WatchlistItem" ORDER BY "createdAt" DESC
  `;
  await refreshEarningsEvents(watchlistTickers.map((row) => row.ticker));

  const now = Date.now();
  const cutoff30 = new Date(now - 30 * DAY_MS).toISOString();
  const cutoff90 = new Date(now - 90 * DAY_MS).toISOString();
  const cutoff365 = new Date(now - 365 * DAY_MS).toISOString();

  const rows = await db.$queryRawUnsafe<RawWatchlistRow[]>(
    `
      SELECT
        w."id" AS "id",
        w."ticker" AS "ticker",
        w."note" AS "note",
        w."createdAt" AS "createdAt",
        s."companyName" AS "companyName",
        s."sector" AS "sector",
        s."industry" AS "industry",
        CAST(s."marketCap" AS TEXT) AS "marketCap",
        CAST((
          SELECT p."close"
          FROM "TickerPriceCache" p
          WHERE p."ticker" = w."ticker"
          ORDER BY p."date" DESC
          LIMIT 1
        ) AS TEXT) AS "latestCloseCents",
        (
          SELECT p."date"
          FROM "TickerPriceCache" p
          WHERE p."ticker" = w."ticker"
          ORDER BY p."date" DESC
          LIMIT 1
        ) AS "latestPriceDate",
        e."earningsDate" AS "earningsDate",
        e."isEstimate" AS "earningsIsEstimate",
        (${unifiedTradeCountSql('w."ticker"')}) AS "tradeCount30",
        (${unifiedTradeCountSql('w."ticker"')}) AS "tradeCount90",
        (${unifiedTradeCountSql('w."ticker"')}) AS "tradeCount365"
      FROM "WatchlistItem" w
      LEFT JOIN "Stock" s ON s."ticker" = w."ticker"
      LEFT JOIN "EarningsEvent" e ON e."ticker" = w."ticker"
      ORDER BY w."createdAt" DESC, w."ticker" ASC
    `,
    cutoff30,
    cutoff30,
    cutoff90,
    cutoff90,
    cutoff365,
    cutoff365,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    ticker: row.ticker,
    note: row.note,
    createdAt: coerceDate(row.createdAt) ?? new Date(0),
    companyName: row.companyName,
    sector: row.sector,
    industry: row.industry,
    marketCap: row.marketCap == null ? null : Number(row.marketCap),
    latestClose: centsToDollars(row.latestCloseCents),
    latestPriceDate: coerceDate(row.latestPriceDate),
    earningsDate: coerceDate(row.earningsDate),
    earningsIsEstimate: row.earningsIsEstimate == null ? true : Boolean(row.earningsIsEstimate),
    tradeCount30: Number(row.tradeCount30),
    tradeCount90: Number(row.tradeCount90),
    tradeCount365: Number(row.tradeCount365),
  }));
}

function centsToDollars(value: string | number | bigint | null): number | null {
  if (value == null) return null;
  return Number(value) / 100;
}

function coerceDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
