import { createHash } from "node:crypto";
import type { DatasetSpec } from "../types";
import type { QuiverSpac } from "@/lib/quiver/types";
import { db } from "@/lib/db";
import { dollarsToCentsBigInt } from "@/lib/money";

type Row = {
  ticker: string;
  name: string | null;
  ipoDate: Date | null;
  trustValueCents: bigint | null;
  status: string | null;
  targetTicker: string | null;
  sourceHash: string;
};

function hash(t: QuiverSpac): string {
  return createHash("sha256").update(`spac|${t.Ticker}`).digest("hex");
}

export const SpacSpec: DatasetSpec<QuiverSpac[], Row> = {
  name: "Spac",
  endpoints: { live: "/live/spacs" },
  pagination: { type: "none" },
  parse: (raw) =>
    raw.map((t) => ({
      ticker: t.Ticker,
      name: t.Name ?? null,
      ipoDate: t.IpoDate ? new Date(t.IpoDate) : null,
      trustValueCents: typeof t.TrustValue === "number" ? dollarsToCentsBigInt(t.TrustValue) : null,
      status: t.Status ?? null,
      targetTicker: t.TargetTicker ?? null,
      sourceHash: hash(t),
    })),
  dedup: (r) => r.sourceHash,
  upsert: async (rows) => {
    // Raw $executeRaw to bypass the Prisma libSQL adapter's BigInt > 2^32
    // float-coercion bug. db.spac.upsert silently throws on SPAC trust
    // values above ~$42.9M (most large SPACs have $200M+ trust).
    // Preserves the previous behavior of refreshing status/targetTicker/
    // trustValueCents on conflict (Quiver corrects these post-IPO).
    let inserted = 0;
    for (const r of rows) {
      const affected = await db.$executeRaw`
        INSERT INTO "Spac" (
          "ticker", "name", "ipoDate", "trustValueCents",
          "status", "targetTicker", "sourceHash"
        )
        VALUES (
          ${r.ticker}, ${r.name}, ${r.ipoDate}, ${r.trustValueCents},
          ${r.status}, ${r.targetTicker}, ${r.sourceHash}
        )
        ON CONFLICT("sourceHash") DO UPDATE SET
          "status" = excluded."status",
          "targetTicker" = excluded."targetTicker",
          "trustValueCents" = excluded."trustValueCents"
      `;
      if (affected > 0) inserted++;
    }
    return { inserted };
  },
};
