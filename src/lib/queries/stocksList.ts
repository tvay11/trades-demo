import { db } from "@/lib/db";
import { unifiedTradeCountSql } from "@/lib/trades/unified";

export type StockListSortKey =
  | "ticker"
  | "companyName"
  | "industry"
  | "country"
  | "marketCap"
  | "tradeCount14"
  | "tradeCount30"
  | "tradeCount60"
  | "tradeCount90"
  | "tradeCount365";

export type StockListSortDir = "asc" | "desc";

export type StockListParams = {
  q?: string;
  sort?: StockListSortKey;
  dir?: StockListSortDir;
  page?: number;
  pageSize?: number;
  sector?: string;
  cap?: string;
  activity?: string;
  exchange?: string;
  industry?: string;
  country?: string;
  profile?: string;
  minTrades90?: string;
};

export type StockListRow = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  marketCap: number | null;
  tradeCount14: number;
  tradeCount30: number;
  tradeCount60: number;
  tradeCount90: number;
  tradeCount365: number;
};

export type StockListResult = {
  rows: StockListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const VALID_SORTS = new Set<StockListSortKey>([
  "ticker",
  "companyName",
  "industry",
  "country",
  "marketCap",
  "tradeCount14",
  "tradeCount30",
  "tradeCount60",
  "tradeCount90",
  "tradeCount365",
]);

const ORDER_BY_SQL: Record<StockListSortKey, string> = {
  ticker: 's."ticker"',
  companyName: 's."companyName"',
  industry: 's."industry"',
  country: 's."country"',
  marketCap: 's."marketCap"',
  tradeCount14: '"tradeCount14"',
  tradeCount30: '"tradeCount30"',
  tradeCount60: '"tradeCount60"',
  tradeCount90: '"tradeCount90"',
  tradeCount365: '"tradeCount365"',
};

const DEFAULT_PAGE_SIZE = 50;
export const STOCKS_EXPORT_LIMIT = 10_000;

type RawRow = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  marketCap: string | null; // CAST to TEXT to dodge Prisma+libSQL BigInt bug
  tradeCount14: number | bigint;
  tradeCount30: number | bigint;
  tradeCount60: number | bigint;
  tradeCount90: number | bigint;
  tradeCount365: number | bigint;
};

export async function getStocksList(
  params: StockListParams = {},
): Promise<StockListResult> {
  const sort: StockListSortKey =
    params.sort && VALID_SORTS.has(params.sort) ? params.sort : "marketCap";
  const dir: StockListSortDir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(STOCKS_EXPORT_LIMIT, Math.max(10, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const qRaw = params.q?.trim() ?? "";
  const hasQ = qRaw.length > 0;
  const qLike = `%${qRaw.replace(/[%_]/g, (m) => `\\${m}`).toUpperCase()}%`;

  const now = Date.now();
  const cutoff14 = new Date(now - 14 * 86_400_000).toISOString();
  const cutoff30 = new Date(now - 30 * 86_400_000).toISOString();
  const cutoff60 = new Date(now - 60 * 86_400_000).toISOString();
  const cutoff90 = new Date(now - 90 * 86_400_000).toISOString();
  const cutoff365 = new Date(now - 365 * 86_400_000).toISOString();

  // Aggregated subquery: latest close per ticker. Materialise once and join.
  // CAST close (cents-int) to REAL/100 = dollars; latestCloseCents stays as
  // integer until we convert in app code.
  const orderColumn = ORDER_BY_SQL[sort];
  const orderClause = `${orderColumn} ${dir === "asc" ? "ASC NULLS LAST" : "DESC NULLS LAST"}`;

  const whereConditions: string[] = [];
  const queryParams: Array<string | number> = [];

  if (hasQ) {
    whereConditions.push(`(UPPER(s."ticker") LIKE ? OR UPPER(COALESCE(s."companyName", '')) LIKE ?)`);
    queryParams.push(qLike, qLike);
  }

  if (params.sector) {
    whereConditions.push(`s."sector" = ?`);
    queryParams.push(params.sector);
  }

  if (params.exchange) {
    whereConditions.push(`UPPER(COALESCE(s."exchange", '')) LIKE ?`);
    queryParams.push(`%${params.exchange.replace(/[%_]/g, (m) => `\\${m}`).toUpperCase()}%`);
  }

  if (params.industry) {
    whereConditions.push(`UPPER(COALESCE(s."industry", '')) LIKE ?`);
    queryParams.push(`%${params.industry.replace(/[%_]/g, (m) => `\\${m}`).toUpperCase()}%`);
  }

  if (params.country) {
    whereConditions.push(`UPPER(COALESCE(s."country", '')) LIKE ?`);
    queryParams.push(`%${params.country.replace(/[%_]/g, (m) => `\\${m}`).toUpperCase()}%`);
  }

  if (params.cap) {
    switch (params.cap) {
      case "mega":
        whereConditions.push(`s."marketCap" >= 200000000000`);
        break;
      case "large":
        whereConditions.push(`s."marketCap" >= 10000000000 AND s."marketCap" < 200000000000`);
        break;
      case "mid":
        whereConditions.push(`s."marketCap" >= 2000000000 AND s."marketCap" < 10000000000`);
        break;
      case "small":
        whereConditions.push(`s."marketCap" >= 300000000 AND s."marketCap" < 2000000000`);
        break;
      case "micro":
        whereConditions.push(`s."marketCap" < 300000000`);
        break;
    }
  }

  if (params.activity) {
    // Now counts BOTH CongressTrade (disclosureDate) and ExecutiveTrade
    // (transactionDate). Each unifiedTradeCountSql call emits two `?`
    // placeholders so we push the cutoff twice.
    if (params.activity === "active90") {
      whereConditions.push(`(${unifiedTradeCountSql('s."ticker"')}) > 0`);
      queryParams.push(cutoff90, cutoff90);
    } else if (params.activity === "active365") {
      whereConditions.push(`(${unifiedTradeCountSql('s."ticker"')}) > 0`);
      queryParams.push(cutoff365, cutoff365);
    }
  }

  if (params.profile) {
    switch (params.profile) {
      case "hasMarketCap":
        whereConditions.push(`s."marketCap" IS NOT NULL`);
        break;
      case "missingMarketCap":
        whereConditions.push(`s."marketCap" IS NULL`);
        break;
      case "hasWebsite":
        whereConditions.push(`s."website" IS NOT NULL AND s."website" <> ''`);
        break;
      case "missingWebsite":
        whereConditions.push(`(s."website" IS NULL OR s."website" = '')`);
        break;
      case "completeProfile":
        whereConditions.push(
          `s."companyName" IS NOT NULL AND s."companyName" <> '' AND ` +
            `s."marketCap" IS NOT NULL AND ` +
            `s."sector" IS NOT NULL AND s."sector" <> '' AND ` +
            `s."industry" IS NOT NULL AND s."industry" <> ''`,
        );
        break;
    }
  }

  const minTrades90 = Number(params.minTrades90);
  if (Number.isInteger(minTrades90) && minTrades90 > 0) {
    whereConditions.push(`(${unifiedTradeCountSql('s."ticker"')}) >= ?`);
    queryParams.push(cutoff90, cutoff90, minTrades90);
  }

  const filterClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // CongressTrade has an index on ticker, so each correlated COUNT is a fast
  // indexed scan. Four of them × 50 rows per page = ~200 indexed lookups,
  // negligible cost. The trade-count subqueries are independent so SQLite
  // can run them as needed; the sort column is referenced post-projection.
  const baseSql = `
    SELECT
      s."ticker"                                            AS "ticker",
      s."companyName"                                       AS "companyName",
      s."sector"                                            AS "sector",
      s."industry"                                          AS "industry",
      s."country"                                           AS "country",
      CAST(s."marketCap" AS TEXT)                           AS "marketCap",
      (${unifiedTradeCountSql('s."ticker"')})               AS "tradeCount14",
      (${unifiedTradeCountSql('s."ticker"')})               AS "tradeCount30",
      (${unifiedTradeCountSql('s."ticker"')})               AS "tradeCount60",
      (${unifiedTradeCountSql('s."ticker"')})               AS "tradeCount90",
      (${unifiedTradeCountSql('s."ticker"')})               AS "tradeCount365"
    FROM "Stock" s
    ${filterClause}
    ORDER BY ${orderClause}, s."ticker" ASC
    LIMIT ? OFFSET ?
  `;

  const countSql = `SELECT COUNT(*) AS n FROM "Stock" s ${filterClause}`;

  // libSQL bind order = positional. Each unifiedTradeCountSql emits TWO `?`
  // placeholders (one for CongressTrade.disclosureDate, one for
  // ExecutiveTrade.transactionDate) so each cutoff is bound twice.
  // Order: cutoff14 ×2, cutoff30 ×2, cutoff60 ×2, cutoff90 ×2, cutoff365 ×2,
  // (filter params from queryParams), pageSize, offset.
  const baseParams: Array<string | number> = [
    cutoff14, cutoff14,
    cutoff30, cutoff30,
    cutoff60, cutoff60,
    cutoff90, cutoff90,
    cutoff365, cutoff365,
    ...queryParams,
    pageSize,
    offset,
  ];

  const countParams = [...queryParams];

  const rawRows = await db.$queryRawUnsafe<RawRow[]>(baseSql, ...baseParams);
  const countRows = await db.$queryRawUnsafe<Array<{ n: number | bigint }>>(
    countSql,
    ...countParams,
  );

  const total = Number(countRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows: StockListRow[] = rawRows.map((r) => ({
    ticker: r.ticker,
    companyName: r.companyName,
    sector: r.sector,
    industry: r.industry,
    country: r.country,
    marketCap: r.marketCap == null ? null : Number(r.marketCap),
    tradeCount14: Number(r.tradeCount14),
    tradeCount30: Number(r.tradeCount30),
    tradeCount60: Number(r.tradeCount60),
    tradeCount90: Number(r.tradeCount90),
    tradeCount365: Number(r.tradeCount365),
  }));

  return { rows, total, page, pageSize, totalPages };
}
