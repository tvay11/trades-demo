import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/money";
import {
  scoreCommitteeRelevance,
  type CommitteeContext,
} from "@/lib/committees/relevance";
import { safePercent, stockTradeFacts } from "./factMetrics";
import {
  shapeTickerCongressTrades,
  type RawTickerTrade,
  type TickerCongressTrade,
} from "./tickerDetail";

const EDGE_TRADE_LIMIT = 10_000;
const EDGE_ROW_LIMIT = 30;

export type EdgeTrade = TickerCongressTrade & {
  ticker: string;
  companyName: string | null;
  sector: string | null;
};

export type EdgeTickerFact = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  politicianCount: number;
  estimatedVolume: number;
  buyVolume: number;
  sellVolume: number;
  buyCountPercent: number;
  sellCountPercent: number;
  buyDollarPercent: number;
  sellDollarPercent: number;
  latestDisclosureDate: Date | null;
};

export type CommitteeLinkedFact = EdgeTickerFact & {
  committeeTradeCount: number;
  committeeTradePercent: number;
  topCommittees: string[];
};

export type DisclosureReturnFact = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  tradeCount: number;
  returnSampleSize: number;
  averageReturn7d: number | null;
  averageReturn30d: number | null;
  averageReturn90d: number | null;
  positiveReturn30dPercent: number;
  bestReturn30d: number | null;
  latestDisclosureDate: Date | null;
};

export type PoliticianTickerFact = {
  politicianName: string;
  party: string | null;
  state: string | null;
  ticker: string;
  companyName: string | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  estimatedVolume: number;
  latestDisclosureDate: Date | null;
};

export type TickerActivityFact = {
  id: string;
  ticker: string;
  companyName: string | null;
  politicianName: string;
  party: string | null;
  state: string | null;
  action: EdgeTrade["action"];
  amountMinimum: number;
  amountRangeRaw: string | null;
  transactionDate: Date;
  disclosureDate: Date;
  return30dFromDisclosure: number | null;
  committeeLabel: "High" | "Medium" | "Low";
};

export type EdgeFactsResult = {
  source: "database" | "empty";
  generatedAt: Date;
  tradeCount: number;
  mostBought: EdgeTickerFact[];
  mostSold: EdgeTickerFact[];
  committeeLinked: CommitteeLinkedFact[];
  bestDisclosureReturns: DisclosureReturnFact[];
  politiciansByTicker: PoliticianTickerFact[];
  tickerActivity: TickerActivityFact[];
};

export async function getEdgeFacts(): Promise<EdgeFactsResult> {
  "use cache";
  applyCacheLife("minutes");

  const tradeRows = await db.congressTrade.findMany({
    include: {
      politician: {
        include: {
          committees: {
            include: { committee: true },
          },
        },
      },
    },
    orderBy: { disclosureDate: "desc" },
    take: EDGE_TRADE_LIMIT,
  });

  if (!tradeRows.length) {
    return buildEdgeFacts([]);
  }

  const tickers = [...new Set(tradeRows.map((row) => row.ticker.toUpperCase()))];
  const [stocks, priceRows] = await Promise.all([
    db.stock.findMany({ where: { ticker: { in: tickers } } }),
    db.tickerPriceCache.findMany({
      where: { ticker: { in: tickers } },
      orderBy: [{ ticker: "asc" }, { date: "asc" }],
    }),
  ]);
  const stockByTicker = new Map(stocks.map((stock) => [stock.ticker.toUpperCase(), stock]));
  const pricesByTicker = new Map<string, Array<{ date: Date; close: number }>>();

  for (const row of priceRows) {
    const ticker = row.ticker.toUpperCase();
    const prices = pricesByTicker.get(ticker) ?? [];
    prices.push({ date: row.date, close: row.close / 100 });
    pricesByTicker.set(ticker, prices);
  }

  const rawByTicker = new Map<string, RawEdgeTrade[]>();
  for (const row of tradeRows) {
    const ticker = row.ticker.toUpperCase();
    const stock = stockByTicker.get(ticker);
    const committees = row.politician.committees.map<CommitteeContext>((assignment) => ({
      name: assignment.committee.name,
      role: assignment.role,
      isChair: assignment.isChair,
      isRanking: assignment.isRanking,
    }));
    const rawRows = rawByTicker.get(ticker) ?? [];

    rawRows.push({
      id: String(row.id),
      branch: "congress",
      ticker,
      companyName: stock?.companyName ?? row.assetDescription ?? null,
      sector: stock?.sector ?? null,
      industry: stock?.industry ?? null,
      politicianName: row.representative,
      party: row.party,
      state: row.state,
      agency: null,
      transactionType: row.transactionType,
      transactionDate: row.transactionDate,
      disclosureDate: row.disclosureDate,
      amountMin: centsToDollars(row.amountMinCents),
      amountMax: centsToDollars(row.amountMaxCents),
      amountRangeRaw: row.amountRangeRaw,
      committeeRelevance: scoreCommitteeRelevance({
        ticker,
        sector: stock?.sector,
        industry: stock?.industry,
        committees,
      }),
    });
    rawByTicker.set(ticker, rawRows);
  }

  const edgeTrades = [...rawByTicker.entries()].flatMap(([ticker, rows]) => {
    const shaped = shapeTickerCongressTrades(rows, pricesByTicker.get(ticker) ?? []);
    const rawById = new Map(rows.map((row) => [row.id, row]));

    return shaped.map<EdgeTrade>((trade) => {
      const raw = rawById.get(trade.id);

      return {
        ...trade,
        ticker,
        companyName: raw?.companyName ?? null,
        sector: raw?.sector ?? null,
      };
    });
  });

  return buildEdgeFacts(edgeTrades);
}

export function buildEdgeFacts(trades: EdgeTrade[], limit = EDGE_ROW_LIMIT): EdgeFactsResult {
  const tickerFacts = [...groupBy(trades, (trade) => trade.ticker).entries()].map(
    ([ticker, rows]) => summarizeTicker(ticker, rows),
  );
  const committeeLinked = tickerFacts
    .map((fact) => summarizeCommitteeTicker(fact, trades.filter((trade) => trade.ticker === fact.ticker)))
    .filter((fact): fact is CommitteeLinkedFact => fact !== null)
    .sort(
      (a, b) =>
        b.committeeTradeCount - a.committeeTradeCount ||
        b.estimatedVolume - a.estimatedVolume ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, limit);
  const bestDisclosureReturns = [...groupBy(trades, (trade) => trade.ticker).entries()]
    .map(([ticker, rows]) => summarizeDisclosureReturns(ticker, rows))
    .filter((fact): fact is DisclosureReturnFact => fact !== null)
    .sort(
      (a, b) =>
        (b.averageReturn30d ?? Number.NEGATIVE_INFINITY) -
          (a.averageReturn30d ?? Number.NEGATIVE_INFINITY) ||
        b.returnSampleSize - a.returnSampleSize ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, limit);

  return {
    source: trades.length ? "database" : "empty",
    generatedAt: new Date(),
    tradeCount: trades.length,
    mostBought: tickerFacts
      .filter((fact) => fact.buyCount > 0)
      .sort(
        (a, b) =>
          b.buyCount - a.buyCount ||
          b.buyVolume - a.buyVolume ||
          a.ticker.localeCompare(b.ticker),
      )
      .slice(0, limit),
    mostSold: tickerFacts
      .filter((fact) => fact.sellCount > 0)
      .sort(
        (a, b) =>
          b.sellCount - a.sellCount ||
          b.sellVolume - a.sellVolume ||
          a.ticker.localeCompare(b.ticker),
      )
      .slice(0, limit),
    committeeLinked,
    bestDisclosureReturns,
    politiciansByTicker: summarizePoliticiansByTicker(trades).slice(0, limit),
    tickerActivity: trades
      .map<TickerActivityFact>((trade) => ({
        id: trade.id,
        ticker: trade.ticker,
        companyName: trade.companyName,
        politicianName: trade.politicianName,
        party: trade.party,
        state: trade.state,
        action: trade.action,
        amountMinimum: trade.amountMinimum,
        amountRangeRaw: trade.amountRangeRaw,
        transactionDate: trade.transactionDate,
        disclosureDate: trade.disclosureDate,
        return30dFromDisclosure: trade.return30dFromDisclosure,
        committeeLabel: trade.committeeRelevance.label,
      }))
      .sort((a, b) => b.disclosureDate.getTime() - a.disclosureDate.getTime())
      .slice(0, limit),
  };
}

type RawEdgeTrade = RawTickerTrade & {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
};

function summarizeTicker(ticker: string, rows: EdgeTrade[]): EdgeTickerFact {
  const facts = stockTradeFacts(rows);
  const politicians = new Set(rows.map((trade) => trade.politicianName));

  return {
    ticker,
    companyName: firstText(rows.map((row) => row.companyName)),
    sector: firstText(rows.map((row) => row.sector)),
    tradeCount: facts.tradeCount,
    buyCount: facts.buyCount,
    sellCount: facts.sellCount,
    politicianCount: politicians.size,
    estimatedVolume: facts.estimatedVolume,
    buyVolume: facts.buyVolume,
    sellVolume: facts.sellVolume,
    buyCountPercent: facts.buyCountPercent,
    sellCountPercent: facts.sellCountPercent,
    buyDollarPercent: facts.buyDollarPercent,
    sellDollarPercent: facts.sellDollarPercent,
    latestDisclosureDate: maxDate(rows.map((row) => row.disclosureDate)),
  };
}

function summarizeCommitteeTicker(
  fact: EdgeTickerFact,
  rows: EdgeTrade[],
): CommitteeLinkedFact | null {
  const relevantRows = rows.filter((row) => row.committeeRelevance.label !== "Low");
  if (!relevantRows.length) return null;

  return {
    ...fact,
    committeeTradeCount: relevantRows.length,
    committeeTradePercent: safePercent(relevantRows.length, rows.length),
    topCommittees: topStrings(relevantRows.flatMap((row) => row.committeeRelevance.matches), 4),
  };
}

function summarizeDisclosureReturns(
  ticker: string,
  rows: EdgeTrade[],
): DisclosureReturnFact | null {
  const returnRows = rows.filter((row) => row.return30dFromDisclosure != null);
  if (!returnRows.length) return null;

  const facts = stockTradeFacts(rows);
  const returns30d = returnRows.map((row) => Number(row.return30dFromDisclosure));

  return {
    ticker,
    companyName: firstText(rows.map((row) => row.companyName)),
    sector: firstText(rows.map((row) => row.sector)),
    tradeCount: rows.length,
    returnSampleSize: returnRows.length,
    averageReturn7d: facts.averageReturn7d,
    averageReturn30d: facts.averageReturn30d,
    averageReturn90d: facts.averageReturn90d,
    positiveReturn30dPercent: facts.positiveReturn30dPercent,
    bestReturn30d: Math.max(...returns30d),
    latestDisclosureDate: maxDate(rows.map((row) => row.disclosureDate)),
  };
}

function summarizePoliticiansByTicker(trades: EdgeTrade[]): PoliticianTickerFact[] {
  return [...groupBy(trades, (trade) => `${trade.politicianName}\u0000${trade.ticker}`).entries()]
    .map(([, rows]) => {
      const facts = stockTradeFacts(rows);
      const first = rows[0];

      return {
        politicianName: first.politicianName,
        party: first.party,
        state: first.state,
        ticker: first.ticker,
        companyName: first.companyName,
        tradeCount: rows.length,
        buyCount: facts.buyCount,
        sellCount: facts.sellCount,
        estimatedVolume: facts.estimatedVolume,
        latestDisclosureDate: maxDate(rows.map((row) => row.disclosureDate)),
      };
    })
    .sort(
      (a, b) =>
        b.tradeCount - a.tradeCount ||
        b.estimatedVolume - a.estimatedVolume ||
        a.politicianName.localeCompare(b.politicianName),
    );
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const key = keyFor(row);
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }

  return grouped;
}

function topStrings(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function maxDate(values: Date[]) {
  if (!values.length) return null;
  return values.reduce((latest, value) => (value > latest ? value : latest), values[0]);
}

function firstText(values: Array<string | null>) {
  return values.find((value): value is string => Boolean(value)) ?? null;
}
