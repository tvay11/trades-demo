import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import {
  scoreCommitteeRelevance,
  type CommitteeContext,
  type CommitteeRelevance,
} from "@/lib/committees/relevance";
import { minimumDollars, type Cents } from "@/lib/money";
import { parseSqliteUtc } from "@/lib/sql-dates";
import { classifyAction } from "@/lib/trades/classify";
import {
  MIN_OFF_EXCHANGE_BASELINE_SAMPLES,
  scoreDarkFlowCandidates,
  scoreLongShortCandidates,
  type DarkFlowCandidate,
  type DarkFlowSignalInput,
  type LongShortCandidate,
  type LongShortSignalInput,
} from "./marketSignals";

export type MarketSignalMetric = {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "negative" | "accent";
};

export type LongShortAnalysis = {
  generatedAt: Date;
  source: "database" | "database-error";
  longs: LongShortCandidate[];
  shorts: LongShortCandidate[];
  all: LongShortCandidate[];
  metrics: MarketSignalMetric[];
  /** Latest CongressTrade.disclosureDate in the lookback window, YYYY-MM-DD.
   *  Drives the hero freshness chip. Null when the window is empty. */
  latestDataDate: string | null;
};

export type DarkFlowAnalysis = {
  generatedAt: Date;
  source: "database" | "database-error";
  stealth: DarkFlowCandidate[];
  crowded: DarkFlowCandidate[];
  all: DarkFlowCandidate[];
  metrics: MarketSignalMetric[];
  /** Most recent OffExchangeActivity.date across all tickers; null when none. */
  latestOffExchangeDate: Date | null;
  /** Tickers in the lookback window where we have ≥ N snapshots and can
   * compute a meaningful excess/surge. The hero banner uses this to warn
   * the user when the page is essentially running on a single snapshot. */
  tickersWithBaseline: number;
  totalTickersWithOffExchange: number;
};

type CongressRow = {
  ticker: string;
  transactionType: string;
  transactionDate: Date;
  disclosureDate: Date;
  amountMinCents: Cents;
  amountMaxCents: Cents;
  representative: string;
  politician?: {
    committees: Array<{
      role: string | null;
      isChair: boolean;
      isRanking: boolean;
      committee: {
        name: string;
      };
    }>;
  } | null;
};

type StockRow = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
};

type InsiderFlowRow = {
  ticker: string;
  netValueCents: string | null;
};

type OffExchangeRow = {
  ticker: string;
  latestDate: Date | string;
  latestShortVolume: number | null;
  latestTotalVolume: number | null;
  latestShortVolumePercent: number | null;
  latestDarkPoolPercent: number | null;
  averageShortVolumePercent: number | null;
  averageDarkPoolPercent: number | null;
  averageTotalVolume: number | null;
  offExchangeSampleSize: number;
};

type ValueByTickerRow = {
  ticker: string | null;
  amountCents: string | null;
};

type TickerBucket = {
  ticker: string;
  buyCount: number;
  sellCount: number;
  politicianNames: Set<string>;
  estimatedBuyVolume: number;
  estimatedSellVolume: number;
  disclosureLagDays: number[];
  latestDisclosureDate: Date | null;
  committeeRelevance: CommitteeRelevance;
};

const LOOKBACK_DAYS = 180;
const OFF_EXCHANGE_BASELINE_DATES = 20;

export async function getLongShortAnalysis(): Promise<LongShortAnalysis> {
  "use cache";
  applyCacheLife("minutes");

  try {
    const since = daysAgo(LOOKBACK_DAYS);
    const [stocks, congressRows, executiveRows, insiderRows, altSources] = await Promise.all([
      db.stock.findMany({
        select: { ticker: true, companyName: true, sector: true },
      }),
      db.congressTrade.findMany({
        where: { disclosureDate: { gte: since } },
        orderBy: { disclosureDate: "desc" },
        take: 2_000,
        select: {
          ticker: true,
          transactionType: true,
          transactionDate: true,
          disclosureDate: true,
          amountMinCents: true,
          amountMaxCents: true,
          representative: true,
          politician: {
            select: {
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
      // Executive disclosures over the same window. We synthesize a
      // CongressRow-shape from these so buildLongShortInputs can treat them
      // identically: representative = official name, disclosureDate falls
      // back to transactionDate (executive feeds are near-real-time), no
      // politician/committees field so they don't contribute to committee
      // relevance scoring.
      db.executiveTrade.findMany({
        where: { transactionDate: { gte: since }, ticker: { not: null } },
        orderBy: { transactionDate: "desc" },
        take: 2_000,
        select: {
          ticker: true,
          transactionType: true,
          transactionDate: true,
          amountMinCents: true,
          amountMaxCents: true,
          official: { select: { name: true } },
        },
      }),
      getInsiderFlowRows(since),
      getAlternativeBreadth(since),
    ]);

    // Merge: synthesize CongressRow-shape from executive rows. Use
    // transactionDate for both transactionDate and disclosureDate fields
    // (executive feeds don't expose a separate disclosure date).
    const mergedCongressRows: CongressRow[] = [
      ...congressRows,
      ...executiveRows
        .filter((r): r is typeof r & { ticker: string } => r.ticker != null)
        .map<CongressRow>((r) => ({
          ticker: r.ticker,
          transactionType: r.transactionType,
          transactionDate: r.transactionDate,
          disclosureDate: r.transactionDate,
          amountMinCents: r.amountMinCents,
          amountMaxCents: r.amountMaxCents,
          representative: r.official.name,
          politician: null,
        })),
    ];

    if (!mergedCongressRows.length) return emptyLongShortAnalysis();

    const stockMap = new Map(stocks.map((stock) => [stock.ticker, stock]));
    const insiderNet = new Map<string, number>();

    for (const row of insiderRows) {
      addToMap(
        insiderNet,
        row.ticker,
        insiderFlowDollars(row),
      );
    }

    // Committee relevance only meaningfully applies to congressional rows
    // (executive officials don't sit on committees). Pass the un-merged
    // congressRows so the relevance map isn't diluted by executive entries
    // that have no committee data.
    const committeeRelevance = buildCommitteeRelevanceByTicker(congressRows, stockMap);
    const inputs = buildLongShortInputs(mergedCongressRows, stockMap, altSources, insiderNet, committeeRelevance);
    const latestData = mergedCongressRows.reduce<Date | null>(
      (max, row) =>
        max == null || row.disclosureDate > max ? row.disclosureDate : max,
      null,
    );
    return shapeLongShortAnalysis(
      scoreLongShortCandidates(inputs),
      "database",
      latestData ? latestData.toISOString().slice(0, 10) : null,
    );
  } catch (error) {
    console.error("[marketSignalData] failed to load long/short analysis:", error);
    return emptyLongShortAnalysis("database-error");
  }
}

export async function getDarkFlowAnalysis(): Promise<DarkFlowAnalysis> {
  "use cache";
  applyCacheLife("minutes");

  try {
    const since = daysAgo(LOOKBACK_DAYS);
    const [
      stocks,
      offExchangeRows,
      congressRows,
      executiveRows,
      insiderRows,
      govContractRows,
      lobbyingRows,
      thirteenFRows,
      wsbRows,
      twitterRows,
      wikipediaRows,
      betaRows,
    ] = await Promise.all([
      db.stock.findMany({
        select: { ticker: true, companyName: true, sector: true },
      }),
      getRecentOffExchangeRows(since),
      db.congressTrade.findMany({
        where: { disclosureDate: { gte: since } },
        take: 2_000,
        select: {
          ticker: true,
          transactionType: true,
          amountMinCents: true,
          amountMaxCents: true,
          politician: {
            select: {
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
      // Executive trades: same window, summed into the same per-ticker net
      // flow map below so dark-flow scoring sees the combined disclosed flow.
      // Executive disclosures don't have committee structure, so they don't
      // contribute to committeeRelevance — only to the net-flow signal.
      db.executiveTrade.findMany({
        where: { transactionDate: { gte: since }, ticker: { not: null } },
        take: 2_000,
        select: {
          ticker: true,
          transactionType: true,
          amountMinCents: true,
          amountMaxCents: true,
        },
      }),
      getInsiderFlowRows(since),
      getGovContractValueRows(since, 2_000),
      getLobbyingValueRows(since.getUTCFullYear(), 2_000),
      db.thirteenFHolding.findMany({
        where: { reportDate: { gte: since } },
        take: 2_000,
        select: { ticker: true, changeShares: true },
      }),
      db.wsbMention.findMany({
        where: { date: { gte: since } },
        take: 2_000,
        select: { ticker: true, mentions: true },
      }),
      db.twitterMention.findMany({
        where: { date: { gte: since } },
        take: 2_000,
        select: { ticker: true, mentions: true },
      }),
      db.wikipediaView.findMany({
        where: { date: { gte: since } },
        take: 2_000,
        select: { ticker: true, views: true },
      }),
      db.politicalBeta.findMany({
        take: 1_500,
        select: { ticker: true, beta: true, asOfDate: true },
        orderBy: { asOfDate: "desc" },
      }),
    ]);

    if (!offExchangeRows.length) return emptyDarkFlowAnalysis();

    const stockMap = new Map(stocks.map((stock) => [stock.ticker, stock]));
    const committeeRelevance = buildCommitteeRelevanceByTicker(congressRows, stockMap);
    const congressNetFlow = new Map<string, number>();
    const insiderNetValue = new Map<string, number>();
    const govContractValue = new Map<string, number>();
    const lobbyingValue = new Map<string, number>();
    const thirteenFNetShares = new Map<string, number>();
    const socialMentions = new Map<string, number>();
    const wikipediaViews = new Map<string, number>();
    const politicalBeta = new Map<string, number>();

    for (const row of congressRows) {
      addToMap(
        congressNetFlow,
        row.ticker,
        signedValue(row.transactionType, minimumDollars(row.amountMinCents, row.amountMaxCents)),
      );
    }
    // Executive disclosures sum into the same per-ticker net flow map. The
    // field name is "congressNetFlow" for historical reasons; semantically
    // it's now "disclosedNetFlow" — covers both congressional and executive
    // branch disclosed buying/selling. Renaming touches the dark-flow page
    // labels too; consider a follow-up rename if the field gets exposed
    // in more UI surfaces.
    for (const row of executiveRows) {
      if (!row.ticker) continue;
      addToMap(
        congressNetFlow,
        row.ticker,
        signedValue(row.transactionType, minimumDollars(row.amountMinCents, row.amountMaxCents)),
      );
    }
    for (const row of insiderRows) {
      addToMap(
        insiderNetValue,
        row.ticker,
        insiderFlowDollars(row),
      );
    }
    for (const row of govContractRows) {
      if (row.ticker) addToMap(govContractValue, row.ticker, centsTextToDollars(row.amountCents) ?? 0);
    }
    for (const row of lobbyingRows) {
      if (row.ticker) addToMap(lobbyingValue, row.ticker, centsTextToDollars(row.amountCents) ?? 0);
    }
    for (const row of thirteenFRows) addToMap(thirteenFNetShares, row.ticker, row.changeShares ?? 0);
    for (const row of wsbRows) addToMap(socialMentions, row.ticker, row.mentions);
    for (const row of twitterRows) addToMap(socialMentions, row.ticker, row.mentions);
    for (const row of wikipediaRows) addToMap(wikipediaViews, row.ticker, row.views);
    for (const row of betaRows) {
      if (!politicalBeta.has(row.ticker)) politicalBeta.set(row.ticker, row.beta);
    }

    const inputs: DarkFlowSignalInput[] = offExchangeRows.map((row) => {
      const stock = stockMap.get(row.ticker);

      return {
        ticker: row.ticker,
        companyName: stock?.companyName ?? null,
        sector: stock?.sector ?? null,
        latestDarkPoolPercent: row.latestDarkPoolPercent,
        averageDarkPoolPercent: row.averageDarkPoolPercent,
        latestShortVolumePercent: row.latestShortVolumePercent,
        averageShortVolumePercent: row.averageShortVolumePercent,
        latestTotalVolume: row.latestTotalVolume,
        averageTotalVolume: row.averageTotalVolume,
        offExchangeSampleSize: row.offExchangeSampleSize,
        congressNetFlow: congressNetFlow.get(row.ticker) ?? 0,
        insiderNetValue: insiderNetValue.get(row.ticker) ?? 0,
        govContractValue: govContractValue.get(row.ticker) ?? 0,
        lobbyingValue: lobbyingValue.get(row.ticker) ?? 0,
        thirteenFNetShares: thirteenFNetShares.get(row.ticker) ?? 0,
        socialMentions: socialMentions.get(row.ticker) ?? 0,
        wikipediaViews: wikipediaViews.get(row.ticker) ?? 0,
        politicalBeta: politicalBeta.get(row.ticker) ?? null,
        latestDate: row.latestDate,
        committeeRelevanceScore: committeeRelevance.get(row.ticker)?.score ?? 0,
        committeeRelevanceLabel: committeeRelevance.get(row.ticker)?.label ?? "Low",
      } satisfies DarkFlowSignalInput;
    });

    const latestOffExchangeDate = offExchangeRows.reduce<Date | null>(
      (max, row) => (max == null || row.latestDate > max ? row.latestDate : max),
      null,
    );
    const tickersWithBaseline = inputs.filter(
      (input) => input.offExchangeSampleSize >= MIN_OFF_EXCHANGE_BASELINE_SAMPLES,
    ).length;

    return shapeDarkFlowAnalysis(
      scoreDarkFlowCandidates(inputs),
      "database",
      latestOffExchangeDate,
      tickersWithBaseline,
      inputs.length,
    );
  } catch (error) {
    console.error("[marketSignalData] failed to load dark-flow analysis:", error);
    return emptyDarkFlowAnalysis("database-error");
  }
}

function buildLongShortInputs(
  congressRows: CongressRow[],
  stockMap: Map<string, StockRow>,
  altSources: Map<string, Set<string>>,
  insiderNet: Map<string, number>,
  committeeRelevance: Map<string, CommitteeRelevance>,
) {
  const buckets = new Map<string, TickerBucket>();

  for (const row of congressRows) {
    const bucket =
      buckets.get(row.ticker) ??
      {
        ticker: row.ticker,
        buyCount: 0,
        sellCount: 0,
        politicianNames: new Set<string>(),
        estimatedBuyVolume: 0,
        estimatedSellVolume: 0,
        disclosureLagDays: [],
        latestDisclosureDate: null,
        committeeRelevance: {
          score: 0,
          label: "Low",
          matches: [],
          reasons: [],
        },
      };
    const minimum = minimumDollars(row.amountMinCents, row.amountMaxCents);
    const action = classifyAction(row.transactionType);

    if (action === "buy") {
      bucket.buyCount += 1;
      bucket.estimatedBuyVolume += minimum;
    }
    if (action === "sell") {
      bucket.sellCount += 1;
      bucket.estimatedSellVolume += minimum;
    }
    bucket.politicianNames.add(row.representative);
    bucket.disclosureLagDays.push(daysBetween(row.transactionDate, row.disclosureDate));
    if (
      !bucket.latestDisclosureDate ||
      row.disclosureDate.getTime() > bucket.latestDisclosureDate.getTime()
    ) {
      bucket.latestDisclosureDate = row.disclosureDate;
    }
    const relevance = committeeRelevance.get(row.ticker);
    if (relevance && relevance.score > bucket.committeeRelevance.score) {
      bucket.committeeRelevance = relevance;
    }
    buckets.set(row.ticker, bucket);
  }

  return [...buckets.values()].map((bucket) => {
    const stock = stockMap.get(bucket.ticker);

    return {
      ticker: bucket.ticker,
      companyName: stock?.companyName ?? null,
      sector: stock?.sector ?? null,
      buyCount: bucket.buyCount,
      sellCount: bucket.sellCount,
      politicianCount: bucket.politicianNames.size,
      estimatedBuyVolume: bucket.estimatedBuyVolume,
      estimatedSellVolume: bucket.estimatedSellVolume,
      averageDisclosureLagDays: Math.round(average(bucket.disclosureLagDays) ?? 0),
      latestDisclosureDate: bucket.latestDisclosureDate,
      altDataBreadth: altSources.get(bucket.ticker)?.size ?? 0,
      insiderNetValue: insiderNet.get(bucket.ticker) ?? 0,
      committeeRelevanceScore: bucket.committeeRelevance.score,
      committeeRelevanceLabel: bucket.committeeRelevance.label,
    } satisfies LongShortSignalInput;
  });
}

function buildCommitteeRelevanceByTicker(
  congressRows: Array<{ ticker: string; politician?: CongressRow["politician"] }>,
  stockMap: Map<string, StockRow>,
) {
  const best = new Map<string, CommitteeRelevance>();

  for (const row of congressRows) {
    const stock = stockMap.get(row.ticker);
    const relevance = scoreCommitteeRelevance({
      ticker: row.ticker,
      sector: stock?.sector,
      industry: null,
      committees: committeeContexts(row.politician),
    });
    const current = best.get(row.ticker);

    if (!current || relevance.score > current.score) {
      best.set(row.ticker, relevance);
    }
  }

  return best;
}

function committeeContexts(politician: CongressRow["politician"]): CommitteeContext[] {
  return (
    politician?.committees.map((assignment) => ({
      name: assignment.committee.name,
      role: assignment.role,
      isChair: assignment.isChair,
      isRanking: assignment.isRanking,
    })) ?? []
  );
}

export function buildInsiderFlowRowsSql() {
  return `
    WITH insider_flow AS (
      SELECT
        "ticker",
        CASE
          WHEN LOWER("transactionType") LIKE '%purchase%'
            OR LOWER("transactionType") LIKE '%buy%'
            OR LOWER("transactionType") LIKE 'p%'
            THEN COALESCE("totalValueCents", "shares" * "pricePerShareCents", 0)
          WHEN LOWER("transactionType") LIKE '%sale%'
            OR LOWER("transactionType") LIKE '%sell%'
            OR LOWER("transactionType") LIKE 's%'
            THEN -COALESCE("totalValueCents", "shares" * "pricePerShareCents", 0)
          ELSE 0
        END AS "signedValueCents"
      FROM "InsiderTrade"
      WHERE COALESCE("filingDate", "transactionDate") >= ?
    )
    SELECT
      "ticker",
      CAST(SUM("signedValueCents") AS TEXT) AS "netValueCents"
    FROM insider_flow
    WHERE "ticker" IS NOT NULL
    GROUP BY "ticker"
  `;
}

export function buildRecentOffExchangeRowsSql(dateLimit = OFF_EXCHANGE_BASELINE_DATES) {
  return `
    WITH recent_dates AS (
      SELECT DATE("date") AS "snapshotDate"
      FROM "OffExchangeActivity"
      WHERE "date" >= ?
      GROUP BY DATE("date")
      ORDER BY DATE("date") DESC
      LIMIT ${dateLimit}
    ),
    per_day AS (
      SELECT
        "ticker",
        DATE("date") AS "snapshotDate",
        MAX("date") AS "latestDate",
        AVG("shortVolume") AS "shortVolume",
        AVG("totalVolume") AS "totalVolume",
        AVG(
          COALESCE(
            "shortVolumePercent",
            CASE
              WHEN "totalVolume" > 0 THEN ("shortVolume" * 100.0 / "totalVolume")
              ELSE NULL
            END
          )
        ) AS "shortVolumePercent",
        AVG("darkPoolPercent") AS "darkPoolPercent"
      FROM "OffExchangeActivity"
      WHERE "date" >= ?
        AND DATE("date") IN (SELECT "snapshotDate" FROM recent_dates)
      GROUP BY "ticker", DATE("date")
    ),
    latest_day AS (
      SELECT
        "ticker",
        MAX("snapshotDate") AS "latestSnapshotDate"
      FROM per_day
      GROUP BY "ticker"
    )
    SELECT
      p."ticker",
      MAX(CASE WHEN p."snapshotDate" = l."latestSnapshotDate" THEN p."latestDate" END) AS "latestDate",
      MAX(CASE WHEN p."snapshotDate" = l."latestSnapshotDate" THEN p."shortVolume" END) AS "latestShortVolume",
      MAX(CASE WHEN p."snapshotDate" = l."latestSnapshotDate" THEN p."totalVolume" END) AS "latestTotalVolume",
      MAX(CASE WHEN p."snapshotDate" = l."latestSnapshotDate" THEN p."shortVolumePercent" END) AS "latestShortVolumePercent",
      MAX(CASE WHEN p."snapshotDate" = l."latestSnapshotDate" THEN p."darkPoolPercent" END) AS "latestDarkPoolPercent",
      AVG(p."shortVolumePercent") AS "averageShortVolumePercent",
      AVG(p."darkPoolPercent") AS "averageDarkPoolPercent",
      AVG(p."totalVolume") AS "averageTotalVolume",
      COUNT(*) AS "offExchangeSampleSize"
    FROM per_day p
    INNER JOIN latest_day l ON l."ticker" = p."ticker"
    GROUP BY p."ticker"
    ORDER BY "latestDate" DESC, p."ticker" ASC
  `;
}

async function getInsiderFlowRows(since: Date): Promise<InsiderFlowRow[]> {
  return db.$queryRawUnsafe<InsiderFlowRow[]>(
    buildInsiderFlowRowsSql(),
    since.toISOString(),
  );
}

async function getRecentOffExchangeRows(since: Date) {
  const rows = await db.$queryRawUnsafe<OffExchangeRow[]>(
    buildRecentOffExchangeRowsSql(),
    since.toISOString(),
    since.toISOString(),
  );

  return rows.map((row) => ({
    ...row,
    latestDate: normalizeDate(row.latestDate),
    offExchangeSampleSize: Number(row.offExchangeSampleSize) || 0,
  }));
}

async function getGovContractValueRows(since: Date, take: number): Promise<ValueByTickerRow[]> {
  return db.$queryRaw<ValueByTickerRow[]>`
    SELECT
      "ticker",
      CAST("amountCents" AS TEXT) AS "amountCents"
    FROM "GovContract"
    WHERE "awardedAt" >= ${since}
    LIMIT ${take}
  `;
}

async function getLobbyingValueRows(filingYear: number, take: number): Promise<ValueByTickerRow[]> {
  return db.$queryRaw<ValueByTickerRow[]>`
    SELECT
      "ticker",
      CAST("amountCents" AS TEXT) AS "amountCents"
    FROM "LobbyingDisclosure"
    WHERE "filingYear" >= ${filingYear}
    LIMIT ${take}
  `;
}

async function getAlternativeBreadth(since: Date) {
  const [
    insiderRows,
    lobbyingRows,
    govContractRows,
    patentRows,
    offExchangeRows,
    thirteenFRows,
    wsbRows,
    twitterRows,
    wikipediaRows,
    betaRows,
  ] = await Promise.all([
    db.insiderTrade.findMany({
      where: { transactionDate: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.lobbyingDisclosure.findMany({
      where: { filingYear: { gte: since.getUTCFullYear() } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.govContract.findMany({
      where: { awardedAt: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.patent.findMany({
      where: { filedAt: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.offExchangeActivity.findMany({
      where: { date: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.thirteenFHolding.findMany({
      where: { reportDate: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.wsbMention.findMany({
      where: { date: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.twitterMention.findMany({
      where: { date: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.wikipediaView.findMany({
      where: { date: { gte: since } },
      take: 2_000,
      select: { ticker: true },
    }),
    db.politicalBeta.findMany({
      take: 2_000,
      select: { ticker: true },
    }),
  ]);

  const breadth = new Map<string, Set<string>>();
  const add = (ticker: string | null, source: string) => {
    if (!ticker) return;
    const sources = breadth.get(ticker) ?? new Set<string>();
    sources.add(source);
    breadth.set(ticker, sources);
  };

  insiderRows.forEach((row) => add(row.ticker, "insider"));
  lobbyingRows.forEach((row) => add(row.ticker, "lobbying"));
  govContractRows.forEach((row) => add(row.ticker, "contracts"));
  patentRows.forEach((row) => add(row.ticker, "patents"));
  offExchangeRows.forEach((row) => add(row.ticker, "off-exchange"));
  thirteenFRows.forEach((row) => add(row.ticker, "13f"));
  wsbRows.forEach((row) => add(row.ticker, "wsb"));
  twitterRows.forEach((row) => add(row.ticker, "twitter"));
  wikipediaRows.forEach((row) => add(row.ticker, "wikipedia"));
  betaRows.forEach((row) => add(row.ticker, "political-beta"));

  return breadth;
}

function emptyLongShortAnalysis(source: LongShortAnalysis["source"] = "database"): LongShortAnalysis {
  const errored = source === "database-error";

  return {
    generatedAt: new Date(),
    source,
    longs: [],
    shorts: [],
    all: [],
    latestDataDate: null,
    metrics: [
      { label: "Net buy rows", value: "0", tone: "neutral" },
      { label: "Net sell rows", value: "0", tone: "neutral" },
      { label: "Net disclosed flow", value: "$0", tone: "neutral" },
      { label: "Source", value: errored ? "SQL error" : "SQL", tone: errored ? "negative" : "accent" },
    ],
  };
}

function emptyDarkFlowAnalysis(source: DarkFlowAnalysis["source"] = "database"): DarkFlowAnalysis {
  const errored = source === "database-error";

  return {
    generatedAt: new Date(),
    source,
    stealth: [],
    crowded: [],
    all: [],
    latestOffExchangeDate: null,
    tickersWithBaseline: 0,
    totalTickersWithOffExchange: 0,
    metrics: [
      { label: "Stealth setups", value: "0", tone: "neutral" },
      { label: "Fade setups", value: "0", tone: "neutral" },
      { label: "Max dark excess", value: "—", tone: "neutral" },
      { label: "Source", value: errored ? "SQL error" : "SQL", tone: errored ? "negative" : "accent" },
    ],
  };
}

function shapeLongShortAnalysis(
  all: LongShortCandidate[],
  source: LongShortAnalysis["source"],
  latestDataDate: string | null,
): LongShortAnalysis {
  const longs = all.filter((candidate) => candidate.netFlow > 0).slice(0, 10);
  const shorts = all.filter((candidate) => candidate.netFlow < 0).slice(0, 10);
  const netExposure = all.reduce((sum, row) => sum + row.netFlow, 0);

  return {
    generatedAt: new Date(),
    source,
    longs,
    shorts,
    all: all.slice(0, 18),
    latestDataDate,
    metrics: [
      { label: "Net buy rows", value: String(longs.length), tone: "positive" },
      { label: "Net sell rows", value: String(shorts.length), tone: "negative" },
      { label: "Net disclosed flow", value: formatSignedMoney(netExposure), tone: netExposure >= 0 ? "positive" : "negative" },
      { label: "Source", value: "SQL", tone: "accent" },
    ],
  };
}

function shapeDarkFlowAnalysis(
  all: DarkFlowCandidate[],
  source: DarkFlowAnalysis["source"],
  latestOffExchangeDate: Date | null,
  tickersWithBaseline: number,
  totalTickersWithOffExchange: number,
): DarkFlowAnalysis {
  const stealth = all
    .filter((candidate) => candidate.archetype === "Stealth Accumulation" || candidate.stance === "Long Watch")
    .slice(0, 10);
  const crowded = all
    .filter((candidate) => candidate.archetype === "Crowded Fade" || candidate.stance === "Short Watch")
    .slice(0, 10);
  const maxDarkExcess = all
    .map((candidate) => candidate.darkPoolExcess)
    .filter((value): value is number => value != null)
    .reduce((max, value) => Math.max(max, value), 0);
  const maxDarkExcessLabel =
    tickersWithBaseline === 0 ? "—" : `${maxDarkExcess.toFixed(1)} pts`;

  return {
    generatedAt: new Date(),
    source,
    stealth,
    crowded,
    all: all.slice(0, 18),
    latestOffExchangeDate,
    tickersWithBaseline,
    totalTickersWithOffExchange,
    metrics: [
      { label: "Stealth setups", value: String(stealth.length), tone: "positive" },
      { label: "Fade setups", value: String(crowded.length), tone: "negative" },
      { label: "Max dark excess", value: maxDarkExcessLabel, tone: "accent" },
      { label: "Source", value: "SQL", tone: "accent" },
    ],
  };
}

function signedValue(type: string, value: number) {
  const action = classifyAction(type);
  if (action === "buy") return value;
  if (action === "sell") return -value;
  return 0;
}

function centsTextToDollars(value: string | null) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : null;
}

function insiderFlowDollars(row: InsiderFlowRow) {
  return centsTextToDollars(row.netValueCents) ?? 0;
}

function normalizeDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return parseSqliteUtc(value) ?? new Date(value);
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatSignedMoney(value: number) {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}
