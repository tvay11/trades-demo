import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverOffExchangeActivity } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate, isAfterCutoff } from "../cutoff";

type Row = {
  ticker: string;
  date: Date;
  shortVolume: number | null;
  totalVolume: number | null;
  shortVolumePercent: number | null;
  darkPoolPercent: number | null;
  sourceHash: string;
};

function hash(t: QuiverOffExchangeActivity): string {
  return createHash("sha256").update(`offex|${t.Ticker}|${t.Date}`).digest("hex");
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[%\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export const OffExchangeActivitySpec: DatasetSpec<QuiverOffExchangeActivity[], Row> = {
  name: "OffExchangeActivity",
  endpoints: { live: "/live/offexchange" },
  pagination: { type: "none" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .map((t) => {
        const dpi = toNumber(t.DPI);
        return {
          ticker: t.Ticker,
          date: new Date(t.Date),
          shortVolume: toNumber(t.ShortVolume) ?? toNumber(t.OTC_Short),
          totalVolume: toNumber(t.TotalVolume) ?? toNumber(t.OTC_Total),
          shortVolumePercent: toNumber(t.ShortVolumePercent) ?? (dpi == null ? null : dpi * 100),
          darkPoolPercent: toNumber(t.DarkPoolPercent) ?? (dpi == null ? null : dpi * 100),
          sourceHash: hash(t),
        };
      })
      // Apply the same date cutoff as other datasets so the live endpoint
      // doesn't re-sweep multi-year history every run.
      .filter((r) => isAfterCutoff(r.date, cutoff));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    if (rows.length === 0) return { inserted: 0 };

    const existing = await existingSourceHashes(rows.map((r) => r.sourceHash));
    const inserted = rows.reduce((count, row) => count + (existing.has(row.sourceHash) ? 0 : 1), 0);

    for (const chunk of chunks(rows, 100)) {
      await db.$executeRawUnsafe(
        buildOffExchangeUpsertSql(chunk.length),
        ...chunk.flatMap((r) => [
          r.ticker,
          r.date.toISOString(),
          r.shortVolume,
          r.totalVolume,
          r.shortVolumePercent,
          r.darkPoolPercent,
          r.sourceHash,
        ]),
      );
    }

    return { inserted };
  },
};

export function buildOffExchangeUpsertSql(rowCount = 1) {
  const values = Array.from({ length: rowCount }, () => "(?, ?, ?, ?, ?, ?, ?)").join(", ");

  return `
    INSERT INTO "OffExchangeActivity" (
      "ticker",
      "date",
      "shortVolume",
      "totalVolume",
      "shortVolumePercent",
      "darkPoolPercent",
      "sourceHash"
    )
    VALUES ${values}
    ON CONFLICT("sourceHash") DO UPDATE SET
      "shortVolume" = excluded."shortVolume",
      "totalVolume" = excluded."totalVolume",
      "shortVolumePercent" = excluded."shortVolumePercent",
      "darkPoolPercent" = excluded."darkPoolPercent"
  `;
}

async function existingSourceHashes(sourceHashes: string[]) {
  const existing = new Set<string>();

  for (const chunk of chunks(sourceHashes, 900)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db.$queryRawUnsafe<Array<{ sourceHash: string }>>(
      `SELECT "sourceHash" FROM "OffExchangeActivity" WHERE "sourceHash" IN (${placeholders})`,
      ...chunk,
    );
    for (const row of rows) existing.add(row.sourceHash);
  }

  return existing;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
