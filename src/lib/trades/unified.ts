export type Branch = "congress" | "executive";

export type UnifiedPerson = {
  /** Stable identifier scoped by branch. Format: "P-<politicianId>" or "O-<officialId>". */
  key: string;
  /** Branch-scoped numeric id (politician.id or official.id). */
  id: number;
  name: string;
  /** "D" | "R" | "I" or null. Populated for both branches when known. */
  party: string | null;
  /** Congressional only. Null for executive officials. */
  state: string | null;
  /** "House" | "Senate" for congress; null for executive. */
  chamber: string | null;
  /** Executive only. Null for congress. */
  agency: string | null;
  /** Executive title (e.g. "Secretary of the Treasury"). Null for congress. */
  title: string | null;
};

import { db } from "@/lib/db";

export type UnifiedTradeRow = {
  /** Globally unique string id. Format: "cong-<id>" or "exec-<id>". */
  id: string;
  branch: Branch;
  ticker: string | null;
  assetDescription: string | null;
  transactionType: string;
  transactionDate: Date;
  /** Null for executive (the source doesn't expose a disclosure date). */
  disclosureDate: Date | null;
  reportDate: Date | null;
  amountMinCents: bigint | null;
  amountMaxCents: bigint | null;
  amountRangeRaw: string | null;
  person: UnifiedPerson;
  ownerType: string | null;
  ownerName: string | null;
  ownerRaw: string | null;
  filingUrl: string | null;
  documentId: string | null;
  lateFilingFlag: boolean;
  sourceHash: string;
};

export type FetchAllTradesArgs = {
  /** Restrict to one ticker (case-sensitive uppercase). */
  ticker?: string;
  /** Lower bound on COALESCE(disclosureDate, transactionDate). */
  since?: Date;
  /** Upper bound (exclusive) on COALESCE(disclosureDate, transactionDate). */
  until?: Date;
  /** Cap total rows returned. Order: COALESCE(disclosureDate, transactionDate) desc. */
  take?: number;
  /** Default false. When true, includes executive rows that lack a ticker. */
  includeNullTickers?: boolean;
};

/**
 * Union of CongressTrade + ExecutiveTrade. Two parallel findMany queries
 * merged in JS rather than a SQL UNION because the two tables have
 * different person foreign keys (`politicianId` vs `officialId`) and
 * different available columns — JS-side merge keeps types honest.
 *
 * Sort order: COALESCE(disclosureDate, transactionDate) desc. Executive
 * rows lack a disclosureDate, so they sort by transactionDate. This
 * matches what a trader expects: "most recently became public."
 */
export async function fetchAllTrades(
  args: FetchAllTradesArgs = {},
): Promise<UnifiedTradeRow[]> {
  const [congress, executive] = await Promise.all([
    db.congressTrade.findMany({
      where: {
        ...(args.ticker ? { ticker: args.ticker } : {}),
        ...(args.since || args.until
          ? { disclosureDate: dateRange(args.since, args.until) }
          : {}),
      },
      include: { politician: true },
      orderBy: { disclosureDate: "desc" },
      take: args.take,
    }),
    db.executiveTrade.findMany({
      where: {
        ...(args.ticker
          ? { ticker: args.ticker }
          : args.includeNullTickers
            ? {}
            : { ticker: { not: null } }),
        ...(args.since || args.until
          ? { transactionDate: dateRange(args.since, args.until) }
          : {}),
      },
      include: { official: { include: { agency: true } } },
      orderBy: { transactionDate: "desc" },
      take: args.take,
    }),
  ]);

  const rows: UnifiedTradeRow[] = [
    ...congress.map(mapCongressTrade),
    ...executive.map(mapExecutiveTrade),
  ];

  rows.sort((a, b) => {
    const at = (a.disclosureDate ?? a.transactionDate).getTime();
    const bt = (b.disclosureDate ?? b.transactionDate).getTime();
    return bt - at;
  });

  return args.take == null ? rows : rows.slice(0, args.take);
}

function dateRange(since?: Date, until?: Date) {
  const r: { gte?: Date; lt?: Date } = {};
  if (since) r.gte = since;
  if (until) r.lt = until;
  return r;
}

type CongressTradeWithPolitician = Awaited<
  ReturnType<typeof db.congressTrade.findMany>
>[number] & {
  politician: {
    id: number;
    name: string;
    party: string | null;
    state: string | null;
    chamber: string | null;
  };
};

function mapCongressTrade(row: CongressTradeWithPolitician): UnifiedTradeRow {
  return {
    id: `cong-${row.id}`,
    branch: "congress",
    ticker: row.ticker,
    assetDescription: row.assetDescription,
    transactionType: row.transactionType,
    transactionDate: row.transactionDate,
    disclosureDate: row.disclosureDate,
    reportDate: row.reportDate,
    amountMinCents: row.amountMinCents,
    amountMaxCents: row.amountMaxCents,
    amountRangeRaw: row.amountRangeRaw,
    person: {
      key: `P-${row.politician.id}`,
      id: row.politician.id,
      name: row.politician.name,
      party: row.politician.party,
      state: row.politician.state,
      chamber: row.politician.chamber,
      agency: null,
      title: null,
    },
    ownerType: row.ownerType,
    ownerName: row.ownerName,
    ownerRaw: row.ownerRaw,
    filingUrl: row.filingUrl,
    documentId: row.documentId,
    lateFilingFlag: false,
    sourceHash: row.sourceHash,
  };
}

type ExecutiveTradeWithOfficial = Awaited<
  ReturnType<typeof db.executiveTrade.findMany>
>[number] & {
  official: {
    id: number;
    name: string;
    title: string | null;
    party: string | null;
    agency: { name: string } | null;
  };
};

function mapExecutiveTrade(row: ExecutiveTradeWithOfficial): UnifiedTradeRow {
  return {
    id: `exec-${row.id}`,
    branch: "executive",
    ticker: row.ticker,
    assetDescription: row.assetDescription,
    transactionType: row.transactionType,
    transactionDate: row.transactionDate,
    disclosureDate: null,
    reportDate: null,
    amountMinCents: row.amountMinCents,
    amountMaxCents: row.amountMaxCents,
    amountRangeRaw: row.amountRangeRaw,
    person: {
      key: `O-${row.official.id}`,
      id: row.official.id,
      name: row.official.name,
      party: row.official.party,
      state: null,
      chamber: null,
      agency: row.official.agency?.name ?? null,
      title: row.official.title,
    },
    ownerType: null,
    ownerName: null,
    ownerRaw: null,
    filingUrl: null,
    documentId: null,
    lateFilingFlag: row.lateFilingFlag,
    sourceHash: row.sourceHash,
  };
}

/**
 * Returns a SQL fragment that yields the total number of disclosed trades
 * for a ticker since a given date, counting BOTH CongressTrade (filter on
 * disclosureDate) and ExecutiveTrade (filter on transactionDate, since
 * executive disclosures don't carry a separate disclosure date).
 *
 * Usage in correlated subqueries:
 *   `(${unifiedTradeCountSql('s."ticker"')})` — emits a sum of two
 *   COUNT(*) parenthesized expressions. The caller binds the cutoff date
 *   TWICE per use (once for the congress branch, once for the executive
 *   branch).
 */
export function unifiedTradeCountSql(tickerExpr: string): string {
  return (
    `(SELECT COUNT(*) FROM "CongressTrade" c WHERE c."ticker" = ${tickerExpr} AND c."disclosureDate" >= ?)` +
    ` + ` +
    `(SELECT COUNT(*) FROM "ExecutiveTrade" e WHERE e."ticker" = ${tickerExpr} AND e."transactionDate" >= ?)`
  );
}
