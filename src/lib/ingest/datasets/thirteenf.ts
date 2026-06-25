import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverThirteenFHolding } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate, isAfterCutoff } from "../cutoff";
import { dollarsToCentsBigInt } from "@/lib/money";

type Row = {
  filer: string;
  ticker: string;
  shares: number | null;
  valueCents: bigint | null;
  filingDate: Date;
  reportDate: Date;
  changeShares: number | null;
  putCall: "PUT" | "CALL" | null;
  sourceHash: string;
};

function hash(filer: string, ticker: string, reportIso: string, putCall: Row["putCall"]): string {
  const side = putCall ? `|${putCall}` : "";
  return createHash("sha256").update(`13f|${filer}|${ticker}|${reportIso}${side}`).digest("hex");
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoOrToday(value: string | undefined): string {
  if (value) {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function normalizePutCall(value: string | null | undefined): Row["putCall"] {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "PUT") return "PUT";
  if (normalized === "CALL") return "CALL";
  return null;
}

export const ThirteenFHoldingSpec: DatasetSpec<QuiverThirteenFHolding[], Row> = {
  name: "ThirteenFHolding",
  endpoints: { live: "/live/sec13f" },
  pagination: { type: "none" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .filter((t) => t.Ticker)
      .map((t) => {
        const filer = t.Filer ?? t.Fund ?? t.Name ?? "Unknown";
        const filingIso = isoOrToday(t.FilingDate ?? t.Date);
        const reportIso = isoOrToday(t.ReportDate ?? t.ReportPeriod ?? t.Date);
        const shares = toNumber(t.Shares ?? t.Held ?? t.Held_Normalized);
        const close = toNumber(t.Close);
        const value = toNumber(t.Value) ?? (shares != null && close != null ? shares * close : null);
        const putCall = normalizePutCall(t["Put/Call"]);
        return {
          filer,
          ticker: t.Ticker,
          shares,
          valueCents: value == null ? null : dollarsToCentsBigInt(value),
          filingDate: new Date(filingIso + "T00:00:00Z"),
          reportDate: new Date(reportIso + "T00:00:00Z"),
          changeShares: toNumber(t.ChangeShares ?? t.ChangeShare ?? t.Change_Share),
          putCall,
          sourceHash: hash(filer, t.Ticker, reportIso, putCall),
        };
      })
      .filter((r) => isAfterCutoff(r.reportDate, cutoff));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const affected = await db.$executeRaw`
        INSERT INTO "ThirteenFHolding"
          ("filer","ticker","shares","valueCents","filingDate","reportDate","changeShares","putCall","sourceHash")
        VALUES
          (${r.filer}, ${r.ticker}, ${r.shares}, ${r.valueCents}, ${r.filingDate}, ${r.reportDate}, ${r.changeShares}, ${r.putCall}, ${r.sourceHash})
        ON CONFLICT("sourceHash") DO NOTHING`;
      if (affected > 0) inserted++;
    }
    return { inserted };
  },
};
