import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverLobbyingDisclosure } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { ingestMinDate } from "../cutoff";
import { dollarsToCentsBigInt } from "@/lib/money";
const toNumber = (value: number | string | undefined) =>
  typeof value === "number" ? value : value == null || value === "" ? null : Number(value);

type Row = {
  client: string;
  registrant: string;
  ticker: string | null;
  amountCents: bigint | null;
  filingYear: number;
  filingQuarter: number | null;
  filingType: string | null;
  issues: string | null;
  filedAt: Date | null;
  sourceHash: string;
};

function hash(t: QuiverLobbyingDisclosure): string {
  const filedAt = t.FiledAt ?? t.Date ?? "";
  return createHash("sha256")
    .update(`${t.Client}|${t.Registrant}|${t.Ticker ?? ""}|${t.Year ?? ""}|${t.Quarter ?? t.Qtr ?? ""}|${filedAt}|${t.Issue ?? ""}|${t.Specific_Issue ?? ""}`)
    .digest("hex");
}

function yearFrom(t: QuiverLobbyingDisclosure): number | null {
  if (typeof t.Year === "number" && t.Year > 0) return t.Year;
  const date = t.FiledAt ?? t.Date;
  if (!date) return null;
  const year = new Date(date).getUTCFullYear();
  return Number.isFinite(year) && year > 0 ? year : null;
}

function quarterFrom(t: QuiverLobbyingDisclosure) {
  if (typeof t.Quarter === "number") return t.Quarter;
  if (typeof t.Qtr === "number") return t.Qtr;
  const date = t.FiledAt ?? t.Date;
  if (!date) return null;
  return Math.floor(new Date(date).getUTCMonth() / 3) + 1;
}

function effectiveLobbyingDate(r: { filedAt: Date | null; filingYear: number; filingQuarter: number | null }): Date | null {
  if (r.filedAt) return r.filedAt;
  if (!r.filingYear) return null;
  const month = r.filingQuarter ? (r.filingQuarter - 1) * 3 : 0;
  return new Date(Date.UTC(r.filingYear, month, 1));
}

function issuesFrom(t: QuiverLobbyingDisclosure) {
  const parts = [t.Issues, t.Issue, t.Specific_Issue].filter(
    (part): part is string => Boolean(part?.trim()),
  );
  return parts.length ? parts.join("\n") : null;
}

export const LobbyingDisclosureSpec: DatasetSpec<QuiverLobbyingDisclosure[], Row> = {
  name: "LobbyingDisclosure",
  endpoints: { live: "/live/lobbying" },
  pagination: { type: "none" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .map((t): Row | null => {
        // Drop rows with no year AND no date — schema declares filingYear
        // NOT NULL, and storing year=0 created a hot bucket on @@index([filingYear, filingQuarter]).
        const filingYear = yearFrom(t);
        if (filingYear == null) return null;
        const amount = toNumber(t.Amount);
        const filedAt = t.FiledAt ?? t.Date;
        return {
          client: t.Client,
          registrant: t.Registrant,
          ticker: t.Ticker ?? null,
          amountCents:
            amount != null && Number.isFinite(amount) ? dollarsToCentsBigInt(amount) : null,
          filingYear,
          filingQuarter: quarterFrom(t),
          filingType: t.Type ?? null,
          issues: issuesFrom(t),
          filedAt: filedAt ? new Date(filedAt) : null,
          sourceHash: hash(t),
        };
      })
      .filter((r): r is Row => {
        if (r === null) return false;
        const d = effectiveLobbyingDate(r);
        return !d || d.getTime() >= cutoff.getTime();
      });
  },
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    let inserted = 0;
    for (const r of rows) {
      const affected = await db.$executeRaw`
        INSERT INTO "LobbyingDisclosure"
          ("client","registrant","ticker","amountCents","filingYear","filingQuarter","filingType","issues","filedAt","sourceHash")
        VALUES
          (${r.client}, ${r.registrant}, ${r.ticker}, ${r.amountCents}, ${r.filingYear}, ${r.filingQuarter}, ${r.filingType}, ${r.issues}, ${r.filedAt}, ${r.sourceHash})
        ON CONFLICT("sourceHash") DO NOTHING`;
      if (affected > 0) inserted++;
    }
    return { inserted };
  },
};
