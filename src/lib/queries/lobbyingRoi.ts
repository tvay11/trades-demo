import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import type { MarketSignalMetric } from "./marketSignalData";

// ── Types ──────────────────────────────────────────────────────────────

/** A single company row in the lobbying-to-contract pipeline */
export interface LobbyingContractRow {
  ticker: string;
  client: string;
  totalLobbyingCents: bigint;
  lobbyingFilings: number;
  totalContractCents: bigint;
  contractCount: number;
  roi: number | null; // contract $ / lobbying $, null if no lobbying
  latestLobbyingDate: Date | null;
  latestContractDate: Date | null;
  topAgencies: string[];
}

/** Quarter-over-quarter lobbying spend for a company */
export interface LobbyingTrendPoint {
  year: number;
  quarter: number;
  totalCents: bigint;
  filingCount: number;
}

/** Top lobbying spenders by total amount */
export interface TopSpender {
  ticker: string;
  client: string;
  totalCents: bigint;
  filingCount: number;
  hasContracts: boolean;
  contractTotalCents: bigint;
}

/** Agency with the most contracts tied to lobbying companies */
export interface AgencyBreakdown {
  agency: string;
  contractCount: number;
  totalCents: bigint;
  tickers: string[];
}

export interface LobbyingRoiAnalysis {
  source: "database";
  metrics: MarketSignalMetric[];
  pipeline: LobbyingContractRow[];
  topSpenders: TopSpender[];
  agencyBreakdown: AgencyBreakdown[];
  quarterlyTrend: LobbyingTrendPoint[];
  /** Latest date across BOTH lobbying filings and contract awards, YYYY-MM-DD.
   *  Drives the hero freshness chip. Null when the pipeline is empty. */
  latestDataDate: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

const ZERO = BigInt(0);

function centsToDollars(cents: bigint | null): number {
  if (cents === null || cents === undefined) return 0;
  return Number(cents) / 100;
}

function formatMoney(cents: bigint | null): string {
  const dollars = centsToDollars(cents);
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000).toLocaleString()}K`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

// ── Main query ─────────────────────────────────────────────────────────

export async function getLobbyingRoiAnalysis(): Promise<LobbyingRoiAnalysis> {
  "use cache";
  applyCacheLife("minutes");

  // 1. Get all lobbying disclosures grouped by ticker
  const lobbyingByTicker = await db.lobbyingDisclosure.groupBy({
    by: ["ticker"],
    where: { ticker: { not: null } },
    _sum: { amountCents: true },
    _count: true,
    _max: { filedAt: true },
    orderBy: { _sum: { amountCents: "desc" } },
  });

  // 2. Get all gov contracts grouped by ticker
  const contractsByTicker = await db.govContract.groupBy({
    by: ["ticker"],
    _sum: { amountCents: true },
    _count: true,
    _max: { awardedAt: true },
    orderBy: { _sum: { amountCents: "desc" } },
  });

  // 3. Build lookup maps
  const contractMap = new Map(
    contractsByTicker.map((c) => [
      c.ticker,
      {
        totalCents: c._sum.amountCents ?? ZERO,
        count: c._count,
        latestDate: c._max.awardedAt,
      },
    ]),
  );

  const lobbyingMap = new Map(
    lobbyingByTicker
      .filter((l) => l.ticker !== null)
      .map((l) => [
        l.ticker!,
        {
          totalCents: l._sum.amountCents ?? ZERO,
          count: l._count,
          latestDate: l._max.filedAt,
        },
      ]),
  );

  // 4. Get top client names for each ticker
  const clientNames = await db.lobbyingDisclosure.findMany({
    where: { ticker: { not: null } },
    select: { ticker: true, client: true },
    distinct: ["ticker"],
  });
  const clientMap = new Map(clientNames.map((c) => [c.ticker!, c.client]));

  // 5. Get agencies for each ticker's contracts
  const contractAgencies = await db.govContract.findMany({
    where: { agency: { not: null } },
    select: { ticker: true, agency: true },
    distinct: ["ticker", "agency"],
  });
  const agencyMap = new Map<string, string[]>();
  for (const ca of contractAgencies) {
    const existing = agencyMap.get(ca.ticker) ?? [];
    if (ca.agency) existing.push(ca.agency);
    agencyMap.set(ca.ticker, existing);
  }

  // 6. Find all tickers that appear in BOTH lobbying and contracts
  const allTickers = new Set([...lobbyingMap.keys(), ...contractMap.keys()]);
  const pipeline: LobbyingContractRow[] = [];

  for (const ticker of allTickers) {
    const lobby = lobbyingMap.get(ticker);
    const contract = contractMap.get(ticker);
    if (!lobby && !contract) continue;

    const lobbyTotal = lobby?.totalCents ?? ZERO;
    const contractTotal = contract?.totalCents ?? ZERO;
    const lobbyDollars = centsToDollars(lobbyTotal);
    const contractDollars = centsToDollars(contractTotal);

    pipeline.push({
      ticker,
      client: clientMap.get(ticker) ?? ticker,
      totalLobbyingCents: lobbyTotal,
      lobbyingFilings: lobby?.count ?? 0,
      totalContractCents: contractTotal,
      contractCount: contract?.count ?? 0,
      roi: lobbyDollars > 0 ? contractDollars / lobbyDollars : null,
      latestLobbyingDate: lobby?.latestDate ?? null,
      latestContractDate: contract?.latestDate ?? null,
      topAgencies: agencyMap.get(ticker) ?? [],
    });
  }

  // Sort by ROI descending (companies with both lobbying & contracts first)
  pipeline.sort((a, b) => {
    // Both have ROI → sort by ROI desc
    if (a.roi !== null && b.roi !== null) return b.roi - a.roi;
    // ROI exists > null
    if (a.roi !== null) return -1;
    if (b.roi !== null) return 1;
    // Fallback: sort by total contract value
    return Number(b.totalContractCents - a.totalContractCents);
  });

  // 7. Top spenders (lobbying)
  const topSpenders: TopSpender[] = lobbyingByTicker
    .filter((l) => l.ticker !== null)
    .slice(0, 15)
    .map((l) => {
      const ticker = l.ticker!;
      const contract = contractMap.get(ticker);
      return {
        ticker,
        client: clientMap.get(ticker) ?? ticker,
        totalCents: l._sum.amountCents ?? ZERO,
        filingCount: l._count,
        hasContracts: !!contract,
        contractTotalCents: contract?.totalCents ?? ZERO,
      };
    });

  // 8. Agency breakdown
  const agencyGroups = await db.govContract.groupBy({
    by: ["agency"],
    where: { agency: { not: null } },
    _sum: { amountCents: true },
    _count: true,
    orderBy: { _sum: { amountCents: "desc" } },
    take: 10,
  });

  const agencyBreakdown: AgencyBreakdown[] = [];
  for (const ag of agencyGroups) {
    if (!ag.agency) continue;
    const tickersForAgency = await db.govContract.findMany({
      where: { agency: ag.agency },
      select: { ticker: true },
      distinct: ["ticker"],
      take: 5,
    });
    agencyBreakdown.push({
      agency: ag.agency,
      contractCount: ag._count,
      totalCents: ag._sum.amountCents ?? ZERO,
      tickers: tickersForAgency.map((t) => t.ticker),
    });
  }

  // 9. Quarterly lobbying trend
  const allDisclosures = await db.lobbyingDisclosure.findMany({
    where: { ticker: { not: null }, amountCents: { not: null } },
    select: { filingYear: true, filingQuarter: true, amountCents: true },
    orderBy: [{ filingYear: "asc" }, { filingQuarter: "asc" }],
  });

  const qMap = new Map<string, { totalCents: bigint; count: number }>();
  for (const d of allDisclosures) {
    const key = `${d.filingYear}-${d.filingQuarter ?? 0}`;
    const existing = qMap.get(key) ?? { totalCents: ZERO, count: 0 };
    existing.totalCents += d.amountCents ?? ZERO;
    existing.count += 1;
    qMap.set(key, existing);
  }

  const quarterlyTrend: LobbyingTrendPoint[] = Array.from(qMap.entries())
    .map(([key, val]) => {
      const [year, quarter] = key.split("-").map(Number);
      return { year, quarter, totalCents: val.totalCents, filingCount: val.count };
    })
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter);

  // 10. Summary metrics
  const totalLobbyingCents = lobbyingByTicker.reduce(
    (acc, l) => acc + (l._sum.amountCents ?? ZERO),
    ZERO,
  );
  const totalContractCents = contractsByTicker.reduce(
    (acc, c) => acc + (c._sum.amountCents ?? ZERO),
    ZERO,
  );
  const overlapCount = pipeline.filter(
    (p) => p.lobbyingFilings > 0 && p.contractCount > 0,
  ).length;
  const avgRoi = pipeline.filter((p) => p.roi !== null && p.roi > 0);
  const meanRoi =
    avgRoi.length > 0
      ? avgRoi.reduce((acc, p) => acc + (p.roi ?? 0), 0) / avgRoi.length
      : 0;

  const isEmpty = lobbyingByTicker.length === 0 && contractsByTicker.length === 0;

  const metrics: MarketSignalMetric[] = [
    {
      label: "Total lobbying spend",
      value: formatMoney(totalLobbyingCents),
      tone: "accent",
    },
    {
      label: "Total contracts awarded",
      value: formatMoney(totalContractCents),
      tone: "positive",
    },
    {
      label: "Companies with both",
      value: `${overlapCount}`,
      tone: overlapCount > 0 ? "accent" : "neutral",
    },
    {
      label: "Avg ROI (contract ÷ lobby)",
      value: meanRoi > 0 ? `${meanRoi.toFixed(1)}x` : "—",
      tone: meanRoi > 1 ? "positive" : "neutral",
    },
    {
      label: "Lobbying filings",
      value: lobbyingByTicker.reduce((a, l) => a + l._count, 0).toLocaleString(),
      tone: "neutral",
    },
    {
      label: "Gov contracts",
      value: contractsByTicker.reduce((a, c) => a + c._count, 0).toLocaleString(),
      tone: "neutral",
    },
    {
      label: "Unique tickers lobbying",
      value: `${lobbyingByTicker.filter((l) => l.ticker).length}`,
      tone: "neutral",
    },
    {
      label: "Contract agencies",
      value: `${agencyGroups.length}`,
      tone: "neutral",
    },
  ];

  // Latest date across both source tables for the freshness chip.
  let latestData: Date | null = null;
  for (const row of pipeline) {
    if (row.latestLobbyingDate && (!latestData || row.latestLobbyingDate > latestData)) {
      latestData = row.latestLobbyingDate;
    }
    if (row.latestContractDate && (!latestData || row.latestContractDate > latestData)) {
      latestData = row.latestContractDate;
    }
  }

  return {
    source: "database",
    metrics,
    pipeline,
    topSpenders,
    agencyBreakdown,
    quarterlyTrend,
    latestDataDate: latestData ? latestData.toISOString().slice(0, 10) : null,
  };
}
