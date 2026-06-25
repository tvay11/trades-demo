import type { QuiverTrade } from "@/lib/quiver/types";
import { parseAmountRange } from "@/lib/quiver/client";
import { tradeHash } from "@/lib/trades/hash";
import { db } from "@/lib/db";
import { dollarsToCentsBigInt } from "@/lib/money";

const optional = (value: string | undefined) => (value && value.trim() ? value : null);

async function findOrCreatePolitician(t: QuiverTrade) {
  const bioguideId = optional(t.BioGuideID);
  const fields = {
    chamber: t.House ?? null,
    party: t.Party ?? null,
    state: t.State ?? null,
  };

  // Use Prisma upsert so parallel ingest workers can't both pass a
  // findUnique check and then have one fail with P2002 on the unique
  // constraint. Prefer bioguideId when available since it's the stable
  // government identifier; fall back to name match for legacy rows.
  if (bioguideId) {
    return db.politician.upsert({
      where: { bioguideId },
      update: { name: t.Representative, ...fields },
      create: { name: t.Representative, bioguideId, ...fields },
    });
  }
  return db.politician.upsert({
    where: { name: t.Representative },
    update: fields,
    create: { name: t.Representative, bioguideId: null, ...fields },
  });
}

export async function upsertCongressTrade(t: QuiverTrade): Promise<number> {
  const transactionDate = new Date(t.TransactionDate);
  const disclosureDate = new Date(t.Disclosed ?? t.ReportDate ?? t.TransactionDate);
  const reportDate = t.ReportDate ? new Date(t.ReportDate) : null;
  const range = parseAmountRange(t.Range ?? "");
  const hash = tradeHash({
    name: t.Representative,
    ticker: t.Ticker,
    date: t.TransactionDate,
    type: t.Transaction,
    amount: t.Range ?? "",
  });

  const politician = await findOrCreatePolitician(t);

  const amountMinCents = range ? dollarsToCentsBigInt(range.min) : null;
  const amountMaxCents = range ? dollarsToCentsBigInt(range.max) : null;

  // Raw INSERT (instead of db.congressTrade.upsert) because the Prisma
  // libSQL adapter v6.19.x coerces BigInt > 2^32 to JS Number when binding,
  // and libSQL rejects the resulting "<n>.0" value on INTEGER columns. A
  // $42.9M+ trade ($5M-$25M and larger Quiver buckets) silently fails via
  // the high-level path. Tagged-template binding preserves BigInt.
  // Returns 1 if a new row was inserted, 0 if the sourceHash already existed.
  return await db.$executeRaw`
    INSERT INTO "CongressTrade" (
      "politicianId", "representative", "ticker", "assetDescription",
      "transactionType", "transactionDate", "reportDate", "disclosureDate",
      "amountMinCents", "amountMaxCents", "amountRangeRaw",
      "house", "party", "state",
      "ownerType", "ownerName", "ownerRaw",
      "filingUrl", "documentId", "sourceHash"
    )
    VALUES (
      ${politician.id}, ${t.Representative}, ${t.Ticker}, ${t.AssetDescription ?? null},
      ${t.Transaction}, ${transactionDate}, ${reportDate}, ${disclosureDate},
      ${amountMinCents}, ${amountMaxCents}, ${t.Range ?? null},
      ${t.House ?? null}, ${t.Party ?? null}, ${t.State ?? null},
      ${t.OwnerType ?? null}, ${t.OwnerName ?? null}, ${t.OwnerRaw ?? null},
      ${t.FilingUrl ?? null}, ${t.DocumentId ?? null}, ${hash}
    )
    ON CONFLICT("sourceHash") DO NOTHING
  `;
}

export async function upsertCongressTrades(rows: QuiverTrade[]) {
  let inserted = 0;
  for (const t of rows) {
    // upsertCongressTrade returns the number of rows affected (1 = new
    // insert, 0 = sourceHash already present). One DB round trip per row
    // instead of the previous count-then-upsert pattern.
    const affected = await upsertCongressTrade(t);
    if (affected > 0) inserted++;
  }
  return { processed: rows.length, inserted };
}
