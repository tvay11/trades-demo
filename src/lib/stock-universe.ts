import { db } from "@/lib/db";

// Every table that references a real-company ticker. We scrape DISTINCT
// values across this union and INSERT OR IGNORE into Stock so the Stock
// table becomes the authoritative universe.
const TICKER_SOURCES: ReadonlyArray<{ table: string; column: string; nullable?: boolean }> = [
  { table: "CongressTrade", column: "ticker" },
  { table: "SenateTrade", column: "ticker" },
  { table: "HouseTrade", column: "ticker" },
  { table: "InsiderTrade", column: "ticker" },
  { table: "LobbyingDisclosure", column: "ticker", nullable: true },
  { table: "GovContract", column: "ticker" },
  { table: "Patent", column: "ticker" },
  { table: "OffExchangeActivity", column: "ticker" },
  { table: "ThirteenFHolding", column: "ticker" },
  { table: "WsbMention", column: "ticker" },
  { table: "TwitterMention", column: "ticker" },
  { table: "WikipediaView", column: "ticker" },
  { table: "PoliticalBeta", column: "ticker" },
  { table: "Spac", column: "ticker" },
];

export type SyncStockUniverseSummary = {
  inserted: number;
  companyNamesFilled: number;
  totalStocks: number;
};

// A real ticker is 1-8 chars of A-Z, optionally with one `.` or `-` (BRK.B,
// BRK-B etc — different feeds use different class-share separators).
// This filter excludes CUSIPs like 37045XEF9, quoted artifacts like `"OMEX"`,
// and other garbage that leaked into the source tables.
const TICKER_SHAPE_FILTER = `
  LENGTH(ticker) BETWEEN 1 AND 8
  AND ticker = UPPER(ticker)
  AND ticker GLOB '[A-Z]*'
  AND ticker NOT GLOB '*[^A-Z.-]*'
`;

function buildUnionSql(): string {
  return TICKER_SOURCES.map(
    (s) =>
      `SELECT DISTINCT "${s.column}" AS ticker FROM "${s.table}" WHERE "${s.column}" IS NOT NULL AND "${s.column}" <> ''`,
  ).join(" UNION ");
}

export async function syncStockUniverse(): Promise<SyncStockUniverseSummary> {
  const before = await db.$queryRawUnsafe<Array<{ n: number | bigint }>>(
    'SELECT COUNT(*) AS n FROM "Stock"',
  );
  const beforeCount = Number(before[0]?.n ?? 0);

  // Add any missing ticker from the union. INSERT OR IGNORE swallows
  // conflicts on the ticker primary key. Shape filter excludes CUSIPs and
  // other garbage that occasionally appears in source tables.
  const unionSql = buildUnionSql();
  await db.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Stock" ("ticker", "createdAt", "updatedAt")
     SELECT ticker, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM (${unionSql})
     WHERE ${TICKER_SHAPE_FILTER}`,
  );

  const after = await db.$queryRawUnsafe<Array<{ n: number | bigint }>>(
    'SELECT COUNT(*) AS n FROM "Stock"',
  );
  const afterCount = Number(after[0]?.n ?? 0);
  const inserted = afterCount - beforeCount;

  // Note: we deliberately do NOT auto-fill companyName here. The
  // CongressTrade.assetDescription field is a freeform narrative ("CONTRIBUTION
  // OF 7,704 SHARES HELD PERSONALLY TO DONOR-ADVISED FUND.", etc.) so any
  // heuristic produces too much noise. The /analysis/stocks/[symbol] page
  // still infers names per-render where useful; this sync intentionally
  // leaves companyName null until a better source (Yahoo profile, FMP, etc)
  // is wired up.

  return {
    inserted,
    companyNamesFilled: 0,
    totalStocks: afterCount,
  };
}
