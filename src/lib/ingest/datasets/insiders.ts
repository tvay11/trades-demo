import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverInsiderTrade } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate, isAfterCutoff } from "../cutoff";
import { dollarsToCentsBigInt } from "@/lib/money";

const dollarsToCents = (n: number) => Math.round(n * 100);

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

type Row = {
  ticker: string;
  insiderName: string;
  insiderTitle: string | null;
  transactionType: string;
  transactionDate: Date;
  filingDate: Date | null;
  shares: number | null;
  pricePerShareCents: number | null;
  totalValueCents: bigint | null;
  sharesOwnedAfter: number | null;
  formType: string | null;
  sourceHash: string;
};

function hash(t: QuiverInsiderTrade): string {
  return createHash("sha256")
    .update(`ins|${t.Name}|${t.Ticker}|${t.Date}|${transactionType(t)}|${t.Shares ?? ""}`)
    .digest("hex");
}

function transactionType(t: QuiverInsiderTrade) {
  if (t.Transaction) return t.Transaction;
  return [t.TransactionCode, t.AcquiredDisposedCode].filter(Boolean).join("/") || "Unknown";
}

function titleFrom(t: QuiverInsiderTrade) {
  if (t.Title) return t.Title;
  if (t.officerTitle) return t.officerTitle;
  if (t.isDirector) return "Director";
  if (t.isOfficer) return "Officer";
  if (t.isTenPercentOwner) return "Ten Percent Owner";
  if (t.isOther) return "Other";
  return null;
}

function formTypeFrom(t: QuiverInsiderTrade) {
  if (t.FormType) return t.FormType;
  const flags = [
    t.isDirector ? "director" : null,
    t.isOfficer ? "officer" : null,
    t.isTenPercentOwner ? "ten-percent-owner" : null,
    t.isOther ? "other" : null,
  ].filter(Boolean);
  return flags.length ? flags.join(",") : null;
}

export const InsiderTradeSpec: DatasetSpec<QuiverInsiderTrade[], Row> = {
  name: "InsiderTrade",
  endpoints: { live: "/live/insiders" },
  pagination: { type: "page", pageSize: 1000, param: "page" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .filter((t) => t.Ticker && t.Date)
      .map((t) => {
        const shares = toNumber(t.Shares);
        const pricePerShare = toNumber(t.PricePerShare);
        const totalValue = toNumber(t.TotalValue);

        return {
          ticker: t.Ticker,
          insiderName: t.Name,
          insiderTitle: titleFrom(t),
          transactionType: transactionType(t),
          transactionDate: new Date(t.Date),
          filingDate: t.FilingDate ? new Date(t.FilingDate) : t.fileDate ? new Date(t.fileDate) : null,
          shares,
          pricePerShareCents: pricePerShare == null ? null : dollarsToCents(pricePerShare),
          totalValueCents:
            totalValue != null
              ? dollarsToCentsBigInt(totalValue)
              : shares != null && pricePerShare != null
                ? dollarsToCentsBigInt(shares * pricePerShare)
                : null,
          sharesOwnedAfter: toNumber(t.SharesOwnedAfter) ?? toNumber(t.SharesOwnedFollowing),
          formType: formTypeFrom(t),
          sourceHash: hash(t),
        };
      })
      .filter((r) => isAfterCutoff(r.transactionDate, cutoff));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const affected = await db.$executeRaw`
        INSERT INTO "InsiderTrade"
          ("ticker","insiderName","insiderTitle","transactionType","transactionDate","filingDate","shares","pricePerShareCents","totalValueCents","sharesOwnedAfter","formType","sourceHash")
        VALUES
          (${r.ticker}, ${r.insiderName}, ${r.insiderTitle}, ${r.transactionType}, ${r.transactionDate}, ${r.filingDate}, ${r.shares}, ${r.pricePerShareCents}, ${r.totalValueCents}, ${r.sharesOwnedAfter}, ${r.formType}, ${r.sourceHash})
        ON CONFLICT("sourceHash") DO NOTHING`;
      if (affected > 0) inserted++;
    }
    return { inserted };
  },
};
