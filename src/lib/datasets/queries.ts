import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import {
  DATASET_DEFINITIONS,
  type DatasetDefinition,
  type DatasetRow,
  getDatasetDefinition,
} from "@/lib/datasets/registry";
import {
  buildDatasetOrderBy,
  buildDatasetWhere,
  parseDatasetQuery,
  type NormalizedDatasetQuery,
} from "@/lib/datasets/filters";

export const DATASET_PAGE_SIZE = 25;
export const DATASET_EXPORT_LIMIT = 10_000;

export type DatasetSummary = DatasetDefinition & {
  rowCount: number | null;
};

export type DatasetPageResult = {
  definition: DatasetDefinition;
  rows: DatasetRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  query: NormalizedDatasetQuery;
  error?: string;
};

export type DatasetExportResult = {
  definition: DatasetDefinition;
  rows: DatasetRow[];
  totalRows: number;
  exportedRows: number;
  truncated: boolean;
  query: NormalizedDatasetQuery;
};

type PoliticianFindManyArgs = NonNullable<Parameters<typeof db.politician.findMany>[0]>;
type EnhancedPoliticianRow = {
  id: number;
  name: string;
  party: string | null;
  state: string | null;
  chamber: string | null;
  bioguideId: string | null;
  createdAt: Date;
  trades30d: number;
  trades60d: number;
  trades90d: number;
  committee: string | null;
  ranking: number | null;
};

export async function getDatasetSummaries(): Promise<DatasetSummary[]> {
  "use cache";
  applyCacheLife("minutes");

  const counts = await Promise.all(
    DATASET_DEFINITIONS.map(async (definition) => {
      try {
        return await countDatasetRows(definition.slug);
      } catch {
        return null;
      }
    }),
  );

  return DATASET_DEFINITIONS.map((definition, index) => ({
    ...definition,
    rowCount: counts[index],
  }));
}

export async function getDatasetPage(
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<DatasetPageResult | null> {
  "use cache";
  applyCacheLife("minutes");

  const definition = getDatasetDefinition(slug);

  if (!definition) return null;

  const query = parseDatasetQuery(definition, searchParams);
  const where = buildDatasetWhere(definition, query);
  const orderBy = buildDatasetOrderBy(definition, query);

  if (slug === "politicians") {
    return getPoliticiansDatasetPage(definition, query, where);
  }

  try {
    const totalRows = await countDatasetRows(slug, where);
    const totalPages = Math.max(1, Math.ceil(totalRows / DATASET_PAGE_SIZE));
    const boundedPage = Math.min(query.page, totalPages);
    const rows = await findDatasetRows(
      slug,
      {
        skip: (boundedPage - 1) * DATASET_PAGE_SIZE,
        take: DATASET_PAGE_SIZE,
      },
      where,
      orderBy,
    );

    return {
      definition,
      rows,
      page: boundedPage,
      pageSize: DATASET_PAGE_SIZE,
      totalRows,
      totalPages,
      query,
    };
  } catch (error) {
    return {
      definition,
      rows: [],
      page: query.page,
      pageSize: DATASET_PAGE_SIZE,
      totalRows: 0,
      totalPages: 1,
      query,
      error: error instanceof Error ? error.message : "Unable to load dataset.",
    };
  }
}

async function countDatasetRows(slug: string, where: Record<string, unknown> = {}) {
  const args = Object.keys(where).length > 0 ? ({ where } as never) : undefined;

  switch (slug) {
    case "backfill-jobs":
      return db.backfillJob.count(args);
    case "ingest-runs":
      return db.ingestRun.count(args);
    case "politicians":
      return db.politician.count(args);
    case "committees":
      return db.committee.count(args);
    case "committee-assignments":
      return db.politicianCommitteeAssignment.count(args);
    case "stocks":
      return db.stock.count(args);
    case "ticker-prices":
      return db.tickerPriceCache.count(args);
    case "congress-trades":
      return db.congressTrade.count(args);
    case "signal-snapshots":
      return db.signalSnapshot.count(args);
    case "backtest-runs":
      return db.backtestRun.count(args);
    case "backtest-positions":
      return db.backtestPosition.count(args);
    case "senate-trades":
      return db.senateTrade.count(args);
    case "house-trades":
      return db.houseTrade.count(args);
    case "executive-trades":
      return db.executiveTrade.count(args);
    case "executive-officials":
      return db.executiveOfficial.count(args);
    case "executive-agencies":
      return db.executiveAgency.count(args);
    case "insider-trades":
      return db.insiderTrade.count(args);
    case "lobbying-disclosures":
      return db.lobbyingDisclosure.count(args);
    case "wsb-mentions":
      return db.wsbMention.count(args);
    case "twitter-mentions":
      return db.twitterMention.count(args);
    case "gov-contracts":
      return db.govContract.count(args);
    case "patents":
      return db.patent.count(args);
    case "off-exchange-activity":
      return db.offExchangeActivity.count(args);
    case "thirteen-f-holdings":
      return db.thirteenFHolding.count(args);
    case "spacs":
      return db.spac.count(args);
    case "wikipedia-views":
      return db.wikipediaView.count(args);
    case "political-beta":
      return db.politicalBeta.count(args);
    default:
      return 0;
  }
}

async function findDatasetRows(
  slug: string,
  page: {
    skip: number;
    take: number;
  },
  where: Record<string, unknown>,
  orderBy: Record<string, "asc" | "desc">,
) {
  const args = {
    ...page,
    ...(Object.keys(where).length > 0 ? { where } : {}),
    ...(Object.keys(orderBy).length > 0 ? { orderBy } : {}),
  } as never;

  switch (slug) {
    case "backfill-jobs":
      return toRows(await db.backfillJob.findMany(args));
    case "ingest-runs":
      return toRows(await db.ingestRun.findMany(args));
    case "politicians": {
      const rows = await loadEnhancedPoliticians(where);
      return toRows(sortEnhancedPoliticians(rows, orderBy).slice(page.skip, page.skip + page.take));
    }
    case "committees":
      return toRows(await db.committee.findMany(args));
    case "committee-assignments":
      return toRows(await db.politicianCommitteeAssignment.findMany(args));
    case "stocks": {
      // db.stock.findMany goes through the global Prisma `omit` that strips
      // marketCap to dodge libSQL's BigInt deserialization bug. Without a
      // second raw read, the /datasets/stocks Market Cap column always renders
      // blank. Read marketCap separately via raw SQL keyed by ticker.
      const stocks = await db.stock.findMany(args);
      if (stocks.length === 0) return toRows(stocks);
      const tickers = stocks.map((s) => s.ticker);
      const placeholders = tickers.map(() => "?").join(",");
      const capRows = await db.$queryRawUnsafe<Array<{ ticker: string; marketCap: string | null }>>(
        `SELECT ticker, CAST("marketCap" AS TEXT) AS marketCap FROM "Stock" WHERE ticker IN (${placeholders})`,
        ...tickers,
      );
      const capByTicker = new Map(capRows.map((r) => [r.ticker, r.marketCap]));
      const merged = stocks.map((s) => {
        const raw = capByTicker.get(s.ticker);
        return { ...s, marketCap: raw == null ? null : BigInt(raw) };
      });
      return toRows(merged);
    }
    case "ticker-prices":
      return toRows(await db.tickerPriceCache.findMany(args));
    case "congress-trades":
      return toRows(await db.congressTrade.findMany(args));
    case "signal-snapshots":
      return toRows(await db.signalSnapshot.findMany(args));
    case "backtest-runs":
      return toRows(await db.backtestRun.findMany(args));
    case "backtest-positions":
      return toRows(await db.backtestPosition.findMany(args));
    case "senate-trades":
      return toRows(await db.senateTrade.findMany(args));
    case "house-trades":
      return toRows(await db.houseTrade.findMany(args));
    case "executive-trades": {
      // ExecutiveTrade only carries `officialId` on the row, so the relation
      // must be joined and flattened for the browser to display readable
      // `official` / `agency` / `title` columns.
      const trades = (await db.executiveTrade.findMany({
        ...(args as object),
        include: { official: { include: { agency: true } } },
      } as never)) as unknown as Array<
        Record<string, unknown> & {
          official: {
            name: string;
            title: string | null;
            agency: { name: string } | null;
          } | null;
        }
      >;
      const enhanced = trades.map((t) => {
        const { official, ...rest } = t;
        return {
          ...rest,
          official: official?.name ?? null,
          title: official?.title ?? null,
          agency: official?.agency?.name ?? null,
        };
      });
      return toRows(enhanced);
    }
    case "executive-officials": {
      const officials = (await db.executiveOfficial.findMany({
        ...(args as object),
        include: { agency: true },
      } as never)) as unknown as Array<
        Record<string, unknown> & { agency: { name: string } | null }
      >;
      const enhanced = officials.map((o) => {
        const { agency, ...rest } = o;
        return { ...rest, agency: agency?.name ?? null };
      });
      return toRows(enhanced);
    }
    case "executive-agencies":
      return toRows(await db.executiveAgency.findMany(args));
    case "insider-trades":
      return toRows(await db.insiderTrade.findMany(args));
    case "lobbying-disclosures":
      return toRows(await db.lobbyingDisclosure.findMany(args));
    case "wsb-mentions":
      return toRows(await db.wsbMention.findMany(args));
    case "twitter-mentions":
      return toRows(await db.twitterMention.findMany(args));
    case "gov-contracts":
      return toRows(await db.govContract.findMany(args));
    case "patents":
      return toRows(await db.patent.findMany(args));
    case "off-exchange-activity":
      return toRows(await db.offExchangeActivity.findMany(args));
    case "thirteen-f-holdings":
      return toRows(await db.thirteenFHolding.findMany(args));
    case "spacs":
      return toRows(await db.spac.findMany(args));
    case "wikipedia-views":
      return toRows(await db.wikipediaView.findMany(args));
    case "political-beta":
      return toRows(await db.politicalBeta.findMany(args));
    default:
      return [];
  }
}

function toRows(rows: unknown[]) {
  return rows as DatasetRow[];
}

export async function getDatasetExportRows(
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
  limit = DATASET_EXPORT_LIMIT,
): Promise<DatasetExportResult | null> {
  const definition = getDatasetDefinition(slug);
  if (!definition) return null;

  const query = parseDatasetQuery(definition, searchParams);
  const where = buildDatasetWhere(definition, query);
  const orderBy = buildDatasetOrderBy(definition, query);
  const take = Math.min(Math.max(1, limit), DATASET_EXPORT_LIMIT);

  if (slug === "politicians") {
    const allRows = await loadEnhancedPoliticians(where);
    const sorted = sortEnhancedPoliticians(applyPoliticianVirtualFilters(allRows, query), {
      [query.sort.key]: query.sort.dir,
    });
    const rows = sorted.slice(0, take);
    return {
      definition,
      rows: toRows(rows),
      totalRows: sorted.length,
      exportedRows: rows.length,
      truncated: sorted.length > rows.length,
      query,
    };
  }

  const totalRows = await countDatasetRows(slug, where);
  const rows = await findDatasetRows(
    slug,
    { skip: 0, take },
    where,
    orderBy,
  );

  return {
    definition,
    rows,
    totalRows,
    exportedRows: rows.length,
    truncated: totalRows > rows.length,
    query,
  };
}

async function getPoliticiansDatasetPage(
  definition: DatasetDefinition,
  query: NormalizedDatasetQuery,
  where: Record<string, unknown>,
): Promise<DatasetPageResult> {
  try {
    const allRows = await loadEnhancedPoliticians(where);
    const filtered = applyPoliticianVirtualFilters(allRows, query);
    const sorted = sortEnhancedPoliticians(filtered, { [query.sort.key]: query.sort.dir });
    const totalRows = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / DATASET_PAGE_SIZE));
    const boundedPage = Math.min(query.page, totalPages);
    const start = (boundedPage - 1) * DATASET_PAGE_SIZE;

    return {
      definition,
      rows: toRows(sorted.slice(start, start + DATASET_PAGE_SIZE)),
      page: boundedPage,
      pageSize: DATASET_PAGE_SIZE,
      totalRows,
      totalPages,
      query,
    };
  } catch (error) {
    return {
      definition,
      rows: [],
      page: query.page,
      pageSize: DATASET_PAGE_SIZE,
      totalRows: 0,
      totalPages: 1,
      query,
      error: error instanceof Error ? error.message : "Unable to load politicians.",
    };
  }
}

async function loadEnhancedPoliticians(where: Record<string, unknown>) {
  const prismaArgs: PoliticianFindManyArgs =
    Object.keys(where).length > 0 ? ({ where } as PoliticianFindManyArgs) : {};

  const politicians = await db.politician.findMany({
    ...prismaArgs,
    include: {
      trades: {
        select: { disclosureDate: true },
      },
      committees: {
        include: { committee: true },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  return politicians.map((p) => {
    let trades30d = 0;
    let trades60d = 0;
    let trades90d = 0;
    for (const t of p.trades) {
      if (t.disclosureDate >= thirtyDaysAgo) trades30d++;
      if (t.disclosureDate >= sixtyDaysAgo) trades60d++;
      if (t.disclosureDate >= ninetyDaysAgo) trades90d++;
    }

    const topCommittee = [...p.committees].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];

    return {
      id: p.id,
      name: p.name,
      party: p.party,
      state: p.state,
      chamber: p.chamber,
      bioguideId: p.bioguideId,
      createdAt: p.createdAt,
      trades30d,
      trades60d,
      trades90d,
      committee: topCommittee?.committee?.name ?? null,
      ranking: topCommittee?.rank ?? null,
    } satisfies EnhancedPoliticianRow;
  });
}

function applyPoliticianVirtualFilters(
  rows: EnhancedPoliticianRow[],
  query: NormalizedDatasetQuery,
) {
  return rows.filter((row) => {
    for (const [key, filter] of Object.entries(query.filters)) {
      if (filter.kind === "text" && key === "committee") {
        const haystack = row.committee?.toLowerCase() ?? "";
        if (!haystack.includes(filter.value.toLowerCase())) return false;
      }

      if (filter.kind === "number-range" && isPoliticianNumberKey(key)) {
        const value = row[key];
        if (value == null) return false;
        if (filter.min !== undefined && value < filter.min) return false;
        if (filter.max !== undefined && value > filter.max) return false;
      }
    }
    return true;
  });
}

function isPoliticianNumberKey(key: string): key is "trades30d" | "trades60d" | "trades90d" | "ranking" {
  return key === "trades30d" || key === "trades60d" || key === "trades90d" || key === "ranking";
}

function sortEnhancedPoliticians(
  rows: EnhancedPoliticianRow[],
  orderBy: Record<string, "asc" | "desc">,
) {
  const [key, dir] = Object.entries(orderBy)[0] ?? ["name", "asc"];
  return [...rows].sort((a, b) => {
    const valueA = enhancedPoliticianValue(a, key);
    const valueB = enhancedPoliticianValue(b, key);
    const result = compareDatasetValues(valueA, valueB);
    return dir === "desc" ? -result : result;
  });
}

function enhancedPoliticianValue(row: EnhancedPoliticianRow, key: string) {
  return row[key as keyof EnhancedPoliticianRow] ?? null;
}

function compareDatasetValues(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}
