import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverTwitterMention } from "@/lib/quiver/types";
import { db } from "@/lib/db";

type Row = {
  ticker: string;
  date: Date;
  mentions: number;
  sentiment: number | null;
  followers: number | null;
  sourceHash: string;
};

function hash(t: QuiverTwitterMention): string {
  return createHash("sha256").update(`tw|${t.Ticker}|${t.Date}`).digest("hex");
}

export const TwitterMentionSpec: DatasetSpec<QuiverTwitterMention[], Row> = {
  name: "TwitterMention",
  endpoints: { live: "/live/twitter" },
  pagination: { type: "none" },
  paginationLive: { type: "none" },
  parse: (raw) =>
    raw
      .map((t): Row | null => {
        // Schema declares mentions Int NOT NULL — guard against missing/NaN.
        const mentions = Number(t.Mentions);
        if (!Number.isFinite(mentions)) return null;
        return {
          ticker: t.Ticker,
          date: new Date(t.Date),
          mentions,
          sentiment: typeof t.Sentiment === "number" ? t.Sentiment : null,
          followers: typeof t.Followers === "number" ? t.Followers : null,
          sourceHash: hash(t),
        };
      })
      .filter((r): r is Row => r !== null),
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const before = await db.twitterMention.count({ where: { sourceHash: r.sourceHash } });
      await db.twitterMention.upsert({
        where: { sourceHash: r.sourceHash },
        update: {},
        create: r,
      });
      if (before === 0) inserted++;
    }
    return { inserted };
  },
};
