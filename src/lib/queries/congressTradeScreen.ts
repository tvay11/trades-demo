import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { minimumDollars, type Cents } from "@/lib/money";
import { classifyAction } from "@/lib/trades/classify";

// Strictly-data congressional trade screen. Unlike the long/short board, NOTHING
// here is a derived conviction "score" — every column is a direct count, a sum
// of minimum-disclosed dollars, a date, or a flag computed only from the raw
// rows. Aggregation is a pure function (`buildCongressTradeScreen`) so it can be
// unit-tested without a database, mirroring the buildLongShortSummary pattern.

const LOOKBACK_DAYS = 365;

export interface CongressTradeInput {
  ticker: string;
  representative: string;
  politicianId: number;
  party: string | null;
  house: string | null;
  transactionType: string;
  transactionDate: Date;
  disclosureDate: Date;
  amountMinCents: Cents;
  amountMaxCents: Cents;
}

export interface CongressStockInfo {
  ticker: string;
  companyName: string | null;
  sector: string | null;
}

export interface CongressTradeScreenRow {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  // Activity (counts)
  trades: number;
  buys: number;
  sells: number;
  netTrades: number;
  // Breadth (distinct politicians)
  politicians: number;
  buyers: number;
  sellers: number;
  // Dollars (minimum disclosed)
  buyUsd: number;
  sellUsd: number;
  netUsd: number;
  grossUsd: number;
  // Party split (trade counts)
  demBuys: number;
  demSells: number;
  repBuys: number;
  repSells: number;
  // Chamber split (trade counts)
  houseTrades: number;
  senateTrades: number;
  // Flags / linkage derived only from rows
  bipartisanBuying: boolean;
  leadershipTrades: number;
  // Timing
  avgDisclosureLagDays: number;
  latestTransactionDate: Date | null;
  latestDisclosureDate: Date | null;
  // Names
  topTraders: string[];
}

export interface CongressTradeScreenSummary {
  tickers: number;
  trades: number;
  buys: number;
  sells: number;
  netUsd: number;
  grossUsd: number;
  avgDisclosureLagDays: number;
  bipartisanTickers: number;
  latestTransactionDate: Date | null;
}

const DAY_MS = 86_400_000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return b > a ? b : a;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

type Agg = {
  trades: number;
  buys: number;
  sells: number;
  buyUsd: number;
  sellUsd: number;
  demBuys: number;
  demSells: number;
  repBuys: number;
  repSells: number;
  houseTrades: number;
  senateTrades: number;
  leadershipTrades: number;
  lagSum: number;
  lagCount: number;
  latestTransaction: Date | null;
  latestDisclosure: Date | null;
  politicians: Set<number>;
  buyers: Set<number>;
  sellers: Set<number>;
  traderCounts: Map<string, number>;
};

function emptyAgg(): Agg {
  return {
    trades: 0,
    buys: 0,
    sells: 0,
    buyUsd: 0,
    sellUsd: 0,
    demBuys: 0,
    demSells: 0,
    repBuys: 0,
    repSells: 0,
    houseTrades: 0,
    senateTrades: 0,
    leadershipTrades: 0,
    lagSum: 0,
    lagCount: 0,
    latestTransaction: null,
    latestDisclosure: null,
    politicians: new Set<number>(),
    buyers: new Set<number>(),
    sellers: new Set<number>(),
    traderCounts: new Map<string, number>(),
  };
}

/**
 * Aggregate raw congressional trades into one strictly-factual row per ticker.
 *
 * @param trades   Raw buy/sell rows (Exchange / non-directional rows are skipped).
 * @param stocks   Company / sector lookup for display only.
 * @param leadershipPoliticianIds politicianIds holding a committee chair or
 *   ranking-member seat — used purely to COUNT how many trades came from
 *   committee leadership, never to weight or score anything.
 */
export function buildCongressTradeScreen(
  trades: CongressTradeInput[],
  stocks: CongressStockInfo[],
  leadershipPoliticianIds: Set<number> = new Set(),
): { rows: CongressTradeScreenRow[]; summary: CongressTradeScreenSummary } {
  const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));
  const byTicker = new Map<string, Agg>();

  let globalLagSum = 0;
  let globalLagCount = 0;
  let globalLatest: Date | null = null;

  for (const t of trades) {
    const action = classifyAction(t.transactionType);
    if (action === "other") continue; // skip Exchange / non-directional

    const agg = byTicker.get(t.ticker) ?? emptyAgg();
    const value = minimumDollars(t.amountMinCents, t.amountMaxCents);
    const party = t.party === "D" ? "D" : t.party === "R" ? "R" : null;
    const isSenate = t.house === "Senate";

    agg.trades += 1;
    agg.politicians.add(t.politicianId);
    agg.traderCounts.set(t.representative, (agg.traderCounts.get(t.representative) ?? 0) + 1);
    if (isSenate) agg.senateTrades += 1;
    else agg.houseTrades += 1;
    if (leadershipPoliticianIds.has(t.politicianId)) agg.leadershipTrades += 1;

    if (action === "buy") {
      agg.buys += 1;
      agg.buyUsd += value;
      agg.buyers.add(t.politicianId);
      if (party === "D") agg.demBuys += 1;
      else if (party === "R") agg.repBuys += 1;
    } else {
      agg.sells += 1;
      agg.sellUsd += value;
      agg.sellers.add(t.politicianId);
      if (party === "D") agg.demSells += 1;
      else if (party === "R") agg.repSells += 1;
    }

    // Disclosure lag in whole days, floored at 0 (filings can post same-day).
    const lagDays = Math.max(0, (t.disclosureDate.getTime() - t.transactionDate.getTime()) / DAY_MS);
    agg.lagSum += lagDays;
    agg.lagCount += 1;
    globalLagSum += lagDays;
    globalLagCount += 1;

    agg.latestTransaction = laterDate(agg.latestTransaction, t.transactionDate);
    agg.latestDisclosure = laterDate(agg.latestDisclosure, t.disclosureDate);
    globalLatest = laterDate(globalLatest, t.transactionDate);

    byTicker.set(t.ticker, agg);
  }

  const rows: CongressTradeScreenRow[] = [];
  for (const [ticker, a] of byTicker) {
    const stock = stockByTicker.get(ticker);
    const topTraders = [...a.traderCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([name]) => name);

    rows.push({
      ticker,
      companyName: stock?.companyName ?? null,
      sector: stock?.sector ?? null,
      trades: a.trades,
      buys: a.buys,
      sells: a.sells,
      netTrades: a.buys - a.sells,
      politicians: a.politicians.size,
      buyers: a.buyers.size,
      sellers: a.sellers.size,
      buyUsd: a.buyUsd,
      sellUsd: a.sellUsd,
      netUsd: a.buyUsd - a.sellUsd,
      grossUsd: a.buyUsd + a.sellUsd,
      demBuys: a.demBuys,
      demSells: a.demSells,
      repBuys: a.repBuys,
      repSells: a.repSells,
      houseTrades: a.houseTrades,
      senateTrades: a.senateTrades,
      bipartisanBuying: a.demBuys > a.demSells && a.repBuys > a.repSells,
      leadershipTrades: a.leadershipTrades,
      avgDisclosureLagDays: a.lagCount > 0 ? round1(a.lagSum / a.lagCount) : 0,
      latestTransactionDate: a.latestTransaction,
      latestDisclosureDate: a.latestDisclosure,
      topTraders,
    });
  }

  // Most active first (trade count), tie-broken by gross dollars. Pure data
  // ordering — no synthetic ranking score.
  rows.sort((x, y) => y.trades - x.trades || y.grossUsd - x.grossUsd);

  const summary: CongressTradeScreenSummary = {
    tickers: rows.length,
    trades: rows.reduce((sum, r) => sum + r.trades, 0),
    buys: rows.reduce((sum, r) => sum + r.buys, 0),
    sells: rows.reduce((sum, r) => sum + r.sells, 0),
    netUsd: rows.reduce((sum, r) => sum + r.netUsd, 0),
    grossUsd: rows.reduce((sum, r) => sum + r.grossUsd, 0),
    avgDisclosureLagDays: globalLagCount > 0 ? round1(globalLagSum / globalLagCount) : 0,
    bipartisanTickers: rows.filter((r) => r.bipartisanBuying).length,
    latestTransactionDate: globalLatest,
  };

  return { rows, summary };
}

const EMPTY_SUMMARY: CongressTradeScreenSummary = {
  tickers: 0,
  trades: 0,
  buys: 0,
  sells: 0,
  netUsd: 0,
  grossUsd: 0,
  avgDisclosureLagDays: 0,
  bipartisanTickers: 0,
  latestTransactionDate: null,
};

export async function getCongressTradeScreen(): Promise<{
  rows: CongressTradeScreenRow[];
  summary: CongressTradeScreenSummary;
  source: "database" | "database-error";
}> {
  "use cache";
  applyCacheLife("minutes");

  const since = daysAgo(LOOKBACK_DAYS);

  try {
    const [trades, leadership] = await Promise.all([
      db.congressTrade.findMany({
        where: { transactionDate: { gte: since } },
        select: {
          ticker: true,
          representative: true,
          politicianId: true,
          party: true,
          house: true,
          transactionType: true,
          transactionDate: true,
          disclosureDate: true,
          amountMinCents: true,
          amountMaxCents: true,
        },
      }),
      db.politicianCommitteeAssignment.findMany({
        where: { OR: [{ isChair: true }, { isRanking: true }] },
        select: { politicianId: true },
      }),
    ]);

    const tickers = [...new Set(trades.map((t) => t.ticker))];
    const stocks =
      tickers.length > 0
        ? await db.stock.findMany({
            where: { ticker: { in: tickers } },
            select: { ticker: true, companyName: true, sector: true },
          })
        : [];

    const leadershipIds = new Set(leadership.map((l) => l.politicianId));
    const { rows, summary } = buildCongressTradeScreen(trades, stocks, leadershipIds);
    return { rows, summary, source: "database" };
  } catch (error) {
    console.error("[congressTradeScreen] query failed", error);
    return { rows: [], summary: EMPTY_SUMMARY, source: "database-error" };
  }
}
