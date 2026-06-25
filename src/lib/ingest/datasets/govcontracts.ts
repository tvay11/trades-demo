import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverGovContract } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate, isAfterCutoff } from "../cutoff";
import { dollarsToCentsBigInt } from "@/lib/money";
const toNumber = (value: number | string | undefined) =>
  typeof value === "number" ? value : value == null || value === "" ? null : Number(value);

type Row = {
  ticker: string;
  agency: string | null;
  description: string | null;
  amountCents: bigint | null;
  awardedAt: Date | null;
  contractId: string | null;
  sourceHash: string;
};

function hash(t: QuiverGovContract): string {
  return createHash("sha256")
    .update(`gov|${t.Ticker}|${t.ContractId ?? ""}|${t.AwardedAt ?? ""}|${t.Year ?? ""}|${t.Qtr ?? ""}`)
    .digest("hex");
}

function quarterStart(t: QuiverGovContract) {
  if (!t.Year || !t.Qtr) return null;
  const month = (t.Qtr - 1) * 3;
  return new Date(Date.UTC(t.Year, month, 1));
}

export const GovContractSpec: DatasetSpec<QuiverGovContract[], Row> = {
  name: "GovContract",
  endpoints: { live: "/live/govcontracts" },
  pagination: { type: "page", pageSize: 1000, param: "page" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .map((t) => {
        const amount = toNumber(t.Amount);
        const awardedAt = t.AwardedAt ? new Date(t.AwardedAt) : quarterStart(t);
        return {
          ticker: t.Ticker,
          agency: t.Agency ?? null,
          description: t.Description ?? (t.Year && t.Qtr ? `Government contracts Q${t.Qtr} ${t.Year}` : null),
          amountCents:
            amount != null && Number.isFinite(amount) ? dollarsToCentsBigInt(amount) : null,
          awardedAt,
          contractId: t.ContractId ?? (t.Year && t.Qtr ? `${t.Ticker}-${t.Year}-Q${t.Qtr}` : null),
          sourceHash: hash(t),
        };
      })
      .filter((r) => isAfterCutoff(r.awardedAt, cutoff));
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const affected = await db.$executeRaw`
        INSERT INTO "GovContract"
          ("ticker","agency","description","amountCents","awardedAt","contractId","sourceHash")
        VALUES
          (${r.ticker}, ${r.agency}, ${r.description}, ${r.amountCents}, ${r.awardedAt}, ${r.contractId}, ${r.sourceHash})
        ON CONFLICT("sourceHash") DO NOTHING`;
      if (affected > 0) inserted++;
    }
    return { inserted };
  },
};
