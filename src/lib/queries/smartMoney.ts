import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { parseSqliteUtc } from "@/lib/sql-dates";
import { buildTrackedFundSqlFilter } from "./smartMoneyFunds";
import type { MarketSignalMetric } from "./marketSignalData";

const DEFAULT_MIN_FUND_COUNT = 5;
const DEFAULT_MIN_MARKET_CAP = 2_000_000_000;
const DEFAULT_MAX_MARKET_CAP = 20_000_000_000;
const HISTORY_MONTHS = 30;
const MAX_SIGNALS = 40;
const MAX_GRAPH_SIGNALS = 8;
const MAX_QUERY_ROWS = 150_000;
const TRACKED_FUND_SQL_FILTER = buildTrackedFundSqlFilter("h");
const SIGNAL_SIDE_ORDER: SmartMoneySignalSide[] = ["LONG_BUY", "LONG_SELL", "PUT_BEARISH"];

export type SmartMoneyHoldingInput = {
  filer: string;
  ticker: string;
  companyName: string | null;
  sector: string | null;
  marketCap: number | null;
  shares: number | null;
  value: number | null;
  changeShares: number | null;
  putCall: "PUT" | "CALL" | null;
  filingDate: Date;
  reportDate: Date;
};

export type SmartMoneySignalSide = "LONG_BUY" | "LONG_SELL" | "PUT_BEARISH";

export type SmartMoneyFundParticipant = {
  filer: string;
  value: number | null;
  shares: number | null;
  changeShares: number | null;
  filingDate: Date;
  isNewPosition: boolean;
};

export type SmartMoneySignal = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  marketCap: number | null;
  reportDate: Date;
  publicSignalDate: Date;
  fundCount: number;
  totalValue: number;
  totalChangeShares: number;
  averageHistoricalOverlap: number;
  score: number;
  signalSide: SmartMoneySignalSide;
  stance: "Bullish anomaly" | "Bearish sell cluster" | "Bearish put cluster" | "Crowded cluster" | "Watchlist only";
  confidence: "High" | "Medium" | "Low";
  funds: SmartMoneyFundParticipant[];
  reasons: string[];
  warnings: string[];
};

export type SmartMoneyNetworkNode = {
  id: string;
  label: string;
  kind: "fund" | "stock";
  score: number;
  signalSide?: SmartMoneySignalSide;
  fundCount?: number;
  marketCap?: number | null;
  sector?: string | null;
};

export type SmartMoneyNetworkLink = {
  source: string;
  target: string;
  ticker: string;
  value: number | null;
  changeShares: number | null;
  filingDate: Date;
  signalSide: SmartMoneySignalSide;
};

export type SmartMoneyAnalysis = {
  source: "database" | "empty" | "database-error";
  generatedAt: Date;
  reportDate: Date | null;
  summary: {
    signalCount: number;
    highConfidenceCount: number;
    fundCount: number;
    tickerCount: number;
    latestPublicSignalDate: Date | null;
  };
  metrics: MarketSignalMetric[];
  signals: SmartMoneySignal[];
  network: {
    nodes: SmartMoneyNetworkNode[];
    links: SmartMoneyNetworkLink[];
  };
};

type SmartMoneyOptions = {
  minFundCount?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  targetReportDate?: Date;
};

type RawHoldingRow = {
  filer: string;
  ticker: string;
  companyName: string | null;
  sector: string | null;
  marketCap: string | null;
  shares: number | bigint | null;
  valueCents: string | null;
  filingDate: Date | string;
  reportDate: Date | string;
  changeShares: number | bigint | null;
  putCall: "PUT" | "CALL" | null;
};

type RawHoldingBaseRow = Omit<RawHoldingRow, "companyName" | "sector" | "marketCap">;

type StockLookupRow = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  marketCap: string | null;
};

type SignalCandidateRow = SmartMoneyHoldingInput & {
  signalSide: SmartMoneySignalSide;
  signalChangeShares: number;
  syntheticExit: boolean;
};

export async function getSmartMoneyAnalysis(): Promise<SmartMoneyAnalysis> {
  try {
    const latestRows = await db.$queryRaw<Array<{ reportDate: Date | string | null }>>`
      SELECT MAX("reportDate") AS "reportDate"
      FROM "ThirteenFHolding"
    `;
    const latest = latestRows[0]?.reportDate;
    if (!latest) return emptyAnalysis("empty", null);

    const targetReportDate = toDate(latest);
    const historyStart = new Date(targetReportDate);
    historyStart.setUTCMonth(historyStart.getUTCMonth() - HISTORY_MONTHS);

    let rows: RawHoldingRow[];
    const hasCurated = await hasCuratedTargetRows(targetReportDate);
    if (hasCurated) {
      rows = await queryCuratedFundRows(historyStart);
    } else {
      return emptyAnalysis("empty", targetReportDate);
    }

    return buildSmartMoneyAnalysis(rows.map(toHoldingInput), { targetReportDate });
  } catch {
    return emptyAnalysis("database-error", null);
  }
}

async function hasCuratedTargetRows(targetReportDate: Date) {
  const rows = await db.$queryRaw<Array<{ found: number }>>`
    SELECT 1 AS "found"
    FROM "ThirteenFHolding" h
    WHERE h."reportDate" = ${targetReportDate}
      AND (${Prisma.raw(TRACKED_FUND_SQL_FILTER)})
    LIMIT 1
  `;
  return rows.length > 0;
}

async function queryCuratedFundRows(historyStart: Date) {
  const rows = await db.$queryRaw<RawHoldingBaseRow[]>`
    SELECT
      h."filer",
      UPPER(h."ticker") AS "ticker",
      h."shares",
      CAST(h."valueCents" AS TEXT) AS "valueCents",
      h."filingDate",
      h."reportDate",
      h."changeShares",
      h."putCall"
    FROM "ThirteenFHolding" h
    WHERE h."reportDate" >= ${historyStart}
      AND (${Prisma.raw(TRACKED_FUND_SQL_FILTER)})
    LIMIT ${MAX_QUERY_ROWS}
  `;
  return hydrateStockFields(rows);
}

async function hydrateStockFields(rows: RawHoldingBaseRow[]): Promise<RawHoldingRow[]> {
  if (!rows.length) return [];

  const tickers = [...new Set(rows.map((row) => row.ticker.toUpperCase()))];
  const stocks = new Map<string, StockLookupRow>();

  for (const tickerBatch of chunks(tickers, 400)) {
    const stockRows = await db.$queryRaw<StockLookupRow[]>`
      SELECT
        UPPER("ticker") AS "ticker",
        "companyName",
        "sector",
        CAST("marketCap" AS TEXT) AS "marketCap"
      FROM "Stock"
      WHERE "ticker" IN (${Prisma.join(tickerBatch)})
    `;
    for (const stock of stockRows) stocks.set(stock.ticker.toUpperCase(), stock);
  }

  return rows.map((row) => {
    const stock = stocks.get(row.ticker.toUpperCase());
    return {
      ...row,
      companyName: stock?.companyName ?? null,
      sector: stock?.sector ?? null,
      marketCap: stock?.marketCap ?? null,
    };
  });
}

export function buildSmartMoneyAnalysis(
  rows: SmartMoneyHoldingInput[],
  options: SmartMoneyOptions = {},
): SmartMoneyAnalysis {
  const generatedAt = new Date();
  const targetReportDate = options.targetReportDate ?? latestDate(rows.map((row) => row.reportDate));
  if (!targetReportDate) return emptyAnalysis("empty", null, generatedAt);

  const minFundCount = options.minFundCount ?? DEFAULT_MIN_FUND_COUNT;
  const minMarketCap = options.minMarketCap ?? DEFAULT_MIN_MARKET_CAP;
  const maxMarketCap = options.maxMarketCap ?? DEFAULT_MAX_MARKET_CAP;
  const targetKey = dateKey(targetReportDate);
  const targetRows = rows.filter((row) => dateKey(row.reportDate) === targetKey);
  if (!targetRows.length) return emptyAnalysis("empty", targetReportDate, generatedAt);

  const historyRows = rows.filter((row) => row.reportDate.getTime() < targetReportDate.getTime());
  const priorByFundTickerSide = new Set(
    historyRows.map((row) => fundTickerSideKey(row.filer, row.ticker, holdingExposureSide(row))),
  );
  const historyTickersBySide = buildHistoryTickersBySide(historyRows);
  const activeRows = buildSignalCandidates(targetRows, historyRows, priorByFundTickerSide, targetReportDate);
  const overlapCache = new Map<string, number>();

  const allSignals = [...groupBy(activeRows, (row) => `${row.signalSide}\u0000${row.ticker}`).entries()]
    .filter(([, tickerRows]) => uniqueFilerCount(tickerRows) >= minFundCount)
    .map(([, tickerRows]) =>
      summarizeTickerSignal(tickerRows, historyTickersBySide, overlapCache, { minMarketCap, maxMarketCap }),
    )
    .filter((signal): signal is SmartMoneySignal => signal != null)
    .sort(compareSignals);
  const signals = selectBalancedSignals(allSignals, MAX_SIGNALS);

  return {
    source: signals.length || rows.length ? "database" : "empty",
    generatedAt,
    reportDate: targetReportDate,
    summary: buildSummary(signals, targetRows),
    metrics: buildMetrics(signals, targetRows),
    signals,
    network: buildNetwork(signals),
  };
}

function summarizeTickerSignal(
  rows: SignalCandidateRow[],
  historyTickersBySide: Map<SmartMoneySignalSide, Map<string, Set<string>>>,
  overlapCache: Map<string, number>,
  options: Pick<Required<SmartMoneyOptions>, "minMarketCap" | "maxMarketCap">,
): SmartMoneySignal | null {
  const byFiler = new Map<string, SignalCandidateRow>();
  for (const row of rows) {
    const existing = byFiler.get(row.filer);
    if (
      !existing ||
      row.signalChangeShares > existing.signalChangeShares ||
      (row.signalChangeShares === existing.signalChangeShares && (row.value ?? 0) > (existing.value ?? 0))
    ) {
      byFiler.set(row.filer, row);
    }
  }

  const participants = [...byFiler.values()];
  const first = participants[0];
  if (!first) return null;
  const signalSide = first.signalSide;
  const marketCap = first.marketCap;
  const isMidCap = marketCap != null && marketCap >= options.minMarketCap && marketCap <= options.maxMarketCap;
  if (marketCap != null && !isMidCap) return null;

  const fundNames = participants.map((row) => row.filer).sort();
  const historyTickersByFund = historyTickersBySide.get(signalSide) ?? new Map<string, Set<string>>();
  const averageHistoricalOverlap = averagePairOverlap(fundNames, historyTickersByFund, overlapCache);
  const totalValue = participants.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const totalChangeShares = participants.reduce((sum, row) => sum + row.signalChangeShares, 0);
  const publicSignalDate = latestDate(participants.map((row) => row.filingDate)) ?? first.filingDate;
  const fundCount = participants.length;
  const score = scoreSignal({
    fundCount,
    totalValue,
    totalChangeShares,
    averageHistoricalOverlap,
    isMidCap,
    hasMarketCap: marketCap != null,
  });
  const warnings = buildWarnings(averageHistoricalOverlap, marketCap);

  return {
    ticker: first.ticker,
    companyName: first.companyName,
    sector: first.sector,
    marketCap,
    reportDate: first.reportDate,
    publicSignalDate,
    fundCount,
    totalValue,
    totalChangeShares,
    averageHistoricalOverlap,
    score,
    signalSide,
    stance: stanceForSignal(signalSide, score, averageHistoricalOverlap),
    confidence: score >= 75 ? "High" : score >= 55 ? "Medium" : "Low",
    funds: participants
      .map((row) => ({
        filer: row.filer,
        value: row.value,
        shares: row.shares,
        changeShares: row.changeShares,
        filingDate: row.filingDate,
        isNewPosition: !row.syntheticExit && (row.changeShares == null || row.changeShares > 0),
      }))
      .sort(
        (a, b) =>
          Math.abs(b.changeShares ?? 0) - Math.abs(a.changeShares ?? 0) ||
          (b.value ?? 0) - (a.value ?? 0) ||
          a.filer.localeCompare(b.filer),
      ),
    reasons: [
      fundActionReason(signalSide, fundCount),
      `${formatPercent(1 - averageHistoricalOverlap)} pair novelty versus prior 13F overlap`,
      marketCap == null ? "Market cap unavailable; kept for review" : `${formatMarketCap(marketCap)} market cap fits the mid-cap screen`,
    ],
    warnings,
  };
}

function buildSignalCandidates(
  targetRows: SmartMoneyHoldingInput[],
  historyRows: SmartMoneyHoldingInput[],
  priorByFundTickerSide: Set<string>,
  targetReportDate: Date,
): SignalCandidateRow[] {
  const candidates: SignalCandidateRow[] = [];

  for (const row of targetRows) {
    const side = holdingExposureSide(row);
    const hasPriorPosition = priorByFundTickerSide.has(fundTickerSideKey(row.filer, row.ticker, side));
    const changeShares = row.changeShares;

    if (side === "PUT") {
      if ((changeShares ?? 0) > 0 || (changeShares == null && !hasPriorPosition)) {
        candidates.push({
          ...row,
          signalSide: "PUT_BEARISH",
          signalChangeShares: positiveChangeMagnitude(row),
          syntheticExit: false,
        });
      }
      continue;
    }

    if ((changeShares ?? 0) > 0 || (changeShares == null && !hasPriorPosition)) {
      candidates.push({
        ...row,
        signalSide: "LONG_BUY",
        signalChangeShares: positiveChangeMagnitude(row),
        syntheticExit: false,
      });
      continue;
    }

    if ((changeShares ?? 0) < 0) {
      candidates.push({
        ...row,
        signalSide: "LONG_SELL",
        signalChangeShares: Math.abs(changeShares ?? 0),
        syntheticExit: false,
      });
    }
  }

  const previousReportDate = latestDate(historyRows.map((row) => row.reportDate));
  if (!previousReportDate) return candidates;

  const previousKey = dateKey(previousReportDate);
  const currentLongKeys = new Set(
    targetRows
      .filter((row) => holdingExposureSide(row) === "LONG")
      .map((row) => fundTickerSideKey(row.filer, row.ticker, "LONG")),
  );
  const targetFilingDateByFund = new Map<string, Date>();
  for (const row of targetRows) {
    const existing = targetFilingDateByFund.get(row.filer);
    if (!existing || row.filingDate.getTime() > existing.getTime()) targetFilingDateByFund.set(row.filer, row.filingDate);
  }

  for (const row of historyRows) {
    if (dateKey(row.reportDate) !== previousKey || holdingExposureSide(row) !== "LONG") continue;

    const key = fundTickerSideKey(row.filer, row.ticker, "LONG");
    if (currentLongKeys.has(key)) continue;

    const exitedShares = Math.max(1, row.shares ?? Math.abs(row.changeShares ?? 0));
    candidates.push({
      ...row,
      shares: 0,
      changeShares: -exitedShares,
      reportDate: targetReportDate,
      filingDate: targetFilingDateByFund.get(row.filer) ?? targetReportDate,
      signalSide: "LONG_SELL",
      signalChangeShares: exitedShares,
      syntheticExit: true,
    });
  }

  return candidates;
}

function positiveChangeMagnitude(row: SmartMoneyHoldingInput) {
  if ((row.changeShares ?? 0) > 0) return row.changeShares ?? 0;
  return Math.max(0, row.shares ?? 0);
}

function scoreSignal(input: {
  fundCount: number;
  totalValue: number;
  totalChangeShares: number;
  averageHistoricalOverlap: number;
  isMidCap: boolean;
  hasMarketCap: boolean;
}) {
  const fundScore = clamp(input.fundCount * 7, 0, 35);
  const noveltyScore = clamp((1 - input.averageHistoricalOverlap) * 25, 0, 25);
  const valueScore = clamp(Math.log10(input.totalValue + 1) * 4, 0, 20);
  const changeScore = clamp(Math.log10(input.totalChangeShares + 1) * 3, 0, 10);
  const capScore = input.isMidCap ? 10 : input.hasMarketCap ? 0 : 4;
  const crowdPenalty = input.averageHistoricalOverlap >= 0.5 ? 25 : 0;

  return Math.round(
    clamp(fundScore + noveltyScore + valueScore + changeScore + capScore - crowdPenalty, 0, 100),
  );
}

function selectBalancedSignals(signals: SmartMoneySignal[], limit: number) {
  const selected = new Map<string, SmartMoneySignal>();
  const sideQuota = Math.max(2, Math.floor(limit / 4));

  for (const side of SIGNAL_SIDE_ORDER) {
    for (const signal of signals.filter((candidate) => candidate.signalSide === side).slice(0, sideQuota)) {
      selected.set(signalKey(signal), signal);
    }
  }

  for (const signal of signals) {
    if (selected.size >= limit) break;
    selected.set(signalKey(signal), signal);
  }

  return [...selected.values()].sort(compareSignals).slice(0, limit);
}

function compareSignals(a: SmartMoneySignal, b: SmartMoneySignal) {
  return (
    b.score - a.score ||
    b.fundCount - a.fundCount ||
    b.totalValue - a.totalValue ||
    a.ticker.localeCompare(b.ticker)
  );
}

function signalKey(signal: Pick<SmartMoneySignal, "signalSide" | "ticker">) {
  return `${signal.signalSide}\u0000${signal.ticker}`;
}

function buildWarnings(averageHistoricalOverlap: number, marketCap: number | null) {
  const warnings: string[] = [];
  if (averageHistoricalOverlap >= 0.5) warnings.push("Funds already have high historical overlap");
  if (marketCap == null) warnings.push("Market cap unavailable; verify issuer size manually");
  return warnings;
}

function averagePairOverlap(
  filers: string[],
  historyTickersByFund: Map<string, Set<string>>,
  overlapCache: Map<string, number>,
) {
  let pairCount = 0;
  let total = 0;

  for (let i = 0; i < filers.length; i += 1) {
    for (let j = i + 1; j < filers.length; j += 1) {
      total += cachedPairOverlap(filers[i], filers[j], historyTickersByFund, overlapCache);
      pairCount += 1;
    }
  }

  return pairCount === 0 ? 0 : total / pairCount;
}

function cachedPairOverlap(
  firstFiler: string,
  secondFiler: string,
  historyTickersByFund: Map<string, Set<string>>,
  overlapCache: Map<string, number>,
) {
  const key = firstFiler < secondFiler ? `${firstFiler}\u0000${secondFiler}` : `${secondFiler}\u0000${firstFiler}`;
  const cached = overlapCache.get(key);
  if (cached != null) return cached;

  const first = historyTickersByFund.get(firstFiler) ?? new Set<string>();
  const second = historyTickersByFund.get(secondFiler) ?? new Set<string>();
  const overlap = jaccard(first, second);
  overlapCache.set(key, overlap);
  return overlap;
}

function jaccard(first: Set<string>, second: Set<string>) {
  const union = new Set([...first, ...second]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const value of first) {
    if (second.has(value)) intersection += 1;
  }
  return intersection / union.size;
}

function buildHistoryTickersBySide(rows: SmartMoneyHoldingInput[]) {
  return new Map<SmartMoneySignalSide, Map<string, Set<string>>>([
    ["LONG_BUY", buildHistoryTickersByFund(rows.filter((row) => belongsToHistoricalSide(row, "LONG_BUY")))],
    ["LONG_SELL", buildHistoryTickersByFund(rows.filter((row) => belongsToHistoricalSide(row, "LONG_SELL")))],
    ["PUT_BEARISH", buildHistoryTickersByFund(rows.filter((row) => belongsToHistoricalSide(row, "PUT_BEARISH")))],
  ]);
}

function buildHistoryTickersByFund(rows: SmartMoneyHoldingInput[]) {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const tickers = map.get(row.filer) ?? new Set<string>();
    tickers.add(row.ticker);
    map.set(row.filer, tickers);
  }
  return map;
}

function belongsToHistoricalSide(row: SmartMoneyHoldingInput, signalSide: SmartMoneySignalSide) {
  if (signalSide === "PUT_BEARISH") return holdingExposureSide(row) === "PUT";
  if (holdingExposureSide(row) !== "LONG") return false;
  if (signalSide === "LONG_SELL") return (row.changeShares ?? 0) < 0;
  return row.changeShares == null || row.changeShares > 0;
}

function uniqueFilerCount(rows: Array<{ filer: string }>) {
  return new Set(rows.map((row) => row.filer)).size;
}

function buildSummary(signals: SmartMoneySignal[], targetRows: SmartMoneyHoldingInput[]) {
  return {
    signalCount: signals.length,
    highConfidenceCount: signals.filter((signal) => signal.confidence === "High").length,
    fundCount: new Set(targetRows.map((row) => row.filer)).size,
    tickerCount: new Set(targetRows.map((row) => row.ticker)).size,
    latestPublicSignalDate: latestDate(signals.map((signal) => signal.publicSignalDate)),
  };
}

function buildMetrics(signals: SmartMoneySignal[], targetRows: SmartMoneyHoldingInput[]): MarketSignalMetric[] {
  const bullishClusters = signals.filter((signal) => signal.signalSide === "LONG_BUY").length;
  const sellClusters = signals.filter((signal) => signal.signalSide === "LONG_SELL").length;
  const putClusters = signals.filter((signal) => signal.signalSide === "PUT_BEARISH").length;
  const avgScore = signals.length
    ? Math.round(signals.reduce((sum, signal) => sum + signal.score, 0) / signals.length)
    : 0;
  const avgOverlap = signals.length
    ? signals.reduce((sum, signal) => sum + signal.averageHistoricalOverlap, 0) / signals.length
    : 0;

  return [
    { label: "Bullish clusters", value: bullishClusters.toLocaleString(), tone: bullishClusters ? "positive" : "neutral" },
    { label: "Sell clusters", value: sellClusters.toLocaleString(), tone: sellClusters ? "negative" : "neutral" },
    { label: "Put clusters", value: putClusters.toLocaleString(), tone: putClusters ? "negative" : "neutral" },
    { label: "Average score", value: avgScore.toLocaleString(), tone: avgScore >= 75 ? "positive" : "neutral" },
    { label: "Avg prior overlap", value: formatPercent(avgOverlap), tone: avgOverlap >= 0.5 ? "negative" : "neutral" },
    { label: "13F rows scanned", value: targetRows.length.toLocaleString(), tone: "neutral" },
  ];
}

function buildNetwork(signals: SmartMoneySignal[]) {
  const nodeMap = new Map<string, SmartMoneyNetworkNode>();
  const links: SmartMoneyNetworkLink[] = [];

  for (const signal of selectBalancedSignals(signals, MAX_GRAPH_SIGNALS)) {
    const stockId = `stock:${signal.signalSide}:${signal.ticker}`;
    nodeMap.set(stockId, {
      id: stockId,
      label: signal.ticker,
      kind: "stock",
      score: signal.score,
      signalSide: signal.signalSide,
      fundCount: signal.fundCount,
      marketCap: signal.marketCap,
      sector: signal.sector,
    });

    for (const fund of signal.funds) {
      const fundId = `fund:${fund.filer}`;
      const existing = nodeMap.get(fundId);
      nodeMap.set(fundId, {
        id: fundId,
        label: fund.filer,
        kind: "fund",
        score: Math.max(existing?.score ?? 0, signal.score),
      });
      links.push({
        source: fundId,
        target: stockId,
        ticker: signal.ticker,
        value: fund.value,
        changeShares: fund.changeShares,
        filingDate: fund.filingDate,
        signalSide: signal.signalSide,
      });
    }
  }

  return {
    nodes: [...nodeMap.values()].sort(
      (a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
    ),
    links,
  };
}

function toHoldingInput(row: RawHoldingRow): SmartMoneyHoldingInput {
  return {
    filer: row.filer,
    ticker: row.ticker.toUpperCase(),
    companyName: row.companyName,
    sector: row.sector,
    marketCap: row.marketCap == null ? null : Number(row.marketCap),
    shares: row.shares == null ? null : Number(row.shares),
    value: row.valueCents == null ? null : Number(row.valueCents) / 100,
    changeShares: row.changeShares == null ? null : Number(row.changeShares),
    putCall: row.putCall,
    filingDate: toDate(row.filingDate),
    reportDate: toDate(row.reportDate),
  };
}

function emptyAnalysis(
  source: SmartMoneyAnalysis["source"],
  reportDate: Date | null,
  generatedAt = new Date(),
): SmartMoneyAnalysis {
  return {
    source,
    generatedAt,
    reportDate,
    summary: {
      signalCount: 0,
      highConfidenceCount: 0,
      fundCount: 0,
      tickerCount: 0,
      latestPublicSignalDate: null,
    },
    metrics: [
      { label: "Bullish clusters", value: "0", tone: "neutral" },
      { label: "Sell clusters", value: "0", tone: "neutral" },
      { label: "Put clusters", value: "0", tone: "neutral" },
      { label: "Average score", value: "0", tone: "neutral" },
      { label: "Avg prior overlap", value: "0%", tone: "neutral" },
      { label: "13F rows scanned", value: "0", tone: "neutral" },
    ],
    signals: [],
    network: { nodes: [], links: [] },
  };
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return parseSqliteUtc(value) ?? new Date(value);
}

function latestDate(dates: Date[]) {
  if (!dates.length) return null;
  return dates.reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest), dates[0]);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function holdingExposureSide(row: Pick<SmartMoneyHoldingInput, "putCall">) {
  return row.putCall === "PUT" ? "PUT" : "LONG";
}

function fundTickerSideKey(filer: string, ticker: string, side: "LONG" | "PUT") {
  return `${side}\u0000${filer}\u0000${ticker.toUpperCase()}`;
}

function stanceForSignal(signalSide: SmartMoneySignalSide, score: number, averageHistoricalOverlap: number) {
  if (score >= 70) {
    if (signalSide === "LONG_BUY") return "Bullish anomaly";
    if (signalSide === "LONG_SELL") return "Bearish sell cluster";
    return "Bearish put cluster";
  }

  return averageHistoricalOverlap >= 0.5 ? "Crowded cluster" : "Watchlist only";
}

function fundActionReason(signalSide: SmartMoneySignalSide, fundCount: number) {
  if (signalSide === "LONG_SELL") return `${fundCount} funds reduced or exited the position`;
  if (signalSide === "PUT_BEARISH") return `${fundCount} funds opened or increased put exposure`;
  return `${fundCount} funds increased or opened the position`;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMarketCap(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  return `$${Math.round(value).toLocaleString()}`;
}
