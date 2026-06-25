import { db } from "@/lib/db";
import type { TrackRecordRow } from "@/lib/analysis/trackRecord";

export async function ensureTrackRecordTable(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS PoliticianTrackRecord (
       politician TEXT PRIMARY KEY,
       samples INTEGER NOT NULL,
       hitRate30 REAL NOT NULL,
       avgExcess30 REAL NOT NULL,
       avgExcess90 REAL,
       updatedAt TEXT NOT NULL
     )`,
  );
}

export async function writeTrackRecords(rows: TrackRecordRow[]): Promise<void> {
  await ensureTrackRecordTable();
  const now = new Date().toISOString();
  for (const r of rows) {
    await db.$executeRawUnsafe(
      `INSERT INTO PoliticianTrackRecord (politician, samples, hitRate30, avgExcess30, avgExcess90, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(politician) DO UPDATE SET samples=excluded.samples, hitRate30=excluded.hitRate30,
         avgExcess30=excluded.avgExcess30, avgExcess90=excluded.avgExcess90, updatedAt=excluded.updatedAt`,
      r.politician,
      r.samples,
      r.hitRate30,
      r.avgExcess30,
      r.avgExcess90,
      now,
    );
  }
}

export interface StoredTrackRecord extends TrackRecordRow {
  updatedAt: string;
}

/** Map keyed by politician. Returns empty map on any failure (table missing, db error). */
export async function getTrackRecords(politicians?: string[]): Promise<Map<string, StoredTrackRecord>> {
  try {
    await ensureTrackRecordTable();
    const rows = await db.$queryRawUnsafe<StoredTrackRecord[]>(
      politicians && politicians.length
        ? `SELECT * FROM PoliticianTrackRecord WHERE politician IN (${politicians.map(() => "?").join(",")})`
        : `SELECT * FROM PoliticianTrackRecord`,
      ...(politicians ?? []),
    );
    return new Map(
      rows.map((r) => [
        r.politician,
        {
          politician: r.politician,
          samples: Number(r.samples),
          hitRate30: Number(r.hitRate30),
          avgExcess30: Number(r.avgExcess30),
          avgExcess90: r.avgExcess90 != null ? Number(r.avgExcess90) : null,
          updatedAt: r.updatedAt,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}
