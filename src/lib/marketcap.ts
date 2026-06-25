import { db } from "@/lib/db";
import { getQuoteSnapshot } from "@/lib/yahoo/client";
import { parseSqliteUtc } from "@/lib/sql-dates";

const RATE_DELAY_MS = 250;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export type MarketCapBackfillSummary = {
  total: number;
  candidates: number;
  ok: number;
  skipped: number;
  fail: number;
};

export async function runMarketCapBackfill(opts: {
  force?: boolean;
  limit?: number;
  onProgress?: (i: number, total: number, summary: { ok: number; skipped: number; fail: number }) => void;
} = {}): Promise<MarketCapBackfillSummary> {
  const force = opts.force ?? false;
  // `limit: 0` (or null/undefined) means "no limit". Otherwise floor positives.
  // Previously `0` was taken literally → daily ingest with DAILY_MARKETCAP_LIMIT
  // unset (default 0) refreshed zero stocks every run.
  const limit =
    opts.limit == null || !Number.isFinite(opts.limit) || opts.limit <= 0
      ? null
      : Math.floor(opts.limit);

  const rows = await db.$queryRawUnsafe<
    Array<{
      ticker: string;
      marketCap: string | null;
      updatedAt: string;
    }>
  >(
    `SELECT ticker, CAST("marketCap" AS TEXT) as marketCap, "updatedAt"
     FROM "Stock"
     ORDER BY ticker ASC`,
  );

  const cutoff = Date.now() - STALE_AFTER_MS;
  const staleCandidates = rows.filter((r) => {
    if (force) return true;
    if (r.marketCap == null) return true;
    // libSQL returns DateTime as "YYYY-MM-DD HH:MM:SS" UTC; new Date(s) would
    // parse that as local time on non-UTC hosts, shifting the staleness check
    // by the host's offset. parseSqliteUtc forces UTC.
    const parsed = parseSqliteUtc(r.updatedAt);
    const u = parsed?.getTime() ?? NaN;
    return Number.isFinite(u) && u < cutoff;
  });
  const candidates = limit == null ? staleCandidates : staleCandidates.slice(0, limit);

  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { ticker } = candidates[i];
    const snapshot = await getQuoteSnapshot(ticker);
    // Skip if Yahoo returned nothing useful (e.g. delisted, ticker not found).
    const allEmpty =
      snapshot.marketCap == null &&
      snapshot.companyName == null &&
      snapshot.exchange == null &&
      snapshot.sector == null &&
      snapshot.industry == null &&
      snapshot.country == null &&
      snapshot.website == null;
    if (allEmpty) {
      skipped++;
    } else {
      try {
        // COALESCE(?, "col") means "use the new value if non-null, else keep
        // whatever was already in the row." That way a partial Yahoo response
        // doesn't wipe out fields we already had.
        await db.$executeRawUnsafe(
          `UPDATE "Stock"
           SET "marketCap"   = COALESCE(?, "marketCap"),
               "companyName" = COALESCE(?, "companyName"),
               "exchange"    = COALESCE(?, "exchange"),
               "sector"      = COALESCE(?, "sector"),
               "industry"    = COALESCE(?, "industry"),
               "country"     = COALESCE(?, "country"),
               "website"     = COALESCE(?, "website"),
               "updatedAt"   = CURRENT_TIMESTAMP
           WHERE "ticker" = ?`,
          snapshot.marketCap == null ? null : Math.round(snapshot.marketCap),
          snapshot.companyName,
          snapshot.exchange,
          snapshot.sector,
          snapshot.industry,
          snapshot.country,
          snapshot.website,
          ticker,
        );
        ok++;
      } catch (e) {
        fail++;
        console.error(`  ${ticker} write failed:`, (e as Error).message);
      }
    }
    opts.onProgress?.(i + 1, candidates.length, { ok, skipped, fail });
    await sleep(RATE_DELAY_MS);
  }

  return { total: rows.length, candidates: candidates.length, ok, skipped, fail };
}
