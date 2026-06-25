import { db } from "@/lib/db";
import type { RunOneJob } from "./engine";

export async function readBackfillJob(dataset: string): Promise<RunOneJob> {
  const existing = await db.backfillJob.findUnique({ where: { dataset } });
  if (existing) {
    return {
      dataset: existing.dataset,
      mode: existing.mode as "backfill" | "live",
      cursor: existing.cursor,
      totalIngested: existing.totalIngested,
      lastError: existing.lastError,
      // status added 2026-05-17. Engine doesn't read this today, but include
      // it so future helpers/tests that read a job through this function see
      // the same shape as what writeBackfillJob persists.
      status: existing.status,
    };
  }
  await db.backfillJob.create({
    data: { dataset, mode: "backfill", cursor: null, status: "active", totalIngested: 0 },
  });
  return { dataset, mode: "backfill", cursor: null, totalIngested: 0, lastError: null };
}

export async function writeBackfillJob(
  dataset: string,
  patch: Partial<RunOneJob>
): Promise<void> {
  await db.backfillJob.update({
    where: { dataset },
    data: {
      ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
      ...(patch.cursor !== undefined ? { cursor: patch.cursor } : {}),
      ...(patch.totalIngested !== undefined ? { totalIngested: patch.totalIngested } : {}),
      ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
      ...(patch.status !== undefined && patch.status !== null ? { status: patch.status } : {}),
      lastRunAt: new Date(),
    },
  });
}

export async function appendIngestRun(args: {
  dataset: string;
  mode: "backfill" | "live";
  startedAt: Date;
  finishedAt: Date;
  rowsFetched: number;
  rowsInserted: number;
  error?: string;
}): Promise<void> {
  await db.ingestRun.create({ data: args });
}
