import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverWikipediaView } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDateString } from "../cutoff";

type Row = {
  ticker: string;
  date: Date;
  views: number;
  sourceHash: string;
};

function hash(t: QuiverWikipediaView): string {
  return createHash("sha256").update(`wiki|${t.Ticker}|${t.Date}`).digest("hex");
}

export const WikipediaViewSpec: DatasetSpec<QuiverWikipediaView[], Row> = {
  name: "WikipediaView",
  endpoints: { bulk: "/bulk/wikipedia", live: "/live/wikipedia" },
  pagination: { type: "date-window", param: "date", windowDays: 7, stopDate: ingestMinDateString() },
  parse: (raw) =>
    raw
      .map((t): Row | null => {
        // Schema declares views Int NOT NULL — guard against missing/NaN so
        // we don't write NaN (becomes NULL in libSQL, may violate constraint).
        const views = Number(t.Views);
        if (!Number.isFinite(views)) return null;
        return {
          ticker: t.Ticker,
          date: new Date(t.Date),
          views,
          sourceHash: hash(t),
        };
      })
      .filter((r): r is Row => r !== null),
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const before = await db.wikipediaView.count({ where: { sourceHash: r.sourceHash } });
      await db.wikipediaView.upsert({
        where: { sourceHash: r.sourceHash },
        update: {},
        create: r,
      });
      if (before === 0) inserted++;
    }
    return { inserted };
  },
};
