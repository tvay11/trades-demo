import { db } from "@/lib/db";
import type {
  ChamberOrBranch,
  Party,
  PoliticianSummary,
  Trade,
  TradeType,
} from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { minimumDollars } from "@/lib/money";
import { fetchAllTrades, type UnifiedTradeRow } from "@/lib/trades/unified";
import { connection } from "next/server";
import {
  scoreCommitteeRelevance,
  type CommitteeContext,
} from "@/lib/committees/relevance";
import {
  calculatePostDisclosureReturn,
  classifyDualInsiderAlignment,
  type DashboardAlertCounts,
  rankDisclosureReturnFacts,
  summarizeTickerBreadth,
  isOptionAssetDescription,
  type DashboardDisclosureReturn,
  type DashboardTickerBreadth,
  type DisclosureReturnInput,
  type TickerBreadthInput,
} from "./dashboardFacts";

type SqlTradeRow = Awaited<ReturnType<typeof db.congressTrade.findMany>>[number] & {
  politician?: {
    id: number;
    name: string;
    party: string | null;
    state: string | null;
    chamber: string | null;
  } | null;
};

export type SqlFirstDashboardData = {
  recentTradesCount: number;
  recentVolume: number;
  // null when sellVol === 0 (ratio is undefined). UI should render "—" or "∞".
  bullBearRatio: number | null;
  activeTickersCount: number;
  activePoliticians: number;
  avgDisclosureDelay: number | null;
  latestTrades: Trade[];
  optionsTrades: Trade[];
  whaleTrades: Trade[];
  dualInsiderSignals: {
    ticker: string;
    companyName: string | null;
    direction: "Bullish" | "Bearish";
    congressNetVolume: number;
    insiderNetVolume: number;
    congressBuyVolume: number;
    congressSellVolume: number;
    insiderBuyVolume: number;
    insiderSellVolume: number;
  }[];
  sectorMomentum: {
    sector: string;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
  }[];
  tickerBreadth: DashboardTickerBreadth[];
  disclosureReturns: DashboardDisclosureReturn[];
  committeeLinkedTrades: DashboardCommitteeTrade[];
  darkFlowIntersections: DashboardDarkFlowIntersection[];
  freshness: DashboardFreshness;
  alerts: DashboardAlertCounts;
  source: "database" | "database-error" | "empty";
};

export type DashboardCommitteeTrade = {
  id: string;
  ticker: string;
  companyName: string | null;
  politicianName: string;
  party: string | null;
  state: string | null;
  transactionType: string;
  amountMinimum: number;
  disclosureDate: Date;
  committeeLabel: "High" | "Medium" | "Low";
  committeeMatches: string[];
};

export type DashboardDarkFlowIntersection = {
  ticker: string;
  companyName: string | null;
  congressNetVolume: number;
  politicianCount: number;
  darkPoolPercent: number | null;
  shortVolumePercent: number | null;
  totalVolume: number | null;
  latestDate: Date | null;
};

export type DashboardFreshness = {
  lastRunAt: Date | null;
  rowsInsertedToday: number;
  failedDatasetCount: number;
};

type Numeric = number | bigint | null;

export async function getSqlFirstTrades(limit = 2_000): Promise<Trade[]> {
  try {
    // Unioned: pulls both CongressTrade and ExecutiveTrade so the dashboard
    // "Latest disclosures" panel shows both feeds with a Cong/Exec badge.
    const rows = await fetchAllTrades({ take: limit });
    if (!rows.length) return [];

    const tickers = [...new Set(rows.map((r) => r.ticker).filter((t): t is string => t != null))];
    const stocks = tickers.length
      ? await db.stock.findMany({ where: { ticker: { in: tickers } } })
      : [];
    const stockMap = new Map(stocks.map((stock) => [stock.ticker, stock]));

    return rows.map((row) =>
      unifiedToTrade(row, row.ticker ? stockMap.get(row.ticker) : undefined),
    );
  } catch (error) {
    console.error("[appData] failed to load SQL trades:", error);
    return [];
  }
}

export async function getSqlFirstPoliticians(): Promise<PoliticianSummary[]> {
  try {
    const rows = await db.politician.findMany({
      include: {
        trades: {
          orderBy: { disclosureDate: "desc" },
          select: {
            transactionType: true,
            disclosureDate: true,
            transactionDate: true,
            amountMinCents: true,
            amountMaxCents: true,
          },
        },
        committees: {
          include: {
            committee: {
              select: { name: true },
            },
          },
          take: 4,
        },
      },
    });

    const active = rows.filter((row) => row.trades.length > 0);
    if (!active.length) return [];

    return active
      .map((politician) => {
        const totalVolume = politician.trades.reduce(
          (sum, trade) => sum + minimumDollars(trade.amountMinCents, trade.amountMaxCents),
          0,
        );
        const buyCount = politician.trades.filter((trade) => classifyTradeType(trade.transactionType) === "Buy").length;
        const sellCount = politician.trades.filter((trade) => classifyTradeType(trade.transactionType) === "Sell").length;

        return {
          id: String(politician.id),
          name: politician.name,
          party: normalizeParty(politician.party),
          state: politician.state ?? "-",
          chamber: normalizeChamber(politician.chamber),
          role: normalizeChamber(politician.chamber) === "Senate" ? "Senator" : "Representative",
          committees: politician.committees.map((assignment) => assignment.committee.name),
          totalTrades: politician.trades.length,
          totalVolume,
          latestFiledDate: dateKey(politician.trades[0]?.disclosureDate ?? new Date()),
          buyCount,
          sellCount,
          sparkline: buildSparkline(
            politician.trades.map((trade) => ({
              date: trade.disclosureDate,
              value: minimumDollars(trade.amountMinCents, trade.amountMaxCents),
            })),
          ),
        } satisfies PoliticianSummary;
      })
      .sort((a, b) => b.totalTrades - a.totalTrades || b.totalVolume - a.totalVolume);
  } catch (error) {
    console.error("[appData] failed to load SQL politicians:", error);
    return [];
  }
}

export async function getSqlFirstDashboardData(): Promise<SqlFirstDashboardData> {
  await connection();
  try {
    const [
      latestTrades,
      optionsTrades,
      whaleTrades,
      dualInsiderSignals,
      sectorMomentum,
      velocity,
      activePoliticians,
      tickerBreadth,
      disclosureReturns,
      committeeLinkedTrades,
      darkFlowIntersections,
      freshness,
      alerts,
    ] = await Promise.all([
      traceDashboardBlock("latest-trades", () => getSqlFirstTrades(8)),
      traceDashboardBlock("options-trades", () => getOptionsTrades(6)),
      traceDashboardBlock("whale-trades", () => getLargestDashboardTrades(6, 30)),
      traceDashboardBlock("dual-insider", () => getDualInsiderSignals(6)),
      traceDashboardBlock("sector-momentum", () => getSectorMomentum(60)),
      traceDashboardBlock("rolling-velocity", () => getRollingVelocityStats()),
      traceDashboardBlock("active-politicians", () => db.politician.count({ where: { trades: { some: {} } } })),
      traceDashboardBlock("ticker-breadth", () => getTickerBreadthFacts(30, 8)),
      traceDashboardBlock("disclosure-returns", () => getDisclosureReturnFacts(8)),
      traceDashboardBlock("committee-linked", () => getCommitteeLinkedDashboardTrades(8)),
      traceDashboardBlock("dark-flow", () => getDarkFlowIntersections(8)),
      traceDashboardBlock("dashboard-freshness", () => getDashboardFreshness()),
      traceDashboardBlock("dashboard-alerts", () => getDashboardAlertCounts()),
    ]);

    if (!latestTrades.length) {
      return emptyDashboardData("empty");
    }

    return {
      recentTradesCount: velocity.recentTradesCount,
      recentVolume: velocity.recentVolume,
      bullBearRatio: velocity.bullBearRatio,
      activeTickersCount: velocity.activeTickersCount,
      activePoliticians,
      avgDisclosureDelay: velocity.avgDisclosureDelay,
      latestTrades,
      optionsTrades,
      whaleTrades,
      dualInsiderSignals,
      sectorMomentum,
      tickerBreadth,
      disclosureReturns,
      committeeLinkedTrades,
      darkFlowIntersections,
      freshness,
      alerts: {
        ...alerts,
        committeeLinkedTrades: committeeLinkedTrades.length,
        darkFlowIntersections: darkFlowIntersections.length,
      },
      source: "database",
    };
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return emptyDashboardData("database-error");
  }
}

async function traceDashboardBlock<T>(
  label: string,
  load: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    return await load();
  } catch (error) {
    console.error(`[dashboard:sql] ${label} failed in ${Date.now() - start}ms`, error);
    throw error;
  }
}

export async function searchSqlFirst(q: string) {
  const query = q.trim();
  if (!query) return { politicians: [], trades: [], tickers: [] };

  try {
    const contains = { contains: query };
    const [politicians, trades, executiveTrades, stocks] = await Promise.all([
      db.politician.findMany({
        where: {
          OR: [
            { name: contains },
            { state: contains },
            { party: contains },
            { bioguideId: contains },
          ],
        },
        take: 6,
        orderBy: { name: "asc" },
      }),
      db.congressTrade.findMany({
        where: {
          OR: [
            { representative: contains },
            { ticker: contains },
            { assetDescription: contains },
            { transactionType: contains },
            { ownerType: contains },
            { ownerName: contains },
            { ownerRaw: contains },
            { documentId: contains },
          ],
        },
        take: 7,
        orderBy: { disclosureDate: "desc" },
      }),
      db.executiveTrade.findMany({
        where: {
          OR: [
            { ticker: contains },
            { assetDescription: contains },
            { transactionType: contains },
            { official: { name: contains } },
            { official: { title: contains } },
          ],
        },
        include: { official: { select: { name: true } } },
        take: 4,
        orderBy: { transactionDate: "desc" },
      }),
      db.stock.findMany({
        where: {
          OR: [{ ticker: contains }, { companyName: contains }, { sector: contains }],
        },
        take: 6,
        orderBy: { ticker: "asc" },
      }),
    ]);

    if (!politicians.length && !trades.length && !executiveTrades.length && !stocks.length) return null;

    return {
      politicians: politicians.map((politician) => ({
        id: String(politician.id),
        name: politician.name,
        party: normalizeParty(politician.party),
        state: politician.state ?? "-",
        chamber: normalizeChamber(politician.chamber),
      })),
      trades: [
        ...trades.map((trade) => ({
          id: `cong-${trade.id}`,
          politicianName: trade.representative,
          ticker: trade.ticker,
          companyName: trade.assetDescription ?? trade.ticker,
          tradeType: classifyTradeType(trade.transactionType),
        })),
        // Executive trades show up in the same "Trades" group; clicking
        // navigates to /trades/exec-<id> which renders the executive detail.
        ...executiveTrades.map((trade) => ({
          id: `exec-${trade.id}`,
          politicianName: trade.official.name,
          ticker: trade.ticker ?? "—",
          companyName: trade.assetDescription || (trade.ticker ?? "Executive disclosure"),
          tradeType: classifyTradeType(trade.transactionType),
        })),
      ],
      tickers: stocks.map((stock) => ({
        ticker: stock.ticker,
        companyName: stock.companyName ?? stock.ticker,
      })),
    };
  } catch (error) {
    console.error("[appData] failed to run SQL search:", error);
    return null;
  }
}

function toTrade(row: SqlTradeRow, stock?: { companyName: string | null; sector: string | null } | null): Trade {
  const amountMin = row.amountMinCents == null ? 0 : Number(row.amountMinCents) / 100;
  const amountMax = row.amountMaxCents == null ? amountMin : Number(row.amountMaxCents) / 100;
  const chamber = normalizeChamber(row.politician?.chamber ?? row.house);

  return {
    id: `cong-${row.id}`,
    branch: "congress",
    politicianId: `P-${row.politicianId}`,
    politicianName: row.politician?.name ?? row.representative,
    party: normalizeParty(row.party ?? row.politician?.party),
    state: row.state ?? row.politician?.state ?? "-",
    chamber,
    ticker: row.ticker,
    companyName: stock?.companyName ?? row.assetDescription ?? row.ticker,
    sector: stock?.sector ?? "Unknown",
    tradeType: classifyTradeType(row.transactionType),
    amount: formatAmountRange(amountMin, amountMax, row.amountRangeRaw),
    amountMin,
    amountMax,
    filedDate: dateKey(row.disclosureDate),
    transactionDate: dateKey(row.transactionDate),
    description: row.assetDescription ?? `${row.ticker} disclosure`,
    filingUrl: row.filingUrl ?? "#",
  };
}

/**
 * Maps a UnifiedTradeRow (Congress OR Executive) into the dashboard `Trade`
 * shape. For executive rows, the agency name shows in place of state and
 * "Executive" replaces House/Senate.
 */
function unifiedToTrade(
  row: UnifiedTradeRow,
  stock?: { companyName: string | null; sector: string | null } | null,
): Trade {
  const amountMin = row.amountMinCents == null ? 0 : Number(row.amountMinCents) / 100;
  const amountMax = row.amountMaxCents == null ? amountMin : Number(row.amountMaxCents) / 100;
  const filedDate = dateKey(row.disclosureDate ?? row.transactionDate);
  const ticker = row.ticker ?? "—";
  const chamber: ChamberOrBranch =
    row.branch === "executive"
      ? "Executive"
      : normalizeChamber(row.person.chamber);
  const state =
    row.branch === "executive"
      ? row.person.agency ?? "-"
      : row.person.state ?? "-";
  const party: Party | null =
    row.branch === "executive"
      ? row.person.party === "D" || row.person.party === "R"
        ? row.person.party
        : null
      : normalizeParty(row.person.party);
  return {
    id: row.id,
    branch: row.branch,
    politicianId: row.person.key,
    politicianName: row.person.name,
    party,
    state,
    chamber,
    ticker,
    companyName: stock?.companyName ?? row.assetDescription ?? ticker,
    sector: stock?.sector ?? "Unknown",
    tradeType: classifyTradeType(row.transactionType),
    amount: formatAmountRange(amountMin, amountMax, row.amountRangeRaw),
    amountMin,
    amountMax,
    filedDate,
    transactionDate: dateKey(row.transactionDate),
    description: row.assetDescription ?? `${ticker} disclosure`,
    filingUrl: row.filingUrl ?? "#",
  };
}

function emptyDashboardData(source: SqlFirstDashboardData["source"] = "empty"): SqlFirstDashboardData {
  return {
    recentTradesCount: 0,
    recentVolume: 0,
    bullBearRatio: null,
    activeTickersCount: 0,
    activePoliticians: 0,
    avgDisclosureDelay: 0,
    latestTrades: [],
    optionsTrades: [],
    whaleTrades: [],
    dualInsiderSignals: [],
    sectorMomentum: [],
    tickerBreadth: [],
    disclosureReturns: [],
    committeeLinkedTrades: [],
    darkFlowIntersections: [],
    freshness: {
      lastRunAt: null,
      rowsInsertedToday: 0,
      failedDatasetCount: 0,
    },
    alerts: {
      newFilingsToday: 0,
      committeeLinkedTrades: 0,
      spouseTrades30d: 0,
      largeTrades30d: 0,
      darkFlowIntersections: 0,
      failedDatasetCount: 0,
    },
    source,
  };
}

function buildSparkline(rows: Array<{ date: Date; value: number }>) {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const month = dateKey(row.date).slice(0, 7);
    buckets.set(month, (buckets.get(month) ?? 0) + row.value);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([date, value]) => ({ date, value }));
}

function normalizeParty(value: string | null | undefined): Party {
  return value?.toUpperCase().startsWith("R") ? "R" : "D";
}

function normalizeChamber(value: string | null | undefined): "House" | "Senate" {
  return value?.toLowerCase().includes("sen") ? "Senate" : "House";
}

function classifyTradeType(value: string): TradeType {
  const normalized = value.toLowerCase();
  if (normalized.includes("sell") || normalized.includes("sale")) return "Sell";
  if (normalized.includes("exchange")) return "Exchange";
  return "Buy";
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function getRollingVelocityStats() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  type VelocityRow = {
    recentTradesCount: Numeric;
    activeTickersCount: Numeric;
    recentVolumeCents: Numeric;
    buyVolumeCents: Numeric;
    sellVolumeCents: Numeric;
    avgDisclosureDelay: Numeric;
  };

  const [row] = await db.$queryRaw<VelocityRow[]>`
    SELECT
      COUNT(*) AS recentTradesCount,
      COUNT(DISTINCT ticker) AS activeTickersCount,
      COALESCE(SUM(COALESCE(amountMinCents, amountMaxCents, 0)), 0) AS recentVolumeCents,
      COALESCE(SUM(CASE WHEN transactionType LIKE '%Buy%' OR transactionType LIKE '%Purchase%' THEN COALESCE(amountMinCents, amountMaxCents, 0) ELSE 0 END), 0) AS buyVolumeCents,
      COALESCE(SUM(CASE WHEN transactionType LIKE '%Sell%' OR transactionType LIKE '%Sale%' THEN COALESCE(amountMinCents, amountMaxCents, 0) ELSE 0 END), 0) AS sellVolumeCents,
      COALESCE(AVG(
        CASE
          WHEN julianday(disclosureDate) < julianday(transactionDate) THEN 0
          ELSE julianday(disclosureDate) - julianday(transactionDate)
        END
      ), 0) AS avgDisclosureDelay
    FROM CongressTrade
    WHERE disclosureDate >= ${thirtyDaysAgo}
  `;

  const buyVol = toNumber(row?.buyVolumeCents);
  const sellVol = toNumber(row?.sellVolumeCents);
  
  return {
    recentTradesCount: toNumber(row?.recentTradesCount),
    activeTickersCount: toNumber(row?.activeTickersCount),
    recentVolume: toNumber(row?.recentVolumeCents) / 100,
    // Return null when sellVol is 0 instead of capping at a fake "10x" — the
    // UI was rendering "10.00x" which looks like a real measurement.
    bullBearRatio: sellVol === 0 ? null : buyVol / sellVol,
    avgDisclosureDelay: Math.round(toNumber(row?.avgDisclosureDelay)),
  };
}

async function getOptionsTrades(limit: number): Promise<Trade[]> {
  const since = daysAgo(180);
  const rows = await db.congressTrade.findMany({
    where: {
      disclosureDate: { gte: since },
      OR: [
        { assetDescription: { contains: "option" } },
        { assetDescription: { contains: "strike" } },
        { assetDescription: { contains: "expires" } },
        { assetDescription: { contains: "expiration" } },
      ],
      NOT: [{ assetDescription: { contains: "capital call" } }],
    },
    orderBy: { disclosureDate: 'desc' },
    take: Math.max(limit * 8, 50),
    include: {
      politician: { select: { id: true, name: true, party: true, state: true, chamber: true } }
    }
  });
  
  if (!rows.length) return [];
  const optionRows = rows
    .filter((row) => isOptionAssetDescription(row.assetDescription))
    .slice(0, limit);

  if (!optionRows.length) return [];

  const stocks = await db.stock.findMany({
    where: { ticker: { in: [...new Set(optionRows.map((row) => row.ticker))] } },
  });
  const stockMap = new Map(stocks.map((stock) => [stock.ticker, stock]));
  return optionRows.map((row) => toTrade(row, stockMap.get(row.ticker)));
}

async function getDualInsiderSignals(limit: number) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  type DualInsiderRow = {
    ticker: string;
    companyName: string | null;
    congressBuyVolumeCents: Numeric;
    congressSellVolumeCents: Numeric;
    insiderBuyVolumeCents: Numeric;
    insiderSellVolumeCents: Numeric;
  };

  const rows = await db.$queryRaw<DualInsiderRow[]>`
    WITH congress AS (
      SELECT
        ticker,
        SUM(
          CASE
            WHEN transactionType LIKE '%Buy%' OR transactionType LIKE '%Purchase%'
              THEN COALESCE(amountMinCents, amountMaxCents, 0)
            ELSE 0
          END
        ) AS congressBuyVolumeCents,
        SUM(
          CASE
            WHEN transactionType LIKE '%Sell%' OR transactionType LIKE '%Sale%'
              THEN COALESCE(amountMinCents, amountMaxCents, 0)
            ELSE 0
          END
        ) AS congressSellVolumeCents
      FROM CongressTrade
      WHERE disclosureDate >= ${thirtyDaysAgo}
      GROUP BY ticker
    ),
    insider AS (
      SELECT
        ticker,
        SUM(
          CASE
            WHEN LOWER(transactionType) LIKE '%purchase%'
              OR LOWER(transactionType) LIKE '%buy%'
              OR LOWER(transactionType) LIKE 'p%'
              THEN COALESCE(totalValueCents, shares * pricePerShareCents, 0)
            ELSE 0
          END
        ) AS insiderBuyVolumeCents,
        SUM(
          CASE
            WHEN LOWER(transactionType) LIKE '%sale%'
              OR LOWER(transactionType) LIKE '%sell%'
              OR LOWER(transactionType) LIKE 's%'
              THEN COALESCE(totalValueCents, shares * pricePerShareCents, 0)
            ELSE 0
          END
        ) AS insiderSellVolumeCents
      FROM InsiderTrade
      WHERE COALESCE(filingDate, transactionDate) >= ${thirtyDaysAgo}
      GROUP BY ticker
    )
    SELECT
      c.ticker,
      MAX(s.companyName) AS companyName,
      c.congressBuyVolumeCents,
      c.congressSellVolumeCents,
      i.insiderBuyVolumeCents,
      i.insiderSellVolumeCents
    FROM congress c
    INNER JOIN insider i ON i.ticker = c.ticker
    LEFT JOIN Stock s ON s.ticker = c.ticker
    WHERE
      (
        c.congressBuyVolumeCents > c.congressSellVolumeCents
        AND i.insiderBuyVolumeCents > i.insiderSellVolumeCents
      )
      OR (
        c.congressSellVolumeCents > c.congressBuyVolumeCents
        AND i.insiderSellVolumeCents > i.insiderBuyVolumeCents
      )
    GROUP BY
      c.ticker,
      c.congressBuyVolumeCents,
      c.congressSellVolumeCents,
      i.insiderBuyVolumeCents,
      i.insiderSellVolumeCents
    ORDER BY
      ABS(c.congressBuyVolumeCents - c.congressSellVolumeCents) +
      ABS(i.insiderBuyVolumeCents - i.insiderSellVolumeCents) DESC
    LIMIT ${limit * 2}
  `;
  
  return rows.flatMap((r) => {
    const congressBuyVolume = toNumber(r.congressBuyVolumeCents) / 100;
    const congressSellVolume = toNumber(r.congressSellVolumeCents) / 100;
    const insiderBuyVolume = toNumber(r.insiderBuyVolumeCents) / 100;
    const insiderSellVolume = toNumber(r.insiderSellVolumeCents) / 100;
    const direction = classifyDualInsiderAlignment({
      congressBuyVolume,
      congressSellVolume,
      insiderBuyVolume,
      insiderSellVolume,
    });

    if (!direction) return [];

    return [{
      ticker: r.ticker,
      companyName: r.companyName ?? r.ticker,
      direction,
      congressNetVolume: congressBuyVolume - congressSellVolume,
      insiderNetVolume: insiderBuyVolume - insiderSellVolume,
      congressBuyVolume,
      congressSellVolume,
      insiderBuyVolume,
      insiderSellVolume,
    }];
  }).slice(0, limit);
}

async function getSectorMomentum(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  type SectorMomentumRow = {
    sector: string;
    buyVolumeCents: Numeric;
    sellVolumeCents: Numeric;
    netVolumeCents: Numeric;
  };

  const rows = await db.$queryRaw<SectorMomentumRow[]>`
    SELECT
      COALESCE(s.sector, 'Unknown') AS sector,
      SUM(CASE WHEN c.transactionType LIKE '%Buy%' OR c.transactionType LIKE '%Purchase%' THEN COALESCE(c.amountMinCents, c.amountMaxCents, 0) ELSE 0 END) AS buyVolumeCents,
      SUM(CASE WHEN c.transactionType LIKE '%Sell%' OR c.transactionType LIKE '%Sale%' THEN COALESCE(c.amountMinCents, c.amountMaxCents, 0) ELSE 0 END) AS sellVolumeCents,
      SUM(CASE WHEN c.transactionType LIKE '%Buy%' OR c.transactionType LIKE '%Purchase%' THEN COALESCE(c.amountMinCents, c.amountMaxCents, 0) ELSE 0 END) -
      SUM(CASE WHEN c.transactionType LIKE '%Sell%' OR c.transactionType LIKE '%Sale%' THEN COALESCE(c.amountMinCents, c.amountMaxCents, 0) ELSE 0 END) AS netVolumeCents
    FROM CongressTrade c
    INNER JOIN Stock s ON s.ticker = c.ticker
    WHERE c.disclosureDate >= ${date}
    GROUP BY COALESCE(s.sector, 'Unknown')
    HAVING COALESCE(s.sector, 'Unknown') != 'Unknown'
    ORDER BY ABS(netVolumeCents) DESC
    LIMIT 10
  `;

  return rows.map(r => ({
    sector: r.sector,
    buyVolume: toNumber(r.buyVolumeCents) / 100,
    sellVolume: toNumber(r.sellVolumeCents) / 100,
    netVolume: toNumber(r.netVolumeCents) / 100,
  }));
}

async function getLargestDashboardTrades(limit: number, days: number): Promise<Trade[]> {
  const since = daysAgo(days);
  // Fetch a generous window of both branches, then rank in JS by minimum
  // dollar amount. The previous CongressTrade-only raw SQL did the rank in
  // SQL; merging Executive cheaply needs a JS pass anyway.
  const rows = await fetchAllTrades({ since, take: 500 });
  const eligible = rows.filter((r) => {
    const t = r.transactionType.toLowerCase();
    return t.includes("buy") || t.includes("purchase") || t.includes("sell") || t.includes("sale");
  });

  // Rank by the conservative lower bound used everywhere else in the app.
  eligible.sort((a, b) => {
    const rankA = Number(a.amountMinCents ?? a.amountMaxCents ?? 0n);
    const rankB = Number(b.amountMinCents ?? b.amountMaxCents ?? 0n);
    if (rankA !== rankB) return rankB - rankA;
    const aDate = (a.disclosureDate ?? a.transactionDate).getTime();
    const bDate = (b.disclosureDate ?? b.transactionDate).getTime();
    return bDate - aDate;
  });
  const top = eligible.slice(0, limit);
  if (!top.length) return [];

  const tickers = [...new Set(top.map((r) => r.ticker).filter((t): t is string => t != null))];
  const stocks = tickers.length
    ? await db.stock.findMany({ where: { ticker: { in: tickers } } })
    : [];
  const stockMap = new Map(stocks.map((stock) => [stock.ticker, stock]));
  return top.map((r) => unifiedToTrade(r, r.ticker ? stockMap.get(r.ticker) : undefined));
}

async function getTickerBreadthFacts(days: number, limit: number) {
  const since = daysAgo(days);
  // Unioned: includes both CongressTrade and ExecutiveTrade so the
  // dashboard "tickers gaining breadth across politicians" panel reflects
  // both feeds. politicianKey uses UnifiedPerson.key (P-<n> / O-<n>) so
  // executive officials count as distinct from politicians.
  const rows = await fetchAllTrades({ since, take: 1_500 });
  if (!rows.length) return [];

  const tickers = [...new Set(rows.map((r) => r.ticker).filter((t): t is string => t != null))];
  const stocks = tickers.length
    ? await db.stock.findMany({
        where: { ticker: { in: tickers } },
        select: { ticker: true, companyName: true, sector: true },
      })
    : [];
  const stockByTicker = new Map(stocks.map((stock) => [stock.ticker, stock]));

  const inputs = rows
    .filter((row): row is typeof row & { ticker: string } => row.ticker != null)
    .map<TickerBreadthInput>((row) => {
      const stock = stockByTicker.get(row.ticker);
      return {
        ticker: row.ticker,
        companyName: stock?.companyName ?? null,
        sector: stock?.sector ?? null,
        politicianKey: row.person.key,
        politicianName: row.person.name,
        state: row.person.state ?? row.person.agency ?? null,
        transactionType: row.transactionType,
        amountMinimum: minimumDollars(row.amountMinCents, row.amountMaxCents),
        disclosureDate: row.disclosureDate ?? row.transactionDate,
      };
    });

  return summarizeTickerBreadth(inputs, limit);
}

async function getDisclosureReturnFacts(limit: number) {
  const rows = await db.congressTrade.findMany({
    orderBy: { disclosureDate: "desc" },
    take: 1_000,
    select: {
      ticker: true,
      assetDescription: true,
      disclosureDate: true,
    },
  });

  if (!rows.length) return [];

  const tickers = [...new Set(rows.map((row) => row.ticker))];
  const [stocks, priceRows] = await Promise.all([
    db.stock.findMany({
      where: { ticker: { in: tickers } },
      select: { ticker: true, companyName: true, sector: true },
    }),
    db.tickerPriceCache.findMany({
      where: { ticker: { in: tickers } },
      orderBy: [{ ticker: "asc" }, { date: "asc" }],
      select: { ticker: true, date: true, close: true },
    }),
  ]);
  const stockByTicker = new Map(stocks.map((stock) => [stock.ticker, stock]));
  const closesByTicker = new Map<string, Array<{ date: Date; close: number }>>();

  for (const row of priceRows) {
    const closes = closesByTicker.get(row.ticker) ?? [];
    closes.push({ date: row.date, close: row.close / 100 });
    closesByTicker.set(row.ticker, closes);
  }

  const uniqueRows = [
    ...new Map(rows.map((row) => [`${row.ticker}|${dateKey(row.disclosureDate)}`, row])).values(),
  ];

  const inputs = uniqueRows.map<DisclosureReturnInput>((row) => {
    const stock = stockByTicker.get(row.ticker);
    const closes = closesByTicker.get(row.ticker) ?? [];

    return {
      ticker: row.ticker,
      companyName: stock?.companyName ?? row.assetDescription ?? null,
      sector: stock?.sector ?? null,
      return30d: calculatePostDisclosureReturn({
        disclosureDate: row.disclosureDate,
        horizonDays: 30,
        closes,
      }),
      disclosureDate: row.disclosureDate,
    };
  });

  return rankDisclosureReturnFacts(inputs, limit);
}

/**
 * Congress-only by design: this panel surfaces trades made by members whose
 * committee jurisdiction overlaps the stock's sector/industry. Executive
 * officials don't sit on congressional committees, so they're not included
 * even after the executive/congressional merge. The dashboard subtitle
 * should read "Congress only" alongside this list.
 */
async function getCommitteeLinkedDashboardTrades(limit: number): Promise<DashboardCommitteeTrade[]> {
  const since = daysAgo(30);
  const rows = await db.congressTrade.findMany({
    where: { disclosureDate: { gte: since } },
    orderBy: { disclosureDate: "desc" },
    take: 1_000,
    include: {
      politician: {
        select: {
          name: true,
          party: true,
          state: true,
          committees: {
            include: {
              committee: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!rows.length) return [];

  const stocks = await db.stock.findMany({
    where: { ticker: { in: [...new Set(rows.map((row) => row.ticker))] } },
    select: { ticker: true, companyName: true, sector: true, industry: true },
  });
  const stockByTicker = new Map(stocks.map((stock) => [stock.ticker, stock]));

  return rows
    .map((row) => {
      const stock = stockByTicker.get(row.ticker);
      const committees = row.politician.committees.map<CommitteeContext>((assignment) => ({
        name: assignment.committee.name,
        role: assignment.role,
        isChair: assignment.isChair,
        isRanking: assignment.isRanking,
      }));
      const relevance = scoreCommitteeRelevance({
        ticker: row.ticker,
        sector: stock?.sector,
        industry: stock?.industry,
        committees,
      });

      return {
        id: String(row.id),
        ticker: row.ticker,
        companyName: stock?.companyName ?? row.assetDescription ?? null,
        politicianName: row.politician.name,
        party: row.party ?? row.politician.party,
        state: row.state ?? row.politician.state,
        transactionType: row.transactionType,
        amountMinimum: minimumDollars(row.amountMinCents, row.amountMaxCents),
        disclosureDate: row.disclosureDate,
        committeeLabel: relevance.label,
        committeeMatches: relevance.matches,
      };
    })
    .filter((row) => row.committeeLabel !== "Low")
    .sort(
      (a, b) =>
        labelWeight(b.committeeLabel) - labelWeight(a.committeeLabel) ||
        b.amountMinimum - a.amountMinimum ||
        b.disclosureDate.getTime() - a.disclosureDate.getTime(),
    )
    .slice(0, limit);
}

async function getDarkFlowIntersections(limit: number): Promise<DashboardDarkFlowIntersection[]> {
  const since = daysAgo(30);
  const offExchangeSince = daysAgo(7);

  type Row = {
    ticker: string;
    companyName: string | null;
    congressNetVolumeCents: Numeric;
    politicianCount: Numeric;
    darkPoolPercent: number | null;
    shortVolumePercent: number | null;
    totalVolume: Numeric;
    latestDate: Date | null;
  };

  const rows = await db.$queryRaw<Row[]>`
    WITH congress AS (
      SELECT
        ticker,
        COUNT(DISTINCT politicianId) AS politicianCount,
        SUM(
          CASE
            WHEN transactionType LIKE '%Buy%' OR transactionType LIKE '%Purchase%'
              THEN COALESCE(amountMinCents, amountMaxCents, 0)
            WHEN transactionType LIKE '%Sell%' OR transactionType LIKE '%Sale%'
              THEN -COALESCE(amountMinCents, amountMaxCents, 0)
            ELSE 0
          END
        ) AS congressNetVolumeCents
      FROM CongressTrade
      WHERE disclosureDate >= ${since}
      GROUP BY ticker
    ),
    latest_off_exchange AS (
      SELECT o.*
      FROM OffExchangeActivity o
      INNER JOIN (
        SELECT ticker, MAX(date) AS maxDate
        FROM OffExchangeActivity
        WHERE date >= ${offExchangeSince}
        GROUP BY ticker
      ) latest ON latest.ticker = o.ticker AND latest.maxDate = o.date
    )
    SELECT
      c.ticker,
      s.companyName,
      c.congressNetVolumeCents,
      c.politicianCount,
      o.darkPoolPercent,
      o.shortVolumePercent,
      o.totalVolume,
      o.date AS latestDate
    FROM congress c
    INNER JOIN latest_off_exchange o ON o.ticker = c.ticker
    LEFT JOIN Stock s ON s.ticker = c.ticker
    WHERE ABS(c.congressNetVolumeCents) > 0
    ORDER BY ABS(c.congressNetVolumeCents) DESC, c.politicianCount DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ticker: row.ticker,
    companyName: row.companyName,
    congressNetVolume: toNumber(row.congressNetVolumeCents) / 100,
    politicianCount: toNumber(row.politicianCount),
    darkPoolPercent: row.darkPoolPercent,
    shortVolumePercent: row.shortVolumePercent,
    totalVolume: row.totalVolume == null ? null : toNumber(row.totalVolume),
    latestDate: row.latestDate,
  }));
}

async function getDashboardAlertCounts(): Promise<DashboardAlertCounts> {
  // Use UTC midnight to match disclosureDate's UTC storage. setHours(0,0,0,0)
  // would shift by the server's local TZ, which on a non-UTC host counts a
  // different day than the rest of the dashboard freshness queries.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const thirtyDaysAgo = daysAgo(30);

  const [
    newFilingsTodayCongress,
    newFilingsTodayExecutive,
    spouseTrades30d,
    largeTrades30d,
    failedDatasetCount,
  ] = await Promise.all([
    db.congressTrade.count({
      where: { disclosureDate: { gte: today } },
    }),
    // Executive disclosures don't have a separate disclosureDate; use
    // transactionDate as the "became public today" proxy.
    db.executiveTrade.count({
      where: { transactionDate: { gte: today } },
    }),
    db.congressTrade.count({
      where: {
        disclosureDate: { gte: thirtyDaysAgo },
        OR: [
          { ownerType: { contains: "spouse" } },
          { ownerType: { contains: "dependent" } },
          { ownerType: { contains: "child" } },
          { ownerRaw: { contains: "spouse" } },
          { ownerRaw: { contains: "dependent" } },
          { ownerRaw: { contains: "child" } },
        ],
      },
    }),
    db.congressTrade.count({
      where: {
        disclosureDate: { gte: thirtyDaysAgo },
        // Use amountMinCents so a $500K-$1M range row (whose upper bound is
        // $1M) doesn't get counted as "$1M+".
        amountMinCents: { gte: BigInt(100_000_000) },
      },
    }),
    db.backfillJob.count({
      where: {
        lastError: { not: null },
      },
    }),
  ]);

  return {
    newFilingsToday: newFilingsTodayCongress + newFilingsTodayExecutive,
    committeeLinkedTrades: 0,
    spouseTrades30d,
    largeTrades30d,
    darkFlowIntersections: 0,
    failedDatasetCount,
  };
}

async function getDashboardFreshness(): Promise<DashboardFreshness> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [latestRun, todayRows, failedDatasetCount] = await Promise.all([
    db.ingestRun.findFirst({
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    db.ingestRun.aggregate({
      where: { startedAt: { gte: today } },
      _sum: { rowsInserted: true },
    }),
    db.backfillJob.count({
      where: {
        lastError: { not: null },
      },
    }),
  ]);

  return {
    lastRunAt: latestRun?.finishedAt ?? null,
    rowsInsertedToday: todayRows._sum.rowsInserted ?? 0,
    failedDatasetCount,
  };
}

function toNumber(value: Numeric) {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function labelWeight(label: "High" | "Medium" | "Low") {
  if (label === "High") return 3;
  if (label === "Medium") return 2;
  return 1;
}

function formatAmountRange(min: number, max: number, raw: string | null) {
  const normalized = raw?.replace(/\s/g, "").toUpperCase();
  if (normalized) {
    const compact = normalized.replace("$1,000", "$1K").replace("$15,000", "$15K");
    if (compact.includes("$1K") || compact.includes("$15K") || compact.includes("$50K")) {
      return compact.replace("-", "-");
    }
  }
  if (min === 1_000 && max === 15_000) return "$1K-$15K";
  if (min === 15_000 && max === 50_000) return "$15K-$50K";
  if (min === 50_000 && max === 100_000) return "$50K-$100K";
  if (min === 100_000 && max === 250_000) return "$100K-$250K";
  if (min === 250_000 && max === 500_000) return "$250K-$500K";
  if (min === 500_000 && max === 1_000_000) return "$500K-$1M";
  if (min === 1_000_000 && max === 5_000_000) return "$1M-$5M";
  return `${formatMoney(min)}-${formatMoney(max)}`;
}
