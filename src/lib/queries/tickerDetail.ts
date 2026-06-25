import { db } from "@/lib/db";

import { applyCacheLife } from "@/lib/cache";
import {
  scoreCommitteeRelevance,
  type CommitteeContext,
  type CommitteeRelevance,
} from "@/lib/committees/relevance";
import { centsToDollars } from "@/lib/money";
import {
  getDailyBars,
  getQuoteSnapshot,
  type BarRow,
} from "@/lib/yahoo/client";
import { ingestMinDate } from "@/lib/ingest/cutoff";
import type { BarPoint, TradeOverlay } from "@/components/charts/TickerPriceChart";

export type StockProfile = {
  ticker: string;
  companyName: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  logoUrl: string | null;
  marketCap: number | null;
};

export type RawTickerTrade = {
  id: string;
  /** "congress" or "executive" — drives the Cong/Exec badge in the table. */
  branch: import("@/lib/trades/unified").Branch;
  politicianName: string;
  party: string | null;
  state: string | null;
  /** Agency name when branch="executive" (used in place of state in tooltips). */
  agency: string | null;
  transactionType: string;
  transactionDate: Date;
  /**
   * For congress: the actual disclosureDate (always present).
   * For executive: transactionDate is reused as a proxy (the source doesn't
   * expose a separate disclosure date; executive filings are near-real-time).
   */
  disclosureDate: Date;
  amountMin: number | null;
  amountMax: number | null;
  amountRangeRaw: string | null;
  committeeRelevance?: CommitteeRelevance;
};

export type TickerCongressTrade = RawTickerTrade & {
  action: "buy" | "sell" | "other";
  amountMinimum: number;
  priceAtTrade: number | null;
  priceAtDisclosure: number | null;
  latestClose: number | null;
  returnSinceTrade: number | null;
  return7dFromDisclosure: number | null;
  return30dFromDisclosure: number | null;
  return90dFromDisclosure: number | null;
  committeeRelevance: CommitteeRelevance;
};

export type AlternativeDataSummary = {
  label: string;
  count: number;
};

export type TickerDetail = {
  stock: StockProfile;
  bars: BarPoint[];
  overlays: TradeOverlay[];
  congressTrades: TickerCongressTrade[];
  summary: {
    tradeCount: number;
    buyCount: number;
    sellCount: number;
    estimatedVolume: number;
  };
  alternativeData: AlternativeDataSummary[];
  source: "database" | "database-error" | "empty";
};

type TickerCloseRow = Pick<BarRow, "date" | "close">;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function minimum(min: number | null, max: number | null) {
  if (min == null && max == null) return 0;
  if (min == null) return Number(max);
  if (max == null) return Number(min);
  return Math.min(Number(min), Number(max));
}

function classify(type: string): "buy" | "sell" | "other" {
  const normalized = type.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("purchase")) return "buy";
  if (normalized.includes("sell") || normalized.includes("sale")) return "sell";
  return "other";
}

function closeOnOrBefore(date: Date, closes: TickerCloseRow[]) {
  const sorted = [...closes].sort((a, b) => a.date.getTime() - b.date.getTime());
  let candidate: TickerCloseRow | null = null;

  for (const close of sorted) {
    if (close.date.getTime() <= date.getTime()) candidate = close;
    if (close.date.getTime() > date.getTime()) break;
  }

  return candidate ?? sorted[0] ?? null;
}

function closeOnOrAfter(date: Date, closes: TickerCloseRow[]) {
  const sorted = [...closes].sort((a, b) => a.date.getTime() - b.date.getTime());
  return sorted.find((close) => close.date.getTime() >= date.getTime()) ?? null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function returnFromEntry(entry: number | null, exit: number | null) {
  if (entry == null || exit == null || entry <= 0) return null;
  return Number((((exit - entry) / entry) * 100).toFixed(2));
}

function emptyCommitteeRelevance(): CommitteeRelevance {
  return {
    score: 0,
    label: "Low",
    matches: [],
    reasons: [],
  };
}

export function shapeTickerCongressTrades(
  trades: RawTickerTrade[],
  closes: TickerCloseRow[],
): TickerCongressTrade[] {
  const latestClose = closes.length
    ? [...closes].sort((a, b) => b.date.getTime() - a.date.getTime())[0].close
    : null;

  return trades
    .map((trade) => {
      const priceAtTrade = closeOnOrBefore(trade.transactionDate, closes)?.close ?? null;
      const priceAtDisclosure = closeOnOrAfter(trade.disclosureDate, closes)?.close ?? null;
      const returnSinceTrade =
        priceAtTrade != null && latestClose != null && priceAtTrade > 0
          ? Number((((latestClose - priceAtTrade) / priceAtTrade) * 100).toFixed(2))
          : null;
      const return7dFromDisclosure = returnFromEntry(
        priceAtDisclosure,
        closeOnOrAfter(addDays(trade.disclosureDate, 7), closes)?.close ?? null,
      );
      const return30dFromDisclosure = returnFromEntry(
        priceAtDisclosure,
        closeOnOrAfter(addDays(trade.disclosureDate, 30), closes)?.close ?? null,
      );
      const return90dFromDisclosure = returnFromEntry(
        priceAtDisclosure,
        closeOnOrAfter(addDays(trade.disclosureDate, 90), closes)?.close ?? null,
      );

      return {
        ...trade,
        action: classify(trade.transactionType),
        amountMinimum: minimum(trade.amountMin, trade.amountMax),
        priceAtTrade,
        priceAtDisclosure,
        latestClose,
        returnSinceTrade,
        return7dFromDisclosure,
        return30dFromDisclosure,
        return90dFromDisclosure,
        committeeRelevance: trade.committeeRelevance ?? emptyCommitteeRelevance(),
      };
    })
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
}

export function shapeTickerSummary(trades: TickerCongressTrade[]) {
  return {
    tradeCount: trades.length,
    buyCount: trades.filter((trade) => trade.action === "buy").length,
    sellCount: trades.filter((trade) => trade.action === "sell").length,
    estimatedVolume: trades.reduce((sum, trade) => sum + trade.amountMinimum, 0),
  };
}

function toBarPoints(bars: BarRow[]): BarPoint[] {
  return bars.map((b) => ({
    date: dateKey(b.date),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
}

function toOverlays(symbol: string, trades: TickerCongressTrade[]): TradeOverlay[] {
  return trades.map((trade) => ({
    date: dateKey(trade.transactionDate),
    disclosureDate: dateKey(trade.disclosureDate),
    type: trade.action,
    transactionType: trade.transactionType,
    minimum: trade.amountMinimum,
    amountRangeRaw: trade.amountRangeRaw,
    politicianName: trade.politicianName,
    party: trade.party,
    ticker: symbol,
    close: trade.priceAtTrade,
  }));
}

async function safeBars(symbol: string, from: Date, to: Date) {
  try {
    return await getDailyBars(symbol, from, to);
  } catch (e) {
    console.error(`[tickerDetail] price load failed for ${symbol}:`, (e as Error).message);
    return [] satisfies BarRow[];
  }
}

function emptyTickerDetail(symbol: string, source: TickerDetail["source"] = "empty"): TickerDetail {
  return {
    stock: {
      ticker: symbol,
      companyName: null,
      exchange: null,
      sector: null,
      industry: null,
      country: null,
      website: null,
      logoUrl: null,
      marketCap: null,
    },
    bars: [],
    overlays: [],
    congressTrades: [],
    summary: { tradeCount: 0, buyCount: 0, sellCount: 0, estimatedVolume: 0 },
    alternativeData: [
      { label: "Congress trades", count: 0 },
      { label: "Insider trades", count: 0 },
      { label: "Lobbying", count: 0 },
      { label: "Gov contracts", count: 0 },
      { label: "Patents", count: 0 },
      { label: "Off-exchange", count: 0 },
      { label: "13F holdings", count: 0 },
      { label: "Social mentions", count: 0 },
      { label: "Wikipedia views", count: 0 },
      { label: "Political beta", count: 0 },
    ],
    source,
  };
}

export async function getTickerDetail(symbolParam: string): Promise<TickerDetail> {
  "use cache";
  applyCacheLife("minutes");

  const symbol = symbolParam.trim().toUpperCase();
  const to = new Date();
  // Fetch closes back to the ingest cutoff so every trade we have can anchor
  // to a real price. Falls back to 1Y if the cutoff is somehow newer.
  const oneYearAgo = new Date(to);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const cutoffWithSlack = new Date(ingestMinDate().getTime() - 14 * 86_400_000);
  const from = cutoffWithSlack < oneYearAgo ? cutoffWithSlack : oneYearAgo;

  try {
    const [
      stock,
      congressRows,
      executiveRows,
      bars,
      insiderCount,
      lobbyingCount,
      wsbCount,
      twitterCount,
      govContractCount,
      patentCount,
      offExchangeCount,
      thirteenFCount,
      wikipediaCount,
      politicalBetaCount,
    ] = await Promise.all([
      // Prisma+libSQL has a BigInt deserialization bug for large values like
      // trillion-dollar market caps (obs 475). Exclude marketCap from the
      // Prisma read and fetch it separately via raw SQL below.
      db.stock.findUnique({
        where: { ticker: symbol },
        select: {
          ticker: true,
          companyName: true,
          exchange: true,
          sector: true,
          industry: true,
          country: true,
          website: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.congressTrade.findMany({
        where: { ticker: symbol },
        orderBy: { transactionDate: "desc" },
        include: {
          politician: {
            select: {
              name: true,
              party: true,
              state: true,
              committees: {
                include: {
                  committee: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      }),
      db.executiveTrade.findMany({
        where: { ticker: symbol },
        orderBy: { transactionDate: "desc" },
        include: {
          official: {
            select: {
              name: true,
              party: true,
              title: true,
              agency: { select: { name: true } },
            },
          },
        },
      }),
      safeBars(symbol, from, to),
      db.insiderTrade.count({ where: { ticker: symbol } }),
      db.lobbyingDisclosure.count({ where: { ticker: symbol } }),
      db.wsbMention.count({ where: { ticker: symbol } }),
      db.twitterMention.count({ where: { ticker: symbol } }),
      db.govContract.count({ where: { ticker: symbol } }),
      db.patent.count({ where: { ticker: symbol } }),
      db.offExchangeActivity.count({ where: { ticker: symbol } }),
      db.thirteenFHolding.count({ where: { ticker: symbol } }),
      db.wikipediaView.count({ where: { ticker: symbol } }),
      db.politicalBeta.count({ where: { ticker: symbol } }),
    ]);

    if (!congressRows.length && !stock) {
      return emptyTickerDetail(symbol);
    }

    const inferredCompanyName =
      stock?.companyName ?? congressRows[0]?.assetDescription ?? null;

    if (!stock) {
      await db.stock.upsert({
        where: { ticker: symbol },
        update: inferredCompanyName ? { companyName: inferredCompanyName } : {},
        create: {
          ticker: symbol,
          companyName: inferredCompanyName,
        },
      });
    }

    // Lazy refresh of market cap. We read the stored value via raw SQL since
    // Prisma+libSQL's BigInt deserialization breaks on trillion-dollar caps
    // (obs 475). Refresh when stored value is null OR row is older than 24h.
    const cached = await db.$queryRawUnsafe<
      Array<{ marketCap: bigint | null }>
    >(
      'SELECT CAST("marketCap" AS TEXT) as marketCap FROM "Stock" WHERE ticker = ?',
      symbol,
    );
    const cachedRaw = cached[0]?.marketCap;
    let marketCap: number | null =
      cachedRaw == null ? null : Number(cachedRaw);
    const stockUpdatedAt = stock?.updatedAt ?? new Date(0);
    const marketCapStale =
      marketCap == null ||
      Date.now() - stockUpdatedAt.getTime() > 24 * 60 * 60 * 1000;
    if (marketCapStale) {
      const snapshot = await getQuoteSnapshot(symbol);
      const anyValue =
        snapshot.marketCap != null ||
        snapshot.companyName != null ||
        snapshot.exchange != null ||
        snapshot.sector != null ||
        snapshot.industry != null ||
        snapshot.country != null ||
        snapshot.website != null;
      if (anyValue) {
        if (snapshot.marketCap != null) marketCap = snapshot.marketCap;
        // COALESCE keeps any existing non-null value if Yahoo returned null
        // for that field this time around.
        await db.$executeRawUnsafe(
          `UPDATE "Stock"
           SET "marketCap"   = COALESCE(?, "marketCap"),
               "companyName" = COALESCE(?, "companyName"),
               "exchange"    = COALESCE(?, "exchange"),
               "sector"      = COALESCE(?, "sector"),
               "industry"    = COALESCE(?, "industry"),
               "country"     = COALESCE(?, "country"),
               "website"     = COALESCE(?, "website"),
               "updatedAt"   = CURRENT_TIMESTAMP
           WHERE "ticker" = ?`,
          snapshot.marketCap == null ? null : Math.round(snapshot.marketCap),
          snapshot.companyName,
          snapshot.exchange,
          snapshot.sector,
          snapshot.industry,
          snapshot.country,
          snapshot.website,
          symbol,
        );
      }
    }

    const rawCongressTrades = congressRows.map<RawTickerTrade>((trade) => {
      const committees: CommitteeContext[] =
        trade.politician?.committees.map((assignment) => ({
          name: assignment.committee.name,
          role: assignment.role,
          isChair: assignment.isChair,
          isRanking: assignment.isRanking,
        })) ?? [];

      return {
        id: `cong-${trade.id}`,
        branch: "congress",
        politicianName: trade.politician?.name ?? trade.representative,
        party: trade.party ?? trade.politician?.party ?? null,
        state: trade.state ?? trade.politician?.state ?? null,
        agency: null,
        transactionType: trade.transactionType,
        transactionDate: trade.transactionDate,
        disclosureDate: trade.disclosureDate,
        amountMin: centsToDollars(trade.amountMinCents),
        amountMax: centsToDollars(trade.amountMaxCents),
        amountRangeRaw: trade.amountRangeRaw,
        committeeRelevance: scoreCommitteeRelevance({
          ticker: symbol,
          sector: stock?.sector,
          industry: stock?.industry,
          committees,
        }),
      };
    });

    // Executive trades: same ticker, mapped into the same RawTickerTrade
    // shape. disclosureDate reuses transactionDate (the source doesn't
    // expose a separate disclosure date — executive filings are near-real-time).
    const rawExecutiveTrades = executiveRows.map<RawTickerTrade>((trade) => ({
      id: `exec-${trade.id}`,
      branch: "executive",
      politicianName: trade.official.name,
      party: trade.official.party ?? null,
      state: null,
      agency: trade.official.agency?.name ?? null,
      transactionType: trade.transactionType,
      transactionDate: trade.transactionDate,
      disclosureDate: trade.transactionDate,
      amountMin: centsToDollars(trade.amountMinCents),
      amountMax: centsToDollars(trade.amountMaxCents),
      amountRangeRaw: trade.amountRangeRaw,
    }));

    const rawTrades = [...rawCongressTrades, ...rawExecutiveTrades];
    const shaped = shapeTickerCongressTrades(rawTrades, bars);
    const socialMentions = wsbCount + twitterCount;

    return {
      stock: {
        ticker: symbol,
        companyName: inferredCompanyName,
        exchange: stock?.exchange ?? null,
        sector: stock?.sector ?? null,
        industry: stock?.industry ?? null,
        country: stock?.country ?? null,
        website: stock?.website ?? null,
        logoUrl: stock?.logoUrl ?? null,
        marketCap,
      },
      bars: toBarPoints(bars),
      overlays: toOverlays(symbol, shaped),
      congressTrades: shaped,
      summary: shapeTickerSummary(shaped),
      alternativeData: [
        { label: "Congress trades", count: shaped.length },
        { label: "Insider trades", count: insiderCount },
        { label: "Lobbying", count: lobbyingCount },
        { label: "Gov contracts", count: govContractCount },
        { label: "Patents", count: patentCount },
        { label: "Off-exchange", count: offExchangeCount },
        { label: "13F holdings", count: thirteenFCount },
        { label: "Social mentions", count: socialMentions },
        { label: "Wikipedia views", count: wikipediaCount },
        { label: "Political beta", count: politicalBetaCount },
      ],
      source: "database",
    };
  } catch (error) {
    console.error(`[tickerDetail] failed to load ${symbol}:`, error);
    return emptyTickerDetail(symbol, "database-error");
  }
}
