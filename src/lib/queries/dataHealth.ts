import { DATASET_DEFINITIONS } from "@/lib/datasets/registry";
import { getDatasetSummaries } from "@/lib/datasets/queries";
import { db } from "@/lib/db";

export type DataHealthTone = "neutral" | "good" | "warn" | "bad";
export type IngestJobHealth = "ok" | "stale" | "error";

export type DataHealthRow = {
  label: string;
  value: string;
  tone: DataHealthTone;
};

export type DataHealthCheck = DataHealthRow & {
  detail: string;
};

export type PriceCoverageHealth = {
  congressTickerCount: number;
  priceTickerCount: number;
  coveredTickerCount: number;
  missingTickerCount: number;
  coveragePercent: number;
  missingTickers: string[];
  tone: DataHealthTone;
};

export type CommitteeSyncHealth = {
  committeeRows: number;
  assignmentRows: number;
  politiciansWithCommittees: number;
  politiciansWithBioguide: number;
  assignmentCoveragePercent: number;
  bioguideCoveragePercent: number;
  latestAssignmentSync: Date | null;
  tone: DataHealthTone;
};

export type LatestMarketDataIngestHealth = {
  label: string;
  value: string;
  dataset: string | null;
  mode: string | null;
  rowsFetched: number;
  rowsInserted: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  tone: DataHealthTone;
};

export type UnmatchedPoliticianHealth = {
  name: string;
  party: string | null;
  state: string | null;
  chamber: string | null;
  tradeCount: number;
};

export type DataHealthResult = {
  generatedAt: Date;
  tableCounts: Array<{ label: string; tableName: string; rowCount: number | null }>;
  ingestJobs: Array<{
    dataset: string;
    mode: string;
    status: string;
    cursor: string | null;
    totalIngested: number;
    lastRunAt: Date | null;
    lastError: string | null;
    stale: boolean;
    health: IngestJobHealth;
    healthLabel: string;
    healthTone: DataHealthTone;
  }>;
  metrics: DataHealthRow[];
  coreChecks: DataHealthCheck[];
  priceCoverage: PriceCoverageHealth;
  committeeSync: CommitteeSyncHealth;
  latestMarketDataIngest: LatestMarketDataIngestHealth;
  unmatchedPoliticians: UnmatchedPoliticianHealth[];
  readWarnings: string[];
  fallbackWarnings: string[];
};

export async function getDataHealth(): Promise<DataHealthResult> {
  const sources = await settleDataHealthSources({
    summaries: getDatasetSummaries(),
    jobs: db.backfillJob.findMany({ orderBy: { dataset: "asc" } }),
    congressTickers: db.congressTrade
      .findMany({ select: { ticker: true }, distinct: ["ticker"] })
      .then((rows) => rows.map((row) => row.ticker)),
    priceTickers: db.tickerPriceCache
      .findMany({ select: { ticker: true }, distinct: ["ticker"] })
      .then((rows) => rows.map((row) => row.ticker)),
    unmatchedPoliticians: db.politician
      .findMany({
        where: { bioguideId: null },
        select: {
          name: true,
          party: true,
          state: true,
          chamber: true,
          _count: { select: { trades: true } },
        },
        orderBy: { name: "asc" },
        take: 25,
      })
      .then((rows) =>
        rows.map((politician) => ({
          name: politician.name,
          party: politician.party,
          state: politician.state,
          chamber: politician.chamber,
          tradeCount: politician._count.trades,
        })),
      ),
    latestIngestRun: db.ingestRun.findFirst({ orderBy: { startedAt: "desc" } }),
    committeeRows: db.committee.count(),
    assignmentRows: db.politicianCommitteeAssignment.count(),
    politiciansWithCommittees: db.politician.count({ where: { committees: { some: {} } } }),
    politiciansWithBioguide: db.politician.count({ where: { bioguideId: { not: null } } }),
    latestAssignmentSync: db.politicianCommitteeAssignment
      .findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      })
      .then((row) => row?.updatedAt ?? null),
  });

  return shapeDataHealth({
    now: new Date(),
    summaries: sources.summaries,
    jobs: sources.jobs,
    congressTickers: sources.congressTickers,
    priceTickers: sources.priceTickers,
    unmatchedPoliticians: sources.unmatchedPoliticians,
    latestIngestRun: sources.latestIngestRun,
    committeeCounts: {
      committees: sources.committeeRows,
      assignments: sources.assignmentRows,
      politiciansWithCommittees: sources.politiciansWithCommittees,
      politiciansWithBioguide: sources.politiciansWithBioguide,
      latestAssignmentSync: sources.latestAssignmentSync,
    },
    readWarnings: sources.readWarnings,
  });
}

type SummaryLike = {
  slug: string;
  tableName: string;
  label: string;
  rowCount: number | null;
};

type BackfillJobLike = {
  dataset: string;
  mode: string;
  status: string;
  cursor: string | null;
  totalIngested: number;
  lastRunAt: Date | null;
  lastError: string | null;
};

type IngestRunLike = {
  dataset: string;
  mode: string;
  startedAt: Date;
  finishedAt: Date | null;
  rowsFetched: number;
  rowsInserted: number;
  error: string | null;
};

type DataHealthSourcePromises = {
  summaries: Promise<SummaryLike[]>;
  jobs: Promise<BackfillJobLike[]>;
  congressTickers: Promise<string[]>;
  priceTickers: Promise<string[]>;
  unmatchedPoliticians: Promise<UnmatchedPoliticianHealth[]>;
  latestIngestRun: Promise<IngestRunLike | null>;
  committeeRows: Promise<number>;
  assignmentRows: Promise<number>;
  politiciansWithCommittees: Promise<number>;
  politiciansWithBioguide: Promise<number>;
  latestAssignmentSync: Promise<Date | null>;
};

type SettledDataHealthSources = {
  summaries: SummaryLike[];
  jobs: BackfillJobLike[];
  congressTickers: string[];
  priceTickers: string[];
  unmatchedPoliticians: UnmatchedPoliticianHealth[];
  latestIngestRun: IngestRunLike | null;
  committeeRows: number;
  assignmentRows: number;
  politiciansWithCommittees: number;
  politiciansWithBioguide: number;
  latestAssignmentSync: Date | null;
  readWarnings: string[];
};

export async function settleDataHealthSources(
  sources: DataHealthSourcePromises,
): Promise<SettledDataHealthSources> {
  const results = await Promise.all([
    settleRead("Dataset summaries", sources.summaries, []),
    settleRead("Ingest jobs", sources.jobs, []),
    settleRead("Congress ticker coverage", sources.congressTickers, []),
    settleRead("Price ticker coverage", sources.priceTickers, []),
    settleRead("Unmatched politicians", sources.unmatchedPoliticians, []),
    settleRead("Latest ingest run", sources.latestIngestRun, null),
    settleRead("Committee row count", sources.committeeRows, 0),
    settleRead("Committee assignment count", sources.assignmentRows, 0),
    settleRead("Politicians with committees", sources.politiciansWithCommittees, 0),
    settleRead("Politicians with bioguide IDs", sources.politiciansWithBioguide, 0),
    settleRead("Latest committee assignment sync", sources.latestAssignmentSync, null),
  ]);

  const [
    summaries,
    jobs,
    congressTickers,
    priceTickers,
    unmatchedPoliticians,
    latestIngestRun,
    committeeRows,
    assignmentRows,
    politiciansWithCommittees,
    politiciansWithBioguide,
    latestAssignmentSync,
  ] = results;

  return {
    summaries: summaries.value,
    jobs: jobs.value,
    congressTickers: congressTickers.value,
    priceTickers: priceTickers.value,
    unmatchedPoliticians: unmatchedPoliticians.value,
    latestIngestRun: latestIngestRun.value,
    committeeRows: committeeRows.value,
    assignmentRows: assignmentRows.value,
    politiciansWithCommittees: politiciansWithCommittees.value,
    politiciansWithBioguide: politiciansWithBioguide.value,
    latestAssignmentSync: latestAssignmentSync.value,
    readWarnings: results.flatMap((result) => (result.warning ? [result.warning] : [])),
  };
}

export function shapeDataHealth({
  now,
  summaries,
  jobs,
  congressTickers,
  priceTickers,
  unmatchedPoliticians,
  latestIngestRun,
  committeeCounts,
  readWarnings = [],
}: {
  now: Date;
  summaries: SummaryLike[];
  jobs: BackfillJobLike[];
  congressTickers: string[];
  priceTickers: string[];
  unmatchedPoliticians: UnmatchedPoliticianHealth[];
  latestIngestRun: IngestRunLike | null;
  committeeCounts: {
    committees: number;
    assignments: number;
    politiciansWithCommittees: number;
    politiciansWithBioguide: number;
    latestAssignmentSync: Date | null;
  };
  readWarnings?: string[];
}): DataHealthResult {
  const congressTickerSet = new Set(congressTickers.map((ticker) => ticker.toUpperCase()));
  const priceTickerSet = new Set(priceTickers.map((ticker) => ticker.toUpperCase()));
  const missingPriceTickers = [...congressTickerSet]
    .filter((ticker) => !priceTickerSet.has(ticker))
    .sort();
  const coveredTickerCount = [...congressTickerSet].filter((ticker) => priceTickerSet.has(ticker)).length;
  const staleJobs = jobs.filter((job) => isStale(job.lastRunAt, now));
  const erroredJobs = jobs.filter((job) => job.lastError);
  const congressRows = countFor(summaries, "CongressTrade");
  const politicianRows = countFor(summaries, "Politician");
  const stockRows = countFor(summaries, "Stock");
  const priceRows = countFor(summaries, "TickerPriceCache");
  const priceCoverage: PriceCoverageHealth = {
    congressTickerCount: congressTickerSet.size,
    priceTickerCount: priceTickerSet.size,
    coveredTickerCount,
    missingTickerCount: missingPriceTickers.length,
    coveragePercent: safePercent(coveredTickerCount, congressTickerSet.size),
    missingTickers: missingPriceTickers.slice(0, 24),
    tone:
      congressTickerSet.size === 0
        ? "warn"
        : missingPriceTickers.length === 0
          ? "good"
          : "warn",
  };
  const committeeSync: CommitteeSyncHealth = {
    committeeRows: committeeCounts.committees,
    assignmentRows: committeeCounts.assignments,
    politiciansWithCommittees: committeeCounts.politiciansWithCommittees,
    politiciansWithBioguide: committeeCounts.politiciansWithBioguide,
    assignmentCoveragePercent: safePercent(committeeCounts.politiciansWithCommittees, politicianRows),
    bioguideCoveragePercent: safePercent(committeeCounts.politiciansWithBioguide, politicianRows),
    latestAssignmentSync: committeeCounts.latestAssignmentSync,
    tone:
      committeeCounts.committees > 0 &&
      committeeCounts.assignments > 0 &&
      committeeCounts.politiciansWithCommittees > 0
        ? "good"
        : "warn",
  };
  const latestMarketDataIngest = shapeLatestIngest(latestIngestRun, now);
  const coreChecks = [
    coreCheck("CongressTrade rows", congressRows, "Required for dashboard, trades, analysis, and search."),
    coreCheck("Politician rows", politicianRows, "Required for politician pages and committee matching."),
    coreCheck("Stock rows", stockRows, "Required for company names, sectors, and ticker facts."),
    coreCheck("TickerPriceCache rows", priceRows, "Required for transaction/disclosure price and return windows."),
  ];

  return {
    generatedAt: now,
    tableCounts: DATASET_DEFINITIONS.map((definition) => ({
      label: definition.label,
      tableName: definition.tableName,
      rowCount: summaries.find((summary) => summary.slug === definition.slug)?.rowCount ?? null,
    })),
    ingestJobs: jobs.map((job) => {
      const stale = isStale(job.lastRunAt, now);
      const health = classifyIngestJobHealth(job, stale);

      return {
        dataset: job.dataset,
        mode: job.mode,
        status: job.status,
        cursor: job.cursor,
        totalIngested: job.totalIngested,
        lastRunAt: job.lastRunAt,
        lastError: job.lastError,
        stale,
        ...health,
      };
    }),
    metrics: [
      {
        label: "Congress rows",
        value: congressRows.toLocaleString(),
        tone: congressRows > 0 ? "good" : "bad",
      },
      {
        label: "Politicians",
        value: politicianRows.toLocaleString(),
        tone: politicianRows > 0 ? "good" : "bad",
      },
      {
        label: "Stock profiles",
        value: stockRows.toLocaleString(),
        tone: stockRows > 0 ? "good" : "warn",
      },
      {
        label: "Price coverage",
        value: `${priceCoverage.coveragePercent.toFixed(1)}%`,
        tone: priceCoverage.tone,
      },
      {
        label: "Committees",
        value: committeeCounts.assignments.toLocaleString(),
        tone: committeeSync.tone,
      },
      {
        label: "Unmatched pols",
        value: unmatchedPoliticians.length.toLocaleString(),
        tone: unmatchedPoliticians.length === 0 ? "good" : "warn",
      },
      {
        label: "Stale ingest jobs",
        value: staleJobs.length.toLocaleString(),
        tone: staleJobs.length === 0 ? "good" : "warn",
      },
      {
        label: "Errored jobs",
        value: erroredJobs.length.toLocaleString(),
        tone: erroredJobs.length === 0 ? "good" : "bad",
      },
      {
        label: "Latest ingest",
        value: latestMarketDataIngest.value,
        tone: latestMarketDataIngest.tone,
      },
    ],
    coreChecks,
    priceCoverage,
    committeeSync,
    latestMarketDataIngest,
    unmatchedPoliticians,
    readWarnings,
    fallbackWarnings: buildFallbackWarnings({
      congressRows,
      politicianRows,
      stockRows,
      priceRows,
      missingPriceTickers: missingPriceTickers.length,
      committeeAssignments: committeeCounts.assignments,
    }),
  };
}

async function settleRead<T>(label: string, promise: Promise<T>, fallback: T) {
  try {
    return { value: await promise, warning: null as string | null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown read failure";
    return { value: fallback, warning: `${label}: ${detail}` };
  }
}

function countFor(summaries: SummaryLike[], tableName: string) {
  return summaries.find((summary) => summary.tableName === tableName)?.rowCount ?? 0;
}

function coreCheck(label: string, count: number, detail: string): DataHealthCheck {
  return {
    label,
    value: count.toLocaleString(),
    tone: count > 0 ? "good" : label === "TickerPriceCache rows" || label === "Stock rows" ? "warn" : "bad",
    detail,
  };
}

function shapeLatestIngest(run: IngestRunLike | null, now: Date): LatestMarketDataIngestHealth {
  if (!run) {
    return {
      label: "Latest external ingest",
      value: "Never",
      dataset: null,
      mode: null,
      rowsFetched: 0,
      rowsInserted: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
      tone: "warn",
    };
  }

  return {
    label: "Latest external ingest",
    value: ageText(run.startedAt, now),
    dataset: run.dataset,
    mode: run.mode,
    rowsFetched: run.rowsFetched,
    rowsInserted: run.rowsInserted,
    error: run.error,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    tone: run.error ? "bad" : run.finishedAt ? "good" : "warn",
  };
}

function isStale(lastRunAt: Date | null, now: Date) {
  if (!lastRunAt) return true;
  return now.getTime() - lastRunAt.getTime() > 24 * 60 * 60 * 1_000;
}

function classifyIngestJobHealth(job: BackfillJobLike, stale: boolean) {
  if (job.lastError) {
    return {
      health: "error" as const,
      healthLabel: "ERROR",
      healthTone: "bad" as const,
    };
  }

  if (stale) {
    return {
      health: "stale" as const,
      healthLabel: "STALE",
      healthTone: "warn" as const,
    };
  }

  return {
    health: "ok" as const,
    healthLabel: "OK",
    healthTone: "good" as const,
  };
}

function ageText(value: Date, now: Date) {
  const hours = Math.max(0, Math.round((now.getTime() - value.getTime()) / 3_600_000));
  if (hours < 1) return "Under 1h";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function safePercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1_000) / 10;
}

function buildFallbackWarnings({
  congressRows,
  politicianRows,
  stockRows,
  priceRows,
  missingPriceTickers,
  committeeAssignments,
}: {
  congressRows: number;
  politicianRows: number;
  stockRows: number;
  priceRows: number;
  missingPriceTickers: number;
  committeeAssignments: number;
}) {
  const warnings: string[] = [];

  if (congressRows === 0) {
    warnings.push("Dashboard, trades, politicians, analysis, and command search will show empty SQL states because CongressTrade is empty.");
  }
  if (politicianRows === 0) {
    warnings.push("Politician pages and committee sync cannot be trusted until Politician rows exist.");
  }
  if (stockRows === 0) {
    warnings.push("Ticker pages will infer company names from disclosures because Stock is empty.");
  }
  if (priceRows === 0) {
    warnings.push("Disclosure-date return windows are unavailable because TickerPriceCache is empty.");
  }
  if (missingPriceTickers > 0) {
    warnings.push(`${missingPriceTickers.toLocaleString()} congressional ticker${missingPriceTickers === 1 ? " is" : "s are"} missing price-cache coverage for disclosure return windows.`);
  }
  if (committeeAssignments === 0) {
    warnings.push("Committee context is unavailable until committee assignments are synced.");
  }

  return warnings;
}
