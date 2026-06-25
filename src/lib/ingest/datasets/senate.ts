import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverSenateTrade } from "@/lib/quiver/types";
import { parseAmountRange } from "@/lib/quiver/client";
import { db } from "@/lib/db";
import { dollarsToCentsBigInt } from "@/lib/money";
import { normalizeTradeOwner } from "@/lib/trades/owner";
import { ingestMinDate, isAfterCutoff } from "../cutoff";

type Row = {
  senator: string;
  ticker: string;
  transactionType: string;
  transactionDate: Date;
  reportDate: Date | null;
  amountMinCents: bigint | null;
  amountMaxCents: bigint | null;
  amountRangeRaw: string | null;
  party: string | null;
  state: string | null;
  comments: string | null;
  ownerType: string | null;
  ownerName: string | null;
  ownerRaw: string | null;
  filingUrl: string | null;
  documentId: string | null;
  sourceHash: string;
};

function hash(t: QuiverSenateTrade): string {
  return createHash("sha256")
    .update(`${t.Senator}|${t.Ticker}|${tradeDate(t)}|${t.Transaction}|${t.Range ?? ""}`)
    .digest("hex");
}

function tradeDate(t: QuiverSenateTrade) {
  return t.TransactionDate ?? t.Date ?? "";
}

function reportDate(t: QuiverSenateTrade) {
  return t.ReportDate ?? t.last_modified ?? "";
}

export const SenateTradeSpec: DatasetSpec<QuiverSenateTrade[], Row> = {
  name: "SenateTrade",
  endpoints: { live: "/live/senatetrading" },
  pagination: { type: "none" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .map((t) => {
        const range = parseAmountRange(t.Range ?? "");
        const owner = normalizeTradeOwner(t as Record<string, unknown>);
        const disclosed = reportDate(t);
        return {
          senator: t.Senator,
          ticker: t.Ticker,
          transactionType: t.Transaction,
          transactionDate: new Date(tradeDate(t)),
          reportDate: disclosed ? new Date(disclosed) : null,
          amountMinCents: range ? dollarsToCentsBigInt(range.min) : null,
          amountMaxCents: range ? dollarsToCentsBigInt(range.max) : null,
          amountRangeRaw: t.Range ?? null,
          party: t.Party ?? null,
          state: t.State ?? null,
          comments: t.Comments ?? null,
          ownerType: owner.ownerType,
          ownerName: owner.ownerName,
          ownerRaw: owner.ownerRaw,
          filingUrl: owner.filingUrl,
          documentId: owner.documentId,
          sourceHash: hash(t),
        };
      })
      // Filter on disclosure (reportDate ?? last_modified) only. When neither
      // is present we assume the row is a recent late filing and admit it —
      // falling back to transactionDate caused old-but-recently-disclosed
      // trades to be dropped (matching the CongressTrade freshness behavior).
      .filter((r) => (r.reportDate ? isAfterCutoff(r.reportDate, cutoff) : true));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    // Raw $executeRaw to bypass the Prisma libSQL adapter's BigInt > 2^32
    // float-coercion bug. db.senateTrade.upsert silently throws on the
    // $5M-$25M and larger Quiver buckets.
    let inserted = 0;
    for (const r of rows) {
      const affected = await db.$executeRaw`
        INSERT INTO "SenateTrade" (
          "senator", "ticker", "transactionType", "transactionDate", "reportDate",
          "amountMinCents", "amountMaxCents", "amountRangeRaw",
          "party", "state", "comments",
          "ownerType", "ownerName", "ownerRaw",
          "filingUrl", "documentId", "sourceHash"
        )
        VALUES (
          ${r.senator}, ${r.ticker}, ${r.transactionType}, ${r.transactionDate}, ${r.reportDate},
          ${r.amountMinCents}, ${r.amountMaxCents}, ${r.amountRangeRaw},
          ${r.party}, ${r.state}, ${r.comments},
          ${r.ownerType}, ${r.ownerName}, ${r.ownerRaw},
          ${r.filingUrl}, ${r.documentId}, ${r.sourceHash}
        )
        ON CONFLICT("sourceHash") DO NOTHING
      `;
      if (affected > 0) inserted++;
    }
    return { inserted };
  },
};
