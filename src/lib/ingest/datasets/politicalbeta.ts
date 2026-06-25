import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverPoliticalBeta } from "@/lib/quiver/types";
import { db } from "@/lib/db";

type Row = {
  ticker: string;
  beta: number;
  asOfDate: Date | null;
  sourceHash: string;
};

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function hash(t: QuiverPoliticalBeta, asOf: Date): string {
  return createHash("sha256")
    .update(`pbeta|${t.Ticker}|${asOf.toISOString().slice(0, 10)}`)
    .digest("hex");
}

export const PoliticalBetaSpec: DatasetSpec<QuiverPoliticalBeta[], Row> = {
  name: "PoliticalBeta",
  endpoints: { live: "/live/politicalbeta" },
  pagination: { type: "none" },
  parse: (raw) => {
    return raw
      .map((t): Row | null => {
        // Filter out rows with missing/NaN beta — previously defaulted to
        // literal 0, which downstream consumers cannot distinguish from "real
        // beta is zero". Better to omit than to pollute.
        const rawBeta = t.TrumpBeta ?? t.Beta;
        if (rawBeta == null) return null;
        const beta = Number(rawBeta);
        if (!Number.isFinite(beta)) return null;
        const asOfDate = t.AsOfDate ? new Date(t.AsOfDate) : todayUtc();
        return {
          ticker: t.Ticker,
          beta,
          asOfDate,
          sourceHash: hash(t, asOfDate),
        };
      })
      .filter((r): r is Row => r !== null);
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const before = await db.politicalBeta.count({ where: { sourceHash: r.sourceHash } });
      await db.politicalBeta.upsert({
        where: { sourceHash: r.sourceHash },
        update: { beta: r.beta },
        create: r,
      });
      if (before === 0) inserted++;
    }
    return { inserted };
  },
};
