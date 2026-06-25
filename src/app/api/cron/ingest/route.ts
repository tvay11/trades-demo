import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDaily } from "@/lib/ingest/runDaily";
import {
  dailyCutoffIso,
  readNonNegativeInt,
  readPositiveInt,
  resolveDailyDatasetNames,
} from "@/lib/ingest/dailyConfig";

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") {
    return NextResponse.json({ ok: true, message: "Ingestion skipped in Demo Mode." });
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${expected}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.QUIVER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "QUIVER_API_KEY not set" }, { status: 500 });

  const totalBudgetMs = readPositiveInt(process.env.DAILY_TOTAL_BUDGET_MS, 55_000);
  const perDatasetBudgetMs = readPositiveInt(process.env.DAILY_PER_DATASET_BUDGET_MS, 8_000);
  const lookbackDays = readPositiveInt(process.env.DAILY_LOOKBACK_DAYS, 3);
  const marketCapLimit = readNonNegativeInt(process.env.DAILY_MARKETCAP_LIMIT, 0);
  const datasetNames = resolveDailyDatasetNames([], process.env.DAILY_DATASETS);
  const previousCutoff = process.env.INGEST_MIN_DATE;
  process.env.INGEST_MIN_DATE =
    previousCutoff?.trim() || dailyCutoffIso(new Date(), lookbackDays);

  try {
    const summary = await runDaily({
      apiKey,
      totalBudgetMs,
      perDatasetBudgetMs,
      datasetNames,
      marketCapLimit,
    });

    return NextResponse.json({
      ok: true,
      cutoff: process.env.INGEST_MIN_DATE,
      datasets: datasetNames === null ? "all" : datasetNames,
      results: summary.results,
      politicianStatesError: summary.politicianStatesError,
      stockUniverse: summary.stockUniverse,
      stockUniverseError: summary.stockUniverseError,
      marketCap: summary.marketCap,
      marketCapError: summary.marketCapError,
    });
  } finally {
    if (previousCutoff == null) {
      delete process.env.INGEST_MIN_DATE;
    } else {
      process.env.INGEST_MIN_DATE = previousCutoff;
    }
  }
}
