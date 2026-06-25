import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { minimumDollars } from "@/lib/money";
import { parseSqliteUtc } from "@/lib/sql-dates";
import { classifyAction } from "@/lib/trades/classify";
import type { MarketSignalMetric } from "./marketSignalData";

// NOTE: This file is scoped to CongressTrade vs InsiderTrade by design.
// Executive-branch trades are NOT included here even after the
// executive/congressional merge. The alignment hypothesis is "voting
// member also a director-level corporate insider on the same ticker" —
// executive officials don't fit that shape (they're appointees rather
// than legislators with sector-specific committee jurisdictions).
// Decision documented 2026-05-18.

// ── Types ──────────────────────────────────────────────────────────────

/** A ticker where both congress members AND corporate insiders traded in the same direction */
export interface DualInsiderSignal {
  ticker: string;
  direction: "Bullish" | "Bearish" | "Mixed";
  /** Congress side */
  congressBuyCount: number;
  congressSellCount: number;
  congressVolume: number;
  congressPoliticians: string[];
  latestCongressDate: string;
  /** Insider side */
  insiderBuyCount: number;
  insiderSellCount: number;
  insiderVolume: number;
  insiderNames: string[];
  latestInsiderDate: string;
  /** Combined */
  alignmentScore: number; // 0-100, how aligned the two groups are
  overlapWindowDays: number; // days between earliest and latest trade across both
}

/** Top insider by volume for the sidebar */
export interface TopCorporateInsider {
  name: string;
  title: string | null;
  ticker: string;
  direction: "Buy" | "Sell";
  totalValue: number;
  tradeCount: number;
  hasCongressOverlap: boolean;
}

/** Time-bucketed view of dual signals */
export interface DualSignalTimeline {
  month: string;
  congressTrades: number;
  insiderTrades: number;
  overlapTickers: number;
}

export interface DualInsiderAnalysis {
  source: "database";
  metrics: MarketSignalMetric[];
  signals: DualInsiderSignal[];
  topInsiders: TopCorporateInsider[];
  timeline: DualSignalTimeline[];
  /** Latest date across BOTH source tables (YYYY-MM-DD). Powers the
   *  freshness chip in the page hero. Null when no rows exist. */
  latestDataDate: string | null;
}

type InsiderDisclosureRow = {
  ticker: string;
  insiderName: string;
  insiderTitle: string | null;
  transactionType: string;
  transactionDate: Date | string;
  filingDate: Date | string | null;
  shares: number | null;
  pricePerShareCents: number | null;
  totalValueCents: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 365;
const ALIGNMENT_WINDOW_DAYS = 60; // trades within 60 days count as "aligned"

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // libSQL returns DateTime as bare "YYYY-MM-DD HH:MM:SS" — parse as UTC,
  // not the host's local time. Falls back to Date(value) for strings that
  // already carry a timezone marker.
  return parseSqliteUtc(value) ?? new Date(value);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86_400_000));
}

function signed(action: "buy" | "sell", value: number): number {
  return action === "buy" ? value : -value;
}

function formatCompactDollars(dollars: number): string {
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (Math.abs(dollars) >= 1_000) return `$${Math.round(dollars / 1_000).toLocaleString()}K`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

// ── Main query ─────────────────────────────────────────────────────────

export async function getDualInsiderAnalysis(): Promise<DualInsiderAnalysis> {
  "use cache";
  applyCacheLife("minutes");

  const since = daysAgo(LOOKBACK_DAYS);

  const [congressRows, insiderRows] = await Promise.all([
    db.congressTrade.findMany({
      where: { disclosureDate: { gte: since } },
      orderBy: { disclosureDate: "desc" },
      select: {
        ticker: true,
        representative: true,
        transactionType: true,
        transactionDate: true,
        disclosureDate: true,
        amountMinCents: true,
        amountMaxCents: true,
      },
    }),
    db.$queryRaw<InsiderDisclosureRow[]>`
      SELECT
        "ticker",
        "insiderName",
        "insiderTitle",
        "transactionType",
        "transactionDate",
        "filingDate",
        "shares",
        "pricePerShareCents",
        CAST("totalValueCents" AS TEXT) AS "totalValueCents"
      FROM "InsiderTrade"
      WHERE "filingDate" >= ${since}
         OR ("filingDate" IS NULL AND "transactionDate" >= ${since})
      ORDER BY COALESCE("filingDate", "transactionDate") DESC
    `,
  ]);

  if (!congressRows.length && !insiderRows.length) {
    return emptyAnalysis();
  }

  // ── Build per-ticker aggregations ──────────────────────────────────

  type TickerCongress = {
    buys: number;
    sells: number;
    volume: number;
    netVolume: number;
    politicians: Set<string>;
    latestDate: Date;
    dates: Date[];
  };
  type TickerInsider = {
    buys: number;
    sells: number;
    volume: number;
    netVolume: number;
    names: Set<string>;
    latestDate: Date;
    dates: Date[];
    details: Array<{ name: string; title: string | null; direction: "Buy" | "Sell"; value: number }>;
  };

  const congressByTicker = new Map<string, TickerCongress>();
  const insiderByTicker = new Map<string, TickerInsider>();

  for (const row of congressRows) {
    const action = classifyAction(row.transactionType);
    if (action === "other") continue;
    const eventDate = row.disclosureDate;
    const value = minimumDollars(row.amountMinCents, row.amountMaxCents);

    const existing = congressByTicker.get(row.ticker) ?? {
      buys: 0, sells: 0, volume: 0, netVolume: 0, politicians: new Set<string>(), latestDate: eventDate, dates: [],
    };
    if (action === "buy") existing.buys++;
    else existing.sells++;
    existing.volume += value;
    existing.netVolume += signed(action, value);
    existing.politicians.add(row.representative);
    if (eventDate > existing.latestDate) existing.latestDate = eventDate;
    existing.dates.push(eventDate);
    congressByTicker.set(row.ticker, existing);
  }

  for (const row of insiderRows) {
    const action = classifyAction(row.transactionType);
    if (action === "other") continue;

    const eventDate = toDate(row.filingDate ?? row.transactionDate);
    // Convert to dollars here so the insider loop matches the congress loop
    // (which uses minimumDollars). Both feed the same accumulators and
    // display formatters; previously insider was cents and congress was
    // dollars, so "Congress volume" rendered 100x too small.
    //
    // `shares` and `pricePerShareCents` come from $queryRaw, which (post
    // libSQL intMode="bigint") can hand back BigInt at runtime even when the
    // TS type says `number`. Coerce both sides to Number before multiplying
    // so a null `totalValueCents` row doesn't throw "Cannot mix BigInt".
    const valueCents = row.totalValueCents == null
      ? Number(row.shares ?? 0) * Number(row.pricePerShareCents ?? 0)
      : Number(row.totalValueCents);
    const value = valueCents / 100;

    const existing = insiderByTicker.get(row.ticker) ?? {
      buys: 0, sells: 0, volume: 0, netVolume: 0, names: new Set<string>(), latestDate: eventDate, dates: [],
      details: [],
    };
    if (action === "buy") existing.buys++;
    else existing.sells++;
    existing.volume += value;
    existing.netVolume += signed(action, value);
    existing.names.add(row.insiderName);
    if (eventDate > existing.latestDate) existing.latestDate = eventDate;
    existing.dates.push(eventDate);
    existing.details.push({
      name: row.insiderName,
      title: row.insiderTitle,
      direction: action === "buy" ? "Buy" : "Sell",
      value,
    });
    insiderByTicker.set(row.ticker, existing);
  }

  // ── Find overlapping tickers ────────────────────────────────────────

  const overlapTickers = new Set<string>();
  for (const ticker of congressByTicker.keys()) {
    if (insiderByTicker.has(ticker)) overlapTickers.add(ticker);
  }

  const signals: DualInsiderSignal[] = [];
  for (const ticker of overlapTickers) {
    const congress = congressByTicker.get(ticker)!;
    const insider = insiderByTicker.get(ticker)!;

    // Direction
    const congressNet = congress.netVolume;
    const insiderNet = insider.netVolume;
    const congressDir = congressNet > 0 ? "buy" : congressNet < 0 ? "sell" : "mixed";
    const insiderDir = insiderNet > 0 ? "buy" : insiderNet < 0 ? "sell" : "mixed";

    let direction: "Bullish" | "Bearish" | "Mixed";
    if (congressDir === "buy" && insiderDir === "buy") direction = "Bullish";
    else if (congressDir === "sell" && insiderDir === "sell") direction = "Bearish";
    else direction = "Mixed";

    // Alignment score: how close in time + same direction
    const allDates = [...congress.dates, ...insider.dates].sort((a, b) => a.getTime() - b.getTime());
    const windowDays = allDates.length >= 2 ? daysBetween(allDates[0], allDates[allDates.length - 1]) : 0;

    // Check if any congress and insider trades are within the alignment window
    let alignedPairs = 0;
    for (const cd of congress.dates) {
      for (const id of insider.dates) {
        if (daysBetween(cd, id) <= ALIGNMENT_WINDOW_DAYS) {
          alignedPairs++;
        }
      }
    }
    const maxPairs = Math.max(1, congress.dates.length * insider.dates.length);
    const timingScore = Math.min(100, Math.round((alignedPairs / maxPairs) * 100));

    // Direction bonus
    const directionBonus = direction !== "Mixed" ? 30 : 0;
    const volumeBonus = Math.min(20, Math.round(Math.log10(Math.max(1, congress.volume + insider.volume)) * 3));
    const alignmentScore = Math.min(100, timingScore + directionBonus + volumeBonus);

    signals.push({
      ticker,
      direction,
      congressBuyCount: congress.buys,
      congressSellCount: congress.sells,
      congressVolume: congress.volume,
      congressPoliticians: [...congress.politicians].slice(0, 5),
      latestCongressDate: dateKey(congress.latestDate),
      insiderBuyCount: insider.buys,
      insiderSellCount: insider.sells,
      insiderVolume: insider.volume,
      insiderNames: [...insider.names].slice(0, 5),
      latestInsiderDate: dateKey(insider.latestDate),
      alignmentScore,
      overlapWindowDays: windowDays,
    });
  }

  // Sort by alignment score descending
  signals.sort((a, b) => b.alignmentScore - a.alignmentScore);

  // ── Top corporate insiders ──────────────────────────────────────────

  const insiderAgg = new Map<string, TopCorporateInsider>();
  for (const [ticker, data] of insiderByTicker) {
    for (const d of data.details) {
      const key = `${d.name}|${ticker}`;
      const existing = insiderAgg.get(key);
      if (existing) {
        existing.totalValue += d.value;
        existing.tradeCount++;
      } else {
        insiderAgg.set(key, {
          name: d.name,
          title: d.title,
          ticker,
          direction: d.direction,
          totalValue: d.value,
          tradeCount: 1,
          hasCongressOverlap: overlapTickers.has(ticker),
        });
      }
    }
  }
  const topInsiders = [...insiderAgg.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 15);

  // ── Monthly timeline ────────────────────────────────────────────────

  const monthBuckets = new Map<string, { congress: number; insider: number; overlapTickers: Set<string> }>();
  for (const row of congressRows) {
    const month = dateKey(row.disclosureDate).slice(0, 7);
    const bucket = monthBuckets.get(month) ?? { congress: 0, insider: 0, overlapTickers: new Set() };
    bucket.congress++;
    if (overlapTickers.has(row.ticker)) bucket.overlapTickers.add(row.ticker);
    monthBuckets.set(month, bucket);
  }
  for (const row of insiderRows) {
    const month = dateKey(toDate(row.filingDate ?? row.transactionDate)).slice(0, 7);
    const bucket = monthBuckets.get(month) ?? { congress: 0, insider: 0, overlapTickers: new Set() };
    bucket.insider++;
    if (overlapTickers.has(row.ticker)) bucket.overlapTickers.add(row.ticker);
    monthBuckets.set(month, bucket);
  }

  const timeline: DualSignalTimeline[] = [...monthBuckets.entries()]
    .map(([month, b]) => ({
      month,
      congressTrades: b.congress,
      insiderTrades: b.insider,
      overlapTickers: b.overlapTickers.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ── Metrics ─────────────────────────────────────────────────────────

  const bullishCount = signals.filter((s) => s.direction === "Bullish").length;
  const bearishCount = signals.filter((s) => s.direction === "Bearish").length;
  const highConviction = signals.filter((s) => s.alignmentScore >= 60).length;
  const totalCongressVolume = [...congressByTicker.values()].reduce((a, c) => a + c.volume, 0);
  const totalInsiderVolume = [...insiderByTicker.values()].reduce((a, c) => a + c.volume, 0);

  const metrics: MarketSignalMetric[] = [
    { label: "Overlap tickers", value: `${overlapTickers.size}`, tone: "accent" },
    { label: "Bullish signals", value: `${bullishCount}`, tone: bullishCount > 0 ? "positive" : "neutral" },
    { label: "Bearish signals", value: `${bearishCount}`, tone: bearishCount > 0 ? "negative" : "neutral" },
    { label: "High conviction (60+)", value: `${highConviction}`, tone: highConviction > 0 ? "positive" : "neutral" },
    { label: "Congress trades", value: congressRows.length.toLocaleString(), tone: "neutral" },
    { label: "Insider trades", value: insiderRows.length.toLocaleString(), tone: "neutral" },
    { label: "Congress volume", value: formatCompactDollars(totalCongressVolume), tone: "neutral" },
    { label: "Insider volume", value: formatCompactDollars(totalInsiderVolume), tone: "neutral" },
  ];

  // Latest date across both source tables. Used by the hero freshness chip.
  let latestData: Date | null = null;
  for (const row of congressRows) {
    if (!latestData || row.disclosureDate > latestData) latestData = row.disclosureDate;
  }
  for (const row of insiderRows) {
    const eventDate = toDate(row.filingDate ?? row.transactionDate);
    if (!latestData || eventDate > latestData) latestData = eventDate;
  }

  return {
    source: "database",
    metrics,
    signals,
    topInsiders,
    timeline,
    latestDataDate: latestData ? dateKey(latestData) : null,
  };
}

function emptyAnalysis(): DualInsiderAnalysis {
  return {
    source: "database",
    latestDataDate: null,
    metrics: [
      { label: "Overlap tickers", value: "0", tone: "neutral" },
      { label: "Bullish signals", value: "0", tone: "neutral" },
      { label: "Bearish signals", value: "0", tone: "neutral" },
      { label: "High conviction", value: "0", tone: "neutral" },
      { label: "Congress trades", value: "0", tone: "neutral" },
      { label: "Insider trades", value: "0", tone: "neutral" },
      { label: "Congress volume", value: "$0", tone: "neutral" },
      { label: "Insider volume", value: "$0", tone: "neutral" },
    ],
    signals: [],
    topInsiders: [],
    timeline: [],
  };
}
