import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverWsbMention } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate, isAfterCutoff } from "../cutoff";

type Row = {
  ticker: string;
  date: Date;
  mentions: number;
  sentiment: number | null;
  rank: number | null;
  sourceHash: string;
};

function todayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function hash(ticker: string, dateIso: string): string {
  return createHash("sha256").update(`wsb|${ticker}|${dateIso}`).digest("hex");
}

export const WsbMentionSpec: DatasetSpec<QuiverWsbMention[], Row> = {
  name: "WsbMention",
  endpoints: { bulk: "/historical/wallstreetbets", live: "/live/wallstreetbets" },
  pagination: { type: "none" },
  paginationLive: { type: "none" },
  parse: (raw) => {
    const today = todayUtcIso();
    const cutoff = ingestMinDate();
    return raw
      .map((t): Row | null => {
        const dateIso = t.Date ? new Date(t.Date).toISOString().slice(0, 10) : today;
        const mentionsRaw = t.Mentions ?? t.Count ?? 0;
        const mentions = Number(mentionsRaw);
        // Schema declares mentions Int NOT NULL — drop rows where the raw
        // value is non-numeric instead of writing NaN.
        if (!Number.isFinite(mentions)) return null;
        const sentimentRaw = t.Sentiment;
        const rankRaw = t.Rank;
        return {
          ticker: t.Ticker,
          date: new Date(dateIso + "T00:00:00Z"),
          mentions,
          sentiment: sentimentRaw == null ? null : Number(sentimentRaw),
          rank: rankRaw == null ? null : Number(rankRaw),
          sourceHash: hash(t.Ticker, dateIso),
        };
      })
      .filter((r): r is Row => r !== null && isAfterCutoff(r.date, cutoff));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const before = await db.wsbMention.count({ where: { sourceHash: r.sourceHash } });
      await db.wsbMention.upsert({
        where: { sourceHash: r.sourceHash },
        // Reflect Quiver corrections (mentions/sentiment) rather than
        // silently dropping the updated values.
        update: { mentions: r.mentions, sentiment: r.sentiment, rank: r.rank },
        create: r,
      });
      if (before === 0) inserted++;
    }
    return { inserted };
  },
};
