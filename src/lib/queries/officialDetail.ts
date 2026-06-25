import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { minimumDollars, type Cents } from "@/lib/money";
import type { Party, TradeType } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────

export interface OfficialProfile {
  id: number;
  name: string;
  /** "D" / "R" / null. Many executive officials have no party recorded. */
  party: Party | null;
  /** e.g. "Secretary of the Treasury". */
  title: string | null;
  /** e.g. "Cabinet", "Sub-Cabinet". */
  level: string | null;
  /** e.g. "OGE-278" / "annual". */
  filingType: string | null;
  /** Cabinet department / agency name, joined from ExecutiveAgency. */
  agency: string | null;
  /** "Treasury", "State", etc. — title-cased role label used in the hero. */
  role: string;
  slug: string;
  tookOfficeDate: string | null;
  departedDate: string | null;
  mostRecentFilingDate: string | null;
}

export interface OfficialTradeRow {
  id: number;
  ticker: string | null;
  transactionType: TradeType;
  transactionDate: string;
  amountRange: string;
  amountMinimum: number;
  assetDescription: string;
  lateFilingFlag: boolean;
}

export interface OfficialStats {
  totalTrades: number;
  totalVolume: number;
  buyCount: number;
  sellCount: number;
  uniqueTickers: number;
  lateFilingCount: number;
  firstTradeDate: string | null;
  latestTradeDate: string | null;
}

export interface TickerConcentration {
  ticker: string;
  tradeCount: number;
  totalVolume: number;
  buyCount: number;
  sellCount: number;
}

export interface MonthlyActivity {
  month: string;
  tradeCount: number;
  volume: number;
}

export interface OfficialDetailData {
  profile: OfficialProfile;
  stats: OfficialStats;
  trades: OfficialTradeRow[];
  topTickers: TickerConcentration[];
  monthlyActivity: MonthlyActivity[];
  sparkline: Array<{ date: string; value: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────

function normalizeParty(value: string | null): Party | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.startsWith("D")) return "D";
  if (upper.startsWith("R")) return "R";
  return null;
}

function classifyTradeType(value: string): TradeType {
  const normalized = value.toLowerCase();
  if (normalized.includes("sell") || normalized.includes("sale")) return "Sell";
  if (normalized.includes("exchange")) return "Exchange";
  return "Buy";
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatAmountRange(minCents: Cents, maxCents: Cents): string {
  const min = Number(minCents ?? 0) / 100;
  const max = Number(maxCents ?? min) / 100;
  if (min === 1_000 && max === 15_000) return "$1K-$15K";
  if (min === 15_000 && max === 50_000) return "$15K-$50K";
  if (min === 50_000 && max === 100_000) return "$50K-$100K";
  if (min === 100_000 && max === 250_000) return "$100K-$250K";
  if (min === 250_000 && max === 500_000) return "$250K-$500K";
  if (min === 500_000 && max === 1_000_000) return "$500K-$1M";
  if (min === 1_000_000 && max === 5_000_000) return "$1M-$5M";
  if (min === 5_000_000 && max === 25_000_000) return "$5M-$25M";
  if (min === 25_000_000 && max === 50_000_000) return "$25M-$50M";
  if (min >= 50_000_000) return "$50M+";
  return `$${Math.round(min / 1_000)}K-$${Math.round(max / 1_000)}K`;
}

// ── Main query ─────────────────────────────────────────────────────────

export async function getOfficialById(id: number): Promise<OfficialDetailData | null> {
  "use cache";
  applyCacheLife("minutes");

  const official = await db.executiveOfficial.findUnique({
    where: { id },
    include: {
      agency: { select: { name: true } },
      trades: {
        orderBy: { transactionDate: "desc" },
        select: {
          id: true,
          ticker: true,
          transactionType: true,
          transactionDate: true,
          amountMinCents: true,
          amountMaxCents: true,
          amountRangeRaw: true,
          assetDescription: true,
          lateFilingFlag: true,
        },
      },
    },
  });

  if (!official) return null;

  const agencyName = official.agency?.name ?? null;
  const profile: OfficialProfile = {
    id: official.id,
    name: official.name,
    party: normalizeParty(official.party),
    title: official.title,
    level: official.level,
    filingType: official.filingType,
    agency: agencyName,
    role: official.title ?? agencyName ?? "Executive Official",
    slug: official.slug,
    tookOfficeDate: official.tookOfficeDate ? dateKey(official.tookOfficeDate) : null,
    departedDate: official.departedDate ? dateKey(official.departedDate) : null,
    mostRecentFilingDate: official.mostRecentFilingDate
      ? dateKey(official.mostRecentFilingDate)
      : null,
  };

  const trades: OfficialTradeRow[] = official.trades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    transactionType: classifyTradeType(t.transactionType),
    transactionDate: dateKey(t.transactionDate),
    amountRange: t.amountRangeRaw ?? formatAmountRange(t.amountMinCents, t.amountMaxCents),
    amountMinimum: minimumDollars(t.amountMinCents, t.amountMaxCents),
    assetDescription: t.assetDescription,
    lateFilingFlag: t.lateFilingFlag,
  }));

  let buyCount = 0;
  let sellCount = 0;
  let totalVolume = 0;
  let lateFilingCount = 0;
  const tickerSet = new Set<string>();

  for (const t of trades) {
    if (t.transactionType === "Buy") buyCount++;
    else if (t.transactionType === "Sell") sellCount++;
    totalVolume += t.amountMinimum;
    if (t.lateFilingFlag) lateFilingCount++;
    if (t.ticker) tickerSet.add(t.ticker);
  }

  let minTxDate: string | null = null;
  let maxTxDate: string | null = null;
  for (const t of trades) {
    if (minTxDate === null || t.transactionDate < minTxDate) minTxDate = t.transactionDate;
    if (maxTxDate === null || t.transactionDate > maxTxDate) maxTxDate = t.transactionDate;
  }

  const stats: OfficialStats = {
    totalTrades: trades.length,
    totalVolume,
    buyCount,
    sellCount,
    uniqueTickers: tickerSet.size,
    lateFilingCount,
    firstTradeDate: minTxDate,
    latestTradeDate: maxTxDate,
  };

  // Top tickers by volume. Trades without a ticker (rare on executive rows)
  // are excluded — they can't be linked to a stock anyway.
  const tickerMap = new Map<string, TickerConcentration>();
  for (const t of trades) {
    if (!t.ticker) continue;
    const existing = tickerMap.get(t.ticker) ?? {
      ticker: t.ticker,
      tradeCount: 0,
      totalVolume: 0,
      buyCount: 0,
      sellCount: 0,
    };
    existing.tradeCount++;
    existing.totalVolume += t.amountMinimum;
    if (t.transactionType === "Buy") existing.buyCount++;
    if (t.transactionType === "Sell") existing.sellCount++;
    tickerMap.set(t.ticker, existing);
  }
  const topTickers = [...tickerMap.values()]
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 12);

  const monthMap = new Map<string, { tradeCount: number; volume: number }>();
  for (const t of trades) {
    const month = t.transactionDate.slice(0, 7);
    const existing = monthMap.get(month) ?? { tradeCount: 0, volume: 0 };
    existing.tradeCount++;
    existing.volume += t.amountMinimum;
    monthMap.set(month, existing);
  }
  const monthlyActivity: MonthlyActivity[] = [...monthMap.entries()]
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const sparkline = monthlyActivity.slice(-12).map((m) => ({
    date: m.month,
    value: m.volume,
  }));

  return {
    profile,
    stats,
    trades,
    topTickers,
    monthlyActivity,
    sparkline,
  };
}
