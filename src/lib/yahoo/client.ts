import YahooFinance from "yahoo-finance2";
import { db } from "@/lib/db";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

type YahooQuote = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};
type YahooChartResult = { quotes: YahooQuote[] };

export type BarRow = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DailyBarsDeps = {
  readCache: (ticker: string, from: Date, to: Date) => Promise<BarRow[]>;
  writeCache: (ticker: string, rows: BarRow[]) => Promise<void>;
  fetchYahoo: (ticker: string, from: Date, to: Date) => Promise<BarRow[]>;
};

const ONE_DAY_MS = 86_400_000;
const FRESHNESS_MS = ONE_DAY_MS;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const toCents = (n: number | null | undefined) =>
  n == null ? null : Math.round(n * 100);
const fromCents = (n: number | null) => (n == null ? null : n / 100);

const defaultDeps: DailyBarsDeps = {
  async readCache(ticker, from, to) {
    const rows = await db.tickerPriceCache.findMany({
      where: { ticker, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
    return rows
      .filter((r) => r.close != null)
      .map((r) => ({
        date: r.date,
        // open/high/low may be null on legacy rows pre-OHLCV migration — fall
        // back to close so the bar renders as a doji rather than dropping out.
        open: fromCents(r.open) ?? r.close / 100,
        high: fromCents(r.high) ?? r.close / 100,
        low: fromCents(r.low) ?? r.close / 100,
        close: r.close / 100,
        volume: r.volume == null ? 0 : Number(r.volume),
      }));
  },
  async writeCache(ticker, rows) {
    if (rows.length === 0) return;
    for (const r of rows) {
      const data = {
        close: toCents(r.close) ?? 0,
        open: toCents(r.open),
        high: toCents(r.high),
        low: toCents(r.low),
        volume: BigInt(Math.round(r.volume)),
      };
      await db.tickerPriceCache.upsert({
        where: { ticker_date: { ticker, date: r.date } },
        update: data,
        create: { ticker, date: r.date, ...data },
      });
    }
  },
  async fetchYahoo(ticker, from, to) {
    const result = (await yahooFinance.chart(ticker, {
      period1: from,
      period2: to,
      interval: "1d",
    })) as YahooChartResult;
    return result.quotes
      .filter(
        (q) =>
          q.date != null &&
          q.close != null &&
          q.open != null &&
          q.high != null &&
          q.low != null,
      )
      .map((q) => ({
        date: q.date,
        open: Number(q.open),
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume ?? 0),
      }));
  },
};

export type QuoteSnapshot = {
  marketCap: number | null;
  companyName: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
};

export type EarningsSnapshot = {
  earningsDate: Date | null;
  earningsCallDate: Date | null;
  isEstimate: boolean;
  epsAverage: number | null;
  epsLow: number | null;
  epsHigh: number | null;
  revenueAverage: number | null;
  revenueLow: number | null;
  revenueHigh: number | null;
};

type YahooPriceModule = {
  marketCap?: number | null;
  longName?: string | null;
  shortName?: string | null;
  exchangeName?: string | null;
  fullExchangeName?: string | null;
};

type YahooSummaryProfileModule = {
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  website?: string | null;
};

const EMPTY_SNAPSHOT: QuoteSnapshot = {
  marketCap: null,
  companyName: null,
  exchange: null,
  sector: null,
  industry: null,
  country: null,
  website: null,
};

const EMPTY_EARNINGS: EarningsSnapshot = {
  earningsDate: null,
  earningsCallDate: null,
  isEstimate: true,
  epsAverage: null,
  epsLow: null,
  epsHigh: null,
  revenueAverage: null,
  revenueLow: null,
  revenueHigh: null,
};

function nonEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

export async function getQuoteSnapshot(ticker: string): Promise<QuoteSnapshot> {
  try {
    const summary = (await yahooFinance.quoteSummary(ticker, {
      modules: ["price", "summaryProfile"],
    })) as {
      price?: YahooPriceModule;
      summaryProfile?: YahooSummaryProfileModule;
    };
    const price = summary.price ?? {};
    const profile = summary.summaryProfile ?? {};
    const rawCap = price.marketCap;
    return {
      marketCap: rawCap == null ? null : Number(rawCap),
      companyName: nonEmpty(price.longName) ?? nonEmpty(price.shortName),
      exchange: nonEmpty(price.fullExchangeName) ?? nonEmpty(price.exchangeName),
      sector: nonEmpty(profile.sector),
      industry: nonEmpty(profile.industry),
      country: nonEmpty(profile.country),
      website: nonEmpty(profile.website),
    };
  } catch (e) {
    console.error(
      `[yahoo] quoteSummary failed for ${ticker}:`,
      (e as Error).message,
    );
    return EMPTY_SNAPSHOT;
  }
}

type YahooEarningsSummary = {
  calendarEvents?: {
    earnings?: {
      earningsDate?: unknown;
      earningsCallDate?: unknown;
      isEarningsDateEstimate?: boolean;
      earningsAverage?: number | null;
      earningsLow?: number | null;
      earningsHigh?: number | null;
      revenueAverage?: number | null;
      revenueLow?: number | null;
      revenueHigh?: number | null;
    };
  };
};

export function shapeEarningsSnapshot(summary: YahooEarningsSummary): EarningsSnapshot {
  const earnings = summary.calendarEvents?.earnings;
  if (!earnings) return { ...EMPTY_EARNINGS };

  return {
    earningsDate: firstDate(earnings.earningsDate),
    earningsCallDate: firstDate(earnings.earningsCallDate),
    isEstimate: earnings.isEarningsDateEstimate ?? true,
    epsAverage: numberOrNull(earnings.earningsAverage),
    epsLow: numberOrNull(earnings.earningsLow),
    epsHigh: numberOrNull(earnings.earningsHigh),
    revenueAverage: numberOrNull(earnings.revenueAverage),
    revenueLow: numberOrNull(earnings.revenueLow),
    revenueHigh: numberOrNull(earnings.revenueHigh),
  };
}

export async function getEarningsSnapshot(ticker: string): Promise<EarningsSnapshot> {
  try {
    const summary = (await yahooFinance.quoteSummary(ticker, {
      modules: ["calendarEvents"],
    })) as YahooEarningsSummary;

    return shapeEarningsSnapshot(summary);
  } catch (e) {
    console.error(
      `[yahoo] earnings calendar failed for ${ticker}:`,
      (e as Error).message,
    );
    return { ...EMPTY_EARNINGS };
  }
}

function firstDate(value: unknown): Date | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  const parsed = new Date(raw as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function numberOrNull(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getDailyBars(
  ticker: string,
  from: Date,
  to: Date,
  deps: DailyBarsDeps = defaultDeps,
): Promise<BarRow[]> {
  const cached = await deps.readCache(ticker, from, to);

  const maxCached = cached.length
    ? cached.reduce((m, r) => (r.date > m ? r.date : m), new Date(0))
    : null;
  const minCached = cached.length
    ? cached.reduce((m, r) => (r.date < m ? r.date : m), new Date(8.64e15))
    : null;
  const cacheIsFresh =
    maxCached !== null && to.getTime() - maxCached.getTime() <= FRESHNESS_MS;
  const cacheCoversStart =
    minCached !== null && minCached.getTime() - from.getTime() <= 14 * ONE_DAY_MS;

  if (cached.length > 0 && cacheIsFresh && cacheCoversStart) {
    return [...cached].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const fresh = await deps.fetchYahoo(ticker, from, to);
  if (fresh.length > 0) {
    await deps.writeCache(ticker, fresh);
  }

  const byDate = new Map<string, BarRow>();
  for (const r of cached) byDate.set(dayKey(r.date), r);
  for (const r of fresh) byDate.set(dayKey(r.date), r);
  return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
