import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { minimumDollars, type Cents } from "@/lib/money";
import type { Party, TradeType } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────

export interface PoliticianProfile {
  id: number;
  name: string;
  party: Party;
  state: string;
  chamber: "House" | "Senate";
  role: string;
  bioguideId: string | null;
}

export interface PoliticianTradeRow {
  id: number;
  ticker: string;
  transactionType: TradeType;
  transactionDate: string;
  disclosureDate: string;
  amountRange: string;
  amountMinimum: number;
  assetDescription: string | null;
}

export interface PoliticianStats {
  totalTrades: number;
  totalVolume: number;
  buyCount: number;
  sellCount: number;
  uniqueTickers: number;
  avgDisclosureDelay: number;
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

export interface PoliticianDetailData {
  profile: PoliticianProfile;
  stats: PoliticianStats;
  trades: PoliticianTradeRow[];
  topTickers: TickerConcentration[];
  monthlyActivity: MonthlyActivity[];
  sparkline: Array<{ date: string; value: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────

function normalizeParty(value: string | null): Party {
  return value?.toUpperCase().startsWith("R") ? "R" : "D";
}

function normalizeChamber(value: string | null): "House" | "Senate" {
  return value?.toLowerCase().includes("sen") ? "Senate" : "House";
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
  if (min >= 5_000_000) return "$5M+";
  return `$${Math.round(min / 1_000)}K-$${Math.round(max / 1_000)}K`;
}

// ── Main query ─────────────────────────────────────────────────────────

export async function getPoliticianById(id: number): Promise<PoliticianDetailData | null> {
  "use cache";
  applyCacheLife("minutes");

  const politician = await db.politician.findUnique({
    where: { id },
    include: {
      trades: {
        orderBy: { disclosureDate: "desc" },
        select: {
          id: true,
          ticker: true,
          transactionType: true,
          transactionDate: true,
          disclosureDate: true,
          amountMinCents: true,
          amountMaxCents: true,
          amountRangeRaw: true,
          assetDescription: true,
        },
      },
      committees: {
        include: {
          committee: { select: { name: true, code: true, chamber: true, type: true } },
        },
        orderBy: [{ isChair: "desc" }, { isRanking: "desc" }, { rank: "asc" }],
      },
    },
  });

  if (!politician) return null;

  const party = normalizeParty(politician.party);
  const chamber = normalizeChamber(politician.chamber);

  // Build profile
  const profile: PoliticianProfile = {
    id: politician.id,
    name: politician.name,
    party,
    state: politician.state ?? "-",
    chamber,
    role: chamber === "Senate" ? "Senator" : "Representative",
    bioguideId: politician.bioguideId,
  };

  // Build trade rows
  const trades: PoliticianTradeRow[] = politician.trades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    transactionType: classifyTradeType(t.transactionType),
    transactionDate: dateKey(t.transactionDate),
    disclosureDate: dateKey(t.disclosureDate),
    amountRange: t.amountRangeRaw ?? formatAmountRange(t.amountMinCents, t.amountMaxCents),
    amountMinimum: minimumDollars(t.amountMinCents, t.amountMaxCents),
    assetDescription: t.assetDescription,
  }));

  // Compute stats
  let buyCount = 0;
  let sellCount = 0;
  let totalVolume = 0;
  let totalDelayDays = 0;
  const tickerSet = new Set<string>();

  for (const t of trades) {
    if (t.transactionType === "Buy") buyCount++;
    else if (t.transactionType === "Sell") sellCount++;
    totalVolume += t.amountMinimum;
    tickerSet.add(t.ticker);
    const txDate = new Date(`${t.transactionDate}T00:00:00Z`).getTime();
    const disDate = new Date(`${t.disclosureDate}T00:00:00Z`).getTime();
    totalDelayDays += Math.max(0, (disDate - txDate) / 86_400_000);
  }

  // trades is ordered disclosureDate desc, so trades[0]/trades[last] aren't
  // the min/max of transactionDate. Compute the real min/max so first/last
  // stay on the same axis (transactionDate) and tell a consistent story.
  // String comparison works because dateKey() produces "YYYY-MM-DD".
  let minTxDate: string | null = null;
  let maxTxDate: string | null = null;
  for (const t of trades) {
    if (minTxDate === null || t.transactionDate < minTxDate) minTxDate = t.transactionDate;
    if (maxTxDate === null || t.transactionDate > maxTxDate) maxTxDate = t.transactionDate;
  }

  const stats: PoliticianStats = {
    totalTrades: trades.length,
    totalVolume,
    buyCount,
    sellCount,
    uniqueTickers: tickerSet.size,
    avgDisclosureDelay: trades.length > 0 ? Math.round(totalDelayDays / trades.length) : 0,
    firstTradeDate: minTxDate,
    latestTradeDate: maxTxDate,
  };

  // Top tickers by volume
  const tickerMap = new Map<string, TickerConcentration>();
  for (const t of trades) {
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

  // Monthly activity
  const monthMap = new Map<string, { tradeCount: number; volume: number }>();
  for (const t of trades) {
    const month = t.disclosureDate.slice(0, 7);
    const existing = monthMap.get(month) ?? { tradeCount: 0, volume: 0 };
    existing.tradeCount++;
    existing.volume += t.amountMinimum;
    monthMap.set(month, existing);
  }
  const monthlyActivity: MonthlyActivity[] = [...monthMap.entries()]
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Sparkline (last 12 months)
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
