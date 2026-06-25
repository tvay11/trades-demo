import { DATASETS } from "@/lib/ingest/datasets";
import { runAll, type RunAllPerDatasetResult } from "@/lib/ingest/engine";
import {
  readBackfillJob,
  writeBackfillJob,
  appendIngestRun,
} from "@/lib/ingest/jobs";
import { syncPoliticianStates } from "@/lib/ingest/politicians";
import { syncStockUniverse, type SyncStockUniverseSummary } from "@/lib/stock-universe";
import { runMarketCapBackfill, type MarketCapBackfillSummary } from "@/lib/marketcap";

export type RunDailyOptions = {
  apiKey: string;
  baseUrl?: string;
  ratePerMinute?: number;
  totalBudgetMs: number;
  perDatasetBudgetMs: number;
  datasetNames: string[] | null;
  marketCapLimit?: number;
  // Hook for the CLI to log progress as each dataset finishes; cron path
  // doesn't use it.
  onDatasetResult?: (r: RunAllPerDatasetResult) => void;
};

export type RunDailyResult = {
  startedAt: Date;
  finishedAt: Date;
  results: Array<RunAllPerDatasetResult>;
  failed: Array<RunAllPerDatasetResult>;
  politicianStatesError: string | null;
  stockUniverse: SyncStockUniverseSummary | null;
  stockUniverseError: string | null;
  marketCap: MarketCapBackfillSummary | null;
  marketCapError: string | null;
};

/**
 * The canonical daily pipeline. Runs Quiver datasets, syncs politician states,
 * syncs the stock universe (so new tickers are in /stocks before we fetch
 * caps), then refreshes market caps. Used by both `scripts/daily.ts` and the
 * Vercel cron route so the two entry points cannot drift.
 */
export async function runDaily(opts: RunDailyOptions): Promise<RunDailyResult> {
  const baseUrl = opts.baseUrl ?? "https://api.quiverquant.com/beta";
  const ratePerMinute = opts.ratePerMinute ?? 50;

  const specs = filterDatasets(opts.datasetNames);
  const startedAt = new Date();
  const results = await runAll({
    specs,
    mode: "live",
    readJob: readBackfillJob,
    writeJob: writeBackfillJob,
    fetcher: fetch,
    apiKey: opts.apiKey,
    baseUrl,
    ratePerMinute,
    totalBudgetMs: opts.totalBudgetMs,
    perDatasetBudgetMs: opts.perDatasetBudgetMs,
  });
  const finishedAt = new Date();

  for (const r of results) {
    await appendIngestRun({
      dataset: r.dataset,
      mode: "live",
      startedAt,
      finishedAt,
      rowsFetched: r.rowsFetched,
      rowsInserted: r.rowsInserted,
      error: r.error,
    });
    opts.onDatasetResult?.(r);
  }

  const runAuxiliarySyncs = opts.datasetNames === null;
  let politicianStatesError: string | null = null;
  if (runAuxiliarySyncs) {
    try {
      await syncPoliticianStates();
    } catch (e) {
      politicianStatesError = (e as Error).message;
    }
  }

  let stockUniverse: SyncStockUniverseSummary | null = null;
  let stockUniverseError: string | null = null;
  if (runAuxiliarySyncs) {
    try {
      stockUniverse = await syncStockUniverse();
    } catch (e) {
      stockUniverseError = (e as Error).message;
    }
  }

  let marketCap: MarketCapBackfillSummary | null = null;
  let marketCapError: string | null = null;
  if ((opts.marketCapLimit ?? 0) > 0) {
    try {
      marketCap = await runMarketCapBackfill({ limit: opts.marketCapLimit });
    } catch (e) {
      marketCapError = (e as Error).message;
    }
  } else {
    marketCap = { total: 0, candidates: 0, ok: 0, skipped: 0, fail: 0 };
  }

  const failed = results.filter((r) => r.error);

  return {
    startedAt,
    finishedAt,
    results,
    failed,
    politicianStatesError,
    stockUniverse,
    stockUniverseError,
    marketCap,
    marketCapError,
  };
}

function filterDatasets(names: string[] | null) {
  if (names === null) return DATASETS;
  const requested = new Set(names.map((n) => n.toLowerCase()));
  const specs = DATASETS.filter((s) => requested.has(s.name.toLowerCase()));
  const found = new Set(specs.map((s) => s.name.toLowerCase()));
  const missing = names.filter((n) => !found.has(n.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(
      `Unknown dataset(s): ${missing.join(", ")}. Available: ${DATASETS.map((s) => s.name).join(", ")}`,
    );
  }
  return specs;
}
