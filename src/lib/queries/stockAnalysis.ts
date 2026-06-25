import type { TradeOverlay } from "@/components/charts/TickerPriceChart";
import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/money";
import { getEarningsEvent, type EarningsEvent } from "@/lib/queries/earnings";
import { classifyAction } from "@/lib/trades/classify";
import { getTickerDetail, type TickerCongressTrade, type TickerDetail } from "./tickerDetail";

export type PoliticianActivity = {
  politicianName: string;
  party: string | null;
  state: string | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  otherCount: number;
  totalEstimatedVolume: number;
  averageReturn: number | null;
  latestDisclosureDate: Date;
  netFlowLabel: "Buying" | "Selling" | "Balanced";
};

export type SignalScoreInput = {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  estimatedVolume: number;
  alternativeCounts: Record<string, number>;
  politicalBeta: number | null;
};

export type SignalComponent = {
  label: string;
  value: number;
  max: number;
};

export type SignalScore = {
  score: number;
  rating: "Quiet" | "Active" | "Elevated";
  components: SignalComponent[];
};

export type AnalysisTimelineEvent = {
  id: string;
  date: Date;
  label: string;
  detail: string;
  source: string;
  tone: "buy" | "sell" | "neutral" | "positive";
  value: number | null;
};

export type StockInsiderTrade = {
  id: number;
  insiderName: string;
  insiderTitle: string | null;
  transactionType: string;
  action: "buy" | "sell" | "other";
  transactionDate: Date;
  filingDate: Date | null;
  shares: number | null;
  pricePerShare: number | null;
  totalValue: number | null;
  sharesOwnedAfter: number | null;
};

export type StockInsiderTradeRow = {
  id: number;
  insiderName: string;
  insiderTitle: string | null;
  transactionType: string;
  transactionDate: Date;
  filingDate: Date | null;
  shares: number | null;
  pricePerShareCents: number | null;
  totalValueCents: bigint | number | null;
  sharesOwnedAfter: number | null;
};

export type StockLobbyingRow = {
  id: number;
  client: string;
  registrant: string;
  amount: number | null;
  filingPeriod: string;
  issue: string | null;
  filedAt: Date | null;
};

export type StockGovContractRow = {
  id: number;
  agency: string | null;
  description: string | null;
  amount: number | null;
  awardedAt: Date | null;
  contractId: string | null;
};

export type StockPatentRow = {
  id: number;
  patentNumber: string | null;
  title: string | null;
  effectiveDate: Date | null;
  filedAt: Date | null;
  grantedAt: Date | null;
  inventors: string | null;
};

export type StockHoldingRow = {
  id: number;
  filer: string;
  shares: number | null;
  value: number | null;
  filingDate: Date;
  reportDate: Date;
  changeShares: number | null;
};

export type StockOffExchangeRow = {
  id: number;
  date: Date;
  shortVolume: number | null;
  totalVolume: number | null;
  shortVolumePercent: number | null;
  darkPoolPercent: number | null;
};

export type StockAttentionRow = {
  id: string;
  source: "WSB" | "Twitter" | "Wikipedia";
  date: Date;
  count: number;
  detail: string | null;
};

export type StockPoliticalBetaRow = {
  id: number;
  beta: number;
  asOfDate: Date | null;
};

export type StockSourceRows = {
  lobbying: StockLobbyingRow[];
  govContracts: StockGovContractRow[];
  patents: StockPatentRow[];
  holdings: StockHoldingRow[];
  offExchange: StockOffExchangeRow[];
  attention: StockAttentionRow[];
  politicalBeta: StockPoliticalBetaRow[];
};

export type StockSourceInput = {
  lobbyingRows: Array<{
    id: number;
    client: string;
    registrant: string;
    amountCents: bigint | number | null;
    filingYear: number;
    filingQuarter: number | null;
    issues: string | null;
    filedAt: Date | null;
  }>;
  govContractRows: Array<{
    id: number;
    agency: string | null;
    description: string | null;
    amountCents: bigint | number | null;
    awardedAt: Date | null;
    contractId: string | null;
  }>;
  patentRows: Array<{
    id: number;
    patentNumber: string | null;
    title: string | null;
    filedAt: Date | null;
    grantedAt: Date | null;
    inventors: string | null;
  }>;
  thirteenFRows: Array<{
    id: number;
    filer: string;
    shares: number | null;
    valueCents: bigint | number | null;
    filingDate: Date;
    reportDate: Date;
    changeShares: number | null;
  }>;
  offExchangeRows: Array<{
    id: number;
    date: Date;
    shortVolume: number | null;
    totalVolume: number | null;
    shortVolumePercent: number | null;
    darkPoolPercent: number | null;
  }>;
  wsbRows: Array<{
    id: number;
    date: Date;
    mentions: number;
    sentiment: number | null;
  }>;
  twitterRows: Array<{
    id: number;
    date: Date;
    mentions: number;
    sentiment: number | null;
    followers: number | null;
  }>;
  wikipediaRows: Array<{
    id: number;
    date: Date;
    views: number;
  }>;
  betaRows: Array<{
    id: number;
    beta: number;
    asOfDate: Date | null;
  }>;
};

export type StockAnalysis = {
  detail: TickerDetail;
  signal: SignalScore;
  politicianLeaders: PoliticianActivity[];
  insiderTrades: StockInsiderTrade[];
  sourceRows: StockSourceRows;
  timeline: AnalysisTimelineEvent[];
  politicalBeta: number | null;
  overlays: TradeOverlay[];
  earnings: EarningsEvent | null;
};

export function rankPoliticianActivity(trades: TickerCongressTrade[]): PoliticianActivity[] {
  const grouped = new Map<string, TickerCongressTrade[]>();

  for (const trade of trades) {
    const rows = grouped.get(trade.politicianName) ?? [];
    rows.push(trade);
    grouped.set(trade.politicianName, rows);
  }

  return [...grouped.entries()]
    .map(([politicianName, rows]) => {
      const buyCount = rows.filter((row) => row.action === "buy").length;
      const sellCount = rows.filter((row) => row.action === "sell").length;
      const returns = rows
        .map((row) => row.return30dFromDisclosure)
        .filter((value): value is number => value !== null);

      return {
        politicianName,
        party: rows[0]?.party ?? null,
        state: rows[0]?.state ?? null,
        tradeCount: rows.length,
        buyCount,
        sellCount,
        otherCount: rows.length - buyCount - sellCount,
        totalEstimatedVolume: rows.reduce((sum, row) => sum + row.amountMinimum, 0),
        averageReturn: returns.length
          ? Number((returns.reduce((sum, value) => sum + value, 0) / returns.length).toFixed(2))
          : null,
        latestDisclosureDate: rows.reduce(
          (latest, row) => (row.disclosureDate > latest ? row.disclosureDate : latest),
          rows[0]?.disclosureDate ?? new Date(0),
        ),
        netFlowLabel:
          buyCount > sellCount ? "Buying" : sellCount > buyCount ? "Selling" : "Balanced",
      } satisfies PoliticianActivity;
    })
    .sort((a, b) => b.totalEstimatedVolume - a.totalEstimatedVolume)
    .slice(0, 10);
}

export function calculateSignalScore(input: SignalScoreInput): SignalScore {
  const altActiveSources = Object.values(input.alternativeCounts).filter((count) => count > 0).length;
  const socialCount =
    (input.alternativeCounts["Social mentions"] ?? 0) +
    (input.alternativeCounts["Wikipedia views"] ?? 0);
  const institutionCount =
    (input.alternativeCounts["Insider trades"] ?? 0) +
    (input.alternativeCounts["13F holdings"] ?? 0) +
    (input.alternativeCounts["Gov contracts"] ?? 0);

  const congressFlow = clamp(
    input.tradeCount * 2.2 +
      Math.max(0, input.buyCount - input.sellCount) * 3.4 +
      Math.log10(input.estimatedVolume + 1) * 4,
    0,
    35,
  );
  const alternativeBreadth = clamp(altActiveSources * 4.2, 0, 25);
  const attention = clamp(Math.log10(socialCount + 1) * 5, 0, 15);
  const institution = clamp(institutionCount * 2.8, 0, 15);
  const political = clamp(Math.abs(input.politicalBeta ?? 0) * 7, 0, 10);

  const components = [
    { label: "Congress flow", value: round(congressFlow), max: 35 },
    { label: "Alt-data breadth", value: round(alternativeBreadth), max: 25 },
    { label: "Attention", value: round(attention), max: 15 },
    { label: "Institutional / insider", value: round(institution), max: 15 },
    { label: "Political beta", value: round(political), max: 10 },
  ];
  const score = Math.min(100, Math.round(components.reduce((sum, row) => sum + row.value, 0)));

  return {
    score,
    rating: score >= 75 ? "Elevated" : score >= 35 ? "Active" : "Quiet",
    components,
  };
}

export function shapeStockInsiderTrades(rows: StockInsiderTradeRow[]): StockInsiderTrade[] {
  return rows.map((row) => ({
    id: row.id,
    insiderName: row.insiderName,
    insiderTitle: row.insiderTitle,
    transactionType: row.transactionType,
    action: classifyAction(row.transactionType),
    transactionDate: row.transactionDate,
    filingDate: row.filingDate,
    shares: row.shares,
    pricePerShare: centsToDollars(row.pricePerShareCents),
    totalValue: centsToDollars(row.totalValueCents),
    sharesOwnedAfter: row.sharesOwnedAfter,
  }));
}

export function emptyStockSourceRows(): StockSourceRows {
  return {
    lobbying: [],
    govContracts: [],
    patents: [],
    holdings: [],
    offExchange: [],
    attention: [],
    politicalBeta: [],
  };
}

export function shapeStockSourceRows(input: StockSourceInput): StockSourceRows {
  return {
    lobbying: input.lobbyingRows.map((row) => ({
      id: row.id,
      client: row.client,
      registrant: row.registrant,
      amount: centsToDollars(row.amountCents),
      filingPeriod:
        row.filingQuarter == null ? String(row.filingYear) : `${row.filingYear} Q${row.filingQuarter}`,
      issue: row.issues,
      filedAt: row.filedAt,
    })),
    govContracts: input.govContractRows.map((row) => ({
      id: row.id,
      agency: row.agency,
      description: row.description,
      amount: centsToDollars(row.amountCents),
      awardedAt: row.awardedAt,
      contractId: row.contractId,
    })),
    patents: input.patentRows.map((row) => ({
      id: row.id,
      patentNumber: row.patentNumber,
      title: row.title,
      effectiveDate: row.grantedAt ?? row.filedAt,
      filedAt: row.filedAt,
      grantedAt: row.grantedAt,
      inventors: row.inventors,
    })),
    holdings: input.thirteenFRows.map((row) => ({
      id: row.id,
      filer: row.filer,
      shares: row.shares,
      value: centsToDollars(row.valueCents),
      filingDate: row.filingDate,
      reportDate: row.reportDate,
      changeShares: row.changeShares,
    })),
    offExchange: input.offExchangeRows.map((row) => ({
      id: row.id,
      date: row.date,
      shortVolume: row.shortVolume,
      totalVolume: row.totalVolume,
      shortVolumePercent: row.shortVolumePercent,
      darkPoolPercent: row.darkPoolPercent,
    })),
    attention: [
      ...input.wsbRows.map<StockAttentionRow>((row) => ({
        id: `wsb-${row.id}`,
        source: "WSB",
        date: row.date,
        count: row.mentions,
        detail: row.sentiment == null ? null : `sentiment ${row.sentiment.toFixed(2)}`,
      })),
      ...input.twitterRows.map<StockAttentionRow>((row) => ({
        id: `twitter-${row.id}`,
        source: "Twitter",
        date: row.date,
        count: row.mentions,
        detail: row.followers == null ? null : `${row.followers.toLocaleString()} followers`,
      })),
      ...input.wikipediaRows.map<StockAttentionRow>((row) => ({
        id: `wiki-${row.id}`,
        source: "Wikipedia",
        date: row.date,
        count: row.views,
        detail: "views",
      })),
    ],
    politicalBeta: input.betaRows.map((row) => ({
      id: row.id,
      beta: row.beta,
      asOfDate: row.asOfDate,
    })),
  };
}

export async function getStockAnalysis(symbolParam: string): Promise<StockAnalysis> {
  "use cache";
  applyCacheLife("minutes");

  const detail = await getTickerDetail(symbolParam);
  const symbol = detail.stock.ticker;

  try {
    const [
      insiderRows,
      lobbyingRows,
      govContractRows,
      patentRows,
      thirteenFRows,
      offExchangeRows,
      wsbRows,
      twitterRows,
      wikipediaRows,
      betaRows,
      earnings,
    ] = await Promise.all([
      db.insiderTrade.findMany({
        where: { ticker: symbol },
        orderBy: { transactionDate: "desc" },
        take: 5,
      }),
      db.lobbyingDisclosure.findMany({
        where: { ticker: symbol },
        orderBy: [{ filingYear: "desc" }, { filingQuarter: "desc" }],
        take: 5,
      }),
      db.govContract.findMany({
        where: { ticker: symbol },
        orderBy: { awardedAt: "desc" },
        take: 5,
      }),
      db.patent.findMany({
        where: { ticker: symbol },
        orderBy: { filedAt: "desc" },
        take: 5,
      }),
      db.thirteenFHolding.findMany({
        where: { ticker: symbol },
        orderBy: { reportDate: "desc" },
        take: 5,
      }),
      db.offExchangeActivity.findMany({
        where: { ticker: symbol },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.wsbMention.findMany({
        where: { ticker: symbol },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.twitterMention.findMany({
        where: { ticker: symbol },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.wikipediaView.findMany({
        where: { ticker: symbol },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.politicalBeta.findMany({
        where: { ticker: symbol },
        orderBy: { asOfDate: "desc" },
        take: 1,
      }),
      getEarningsEvent(symbol),
    ]);
    const politicalBeta = betaRows[0]?.beta ?? null;
    const alternativeCounts = Object.fromEntries(
      detail.alternativeData.map((row) => [row.label, row.count]),
    );
    const insiderTrades = shapeStockInsiderTrades(insiderRows);
    const sourceRows = shapeStockSourceRows({
      lobbyingRows,
      govContractRows,
      patentRows,
      thirteenFRows,
      offExchangeRows,
      wsbRows,
      twitterRows,
      wikipediaRows,
      betaRows,
    });

    return {
      detail,
      signal: calculateSignalScore({
        ...detail.summary,
        alternativeCounts,
        politicalBeta,
      }),
      politicianLeaders: rankPoliticianActivity(detail.congressTrades),
      insiderTrades,
      sourceRows,
      timeline: buildTimeline([
        ...detail.congressTrades.slice(0, 12).map<AnalysisTimelineEvent>((trade) => ({
          id: `congress-${trade.id}`,
          date: trade.disclosureDate,
          label: `${trade.politicianName} filed ${trade.action === "sell" ? "sale" : trade.action === "buy" ? "purchase" : "disclosure"} ${symbol}`,
          detail: trade.amountRangeRaw ?? `$${Math.round(trade.amountMinimum).toLocaleString()}`,
          source: "Congress",
          tone:
            (trade.action === "buy"
              ? "buy"
              : trade.action === "sell"
                ? "sell"
                : "neutral") satisfies AnalysisTimelineEvent["tone"],
          value: trade.amountMinimum,
        })),
        ...insiderTrades.map<AnalysisTimelineEvent>((trade) => ({
          id: `insider-${trade.id}`,
          date: trade.filingDate ?? trade.transactionDate,
          label: `${trade.insiderName} ${trade.transactionType}`,
          detail: trade.insiderTitle ?? "Corporate insider disclosure",
          source: "Insider",
          tone: (trade.action === "sell"
            ? "sell"
            : trade.action === "buy"
              ? "buy"
              : "positive") satisfies AnalysisTimelineEvent["tone"],
          value: trade.totalValue,
        })),
        ...lobbyingRows.map<AnalysisTimelineEvent>((row) => ({
          id: `lobbying-${row.id}`,
          date: row.filedAt ?? new Date(Date.UTC(row.filingYear, ((row.filingQuarter ?? 1) - 1) * 3)),
          label: `${row.client} lobbying disclosure`,
          detail: row.issues ?? row.registrant,
          source: "Lobbying",
          tone: "neutral" as const,
          value: centsToDollars(row.amountCents),
        })),
        ...govContractRows
          .filter((row) => row.awardedAt)
          .map<AnalysisTimelineEvent>((row) => ({
            id: `contract-${row.id}`,
            date: row.awardedAt as Date,
            label: row.agency ?? "Government contract",
            detail: row.description ?? row.contractId ?? "Federal award",
            source: "Contracts",
            tone: "positive" as const,
            value: centsToDollars(row.amountCents),
          })),
        ...patentRows
          .filter((row) => row.filedAt ?? row.grantedAt)
          .map<AnalysisTimelineEvent>((row) => ({
            id: `patent-${row.id}`,
            date: (row.grantedAt ?? row.filedAt) as Date,
            label: row.title ?? row.patentNumber ?? "Patent activity",
            detail: row.inventors ?? "Patent filing/grant",
            source: "Patents",
            tone: "positive" as const,
            value: null,
          })),
        ...thirteenFRows.map<AnalysisTimelineEvent>((row) => ({
          id: `13f-${row.id}`,
          date: row.reportDate,
          label: `${row.filer} 13F holding`,
          detail: `${(row.shares ?? 0).toLocaleString()} shares`,
          source: "13F",
          tone: ((row.changeShares ?? 0) >= 0
            ? "positive"
            : "sell") satisfies AnalysisTimelineEvent["tone"],
          value: centsToDollars(row.valueCents),
        })),
        ...offExchangeRows.map<AnalysisTimelineEvent>((row) => ({
          id: `off-${row.id}`,
          date: row.date,
          label: "Off-exchange activity",
          detail: `${row.shortVolumePercent?.toFixed(2) ?? "-"}% short volume`,
          source: "Dark pool",
          tone: "neutral" as const,
          value: row.totalVolume ?? null,
        })),
        ...wsbRows.map<AnalysisTimelineEvent>((row) => ({
          id: `wsb-${row.id}`,
          date: row.date,
          label: "WallStreetBets attention",
          detail: `${row.mentions.toLocaleString()} mentions`,
          source: "WSB",
          tone: "neutral" as const,
          value: row.mentions,
        })),
        ...twitterRows.map<AnalysisTimelineEvent>((row) => ({
          id: `twitter-${row.id}`,
          date: row.date,
          label: "Twitter attention",
          detail: `${row.mentions.toLocaleString()} mentions`,
          source: "Twitter",
          tone: "neutral" as const,
          value: row.mentions,
        })),
        ...wikipediaRows.map<AnalysisTimelineEvent>((row) => ({
          id: `wiki-${row.id}`,
          date: row.date,
          label: "Wikipedia attention",
          detail: `${row.views.toLocaleString()} views`,
          source: "Wikipedia",
          tone: "neutral" as const,
          value: row.views,
        })),
      ]),
      politicalBeta,
      overlays: detail.overlays,
      earnings,
    };
  } catch {
    const alternativeCounts = Object.fromEntries(
      detail.alternativeData.map((row) => [row.label, row.count]),
    );

    return {
      detail,
      signal: calculateSignalScore({
        ...detail.summary,
        alternativeCounts,
        politicalBeta: null,
      }),
      politicianLeaders: rankPoliticianActivity(detail.congressTrades),
      insiderTrades: [],
      sourceRows: emptyStockSourceRows(),
      timeline: buildTimeline(
        detail.congressTrades.slice(0, 12).map<AnalysisTimelineEvent>((trade) => ({
          id: `congress-${trade.id}`,
          date: trade.disclosureDate,
          label: `${trade.politicianName} filed ${trade.action} ${symbol}`,
          detail: trade.amountRangeRaw ?? `$${Math.round(trade.amountMinimum).toLocaleString()}`,
          source: "Congress",
          tone: (trade.action === "buy"
            ? "buy"
            : trade.action === "sell"
              ? "sell"
              : "neutral") satisfies AnalysisTimelineEvent["tone"],
          value: trade.amountMinimum,
        })),
      ),
      politicalBeta: null,
      overlays: detail.overlays,
      earnings: null,
    };
  }
}

function buildTimeline(events: AnalysisTimelineEvent[]) {
  return events
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 28);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value);
}
