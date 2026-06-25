import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverPatent } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate, isAfterCutoff } from "../cutoff";

type Row = {
  ticker: string;
  patentNumber: string | null;
  title: string | null;
  filedAt: Date | null;
  grantedAt: Date | null;
  inventors: string | null;
  abstract: string | null;
  sourceHash: string;
};

function hash(t: QuiverPatent): string {
  return createHash("sha256")
    .update(`pat|${t.Ticker}|${t.PatentNumber ?? ""}`)
    .digest("hex");
}

function joinInventors(v: QuiverPatent["Inventors"]): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

export const PatentSpec: DatasetSpec<QuiverPatent[], Row> = {
  name: "Patent",
  endpoints: { live: "/live/allpatents" },
  pagination: { type: "none" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .map((t) => ({
        ticker: t.Ticker,
        patentNumber: t.PatentNumber ?? null,
        title: t.Title ?? null,
        filedAt: t.FiledAt ? new Date(t.FiledAt) : null,
        grantedAt: t.GrantedAt
          ? new Date(t.GrantedAt)
          : t.Date
            ? new Date(t.Date)
            : null,
        inventors: joinInventors(t.Inventors),
        abstract: t.Abstract ?? null,
        sourceHash: hash(t),
      }))
      .filter((r) => isAfterCutoff(r.grantedAt ?? r.filedAt, cutoff));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const before = await db.patent.count({ where: { sourceHash: r.sourceHash } });
      await db.patent.upsert({
        where: { sourceHash: r.sourceHash },
        update: { grantedAt: r.grantedAt },
        create: r,
      });
      if (before === 0) inserted++;
    }
    return { inserted };
  },
};
