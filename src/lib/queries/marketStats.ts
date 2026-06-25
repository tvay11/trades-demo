import { applyCacheLife } from "@/lib/cache";
import YahooFinance from "yahoo-finance2";
import type { AnalystConsensus, MarketStats, ShortInterest, Valuation, ValuationRead } from "@/lib/ledger/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ── helper ────────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return null; // some Yahoo SDK fields deserialize as Date erroneously
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── types for raw Yahoo module shapes ─────────────────────────────────────────

interface YahooSummaryDetail {
  trailingPE?: number | null;
  forwardPE?: number | null;
  priceToSalesTrailing12Months?: number | null;
  previousClose?: number | null;
}

interface YahooKeyStats {
  priceToBook?: number | null;
  pegRatio?: number | null;
  enterpriseToEbitda?: number | null;
  sharesShort?: number | null;
  shortRatio?: number | null;
  shortPercentOfFloat?: number | null;
  // NOTE: sharesShortPriorMonth returns as a Date object due to a Yahoo SDK parsing quirk.
  // It is treated as null since the value cannot be reliably interpreted as a share count.
  sharesShortPriorMonth?: unknown;
  [key: string]: unknown;
}

interface YahooFinancialData {
  targetMeanPrice?: number | null;
  targetHighPrice?: number | null;
  targetLowPrice?: number | null;
  numberOfAnalystOpinions?: number | null;
  recommendationKey?: string | null;
  recommendationMean?: number | null;
  currentPrice?: number | null;
}

interface YahooRecommendationTrendPeriod {
  period?: string | null;
  strongBuy?: number | null;
  buy?: number | null;
  hold?: number | null;
  sell?: number | null;
  strongSell?: number | null;
}

interface YahooRecommendationTrend {
  trend?: YahooRecommendationTrendPeriod[] | null;
}

// ── pure shapers (exported for unit tests) ────────────────────────────────────

export function shapeValuation(
  summaryDetail: Partial<YahooSummaryDetail>,
  keyStats: Partial<YahooKeyStats>,
  _lastClose: number | null,
): Valuation {
  const peTrailing = num(summaryDetail.trailingPE);
  const peForward = num(summaryDetail.forwardPE);
  const priceToSales = num(summaryDetail.priceToSalesTrailing12Months);
  const priceToBook = num(keyStats.priceToBook);
  const pegRatio = num(keyStats.pegRatio);
  const evToEbitda = num(keyStats.enterpriseToEbitda);

  let read: ValuationRead;
  if (peTrailing == null) {
    read = "unknown";
  } else if (peTrailing > 60) {
    read = "expensive";
  } else if (peTrailing < 15) {
    read = "cheap";
  } else {
    read = "fair";
  }

  return { peTrailing, peForward, priceToSales, priceToBook, pegRatio, evToEbitda, read };
}

export function shapeAnalyst(
  financialData: Partial<YahooFinancialData>,
  recommendationTrend: Partial<YahooRecommendationTrend>,
  lastClose: number | null,
): AnalystConsensus {
  const targetMean = num(financialData.targetMeanPrice);
  const targetHigh = num(financialData.targetHighPrice);
  const targetLow = num(financialData.targetLowPrice);
  const numAnalysts = num(financialData.numberOfAnalystOpinions);
  const recommendationKey = typeof financialData.recommendationKey === "string" ? financialData.recommendationKey : null;
  const recommendationMean = num(financialData.recommendationMean);
  const upsidePct =
    targetMean != null && lastClose != null && lastClose !== 0
      ? (targetMean / lastClose - 1) * 100
      : null;

  const t0 = recommendationTrend.trend?.[0];
  const counts =
    t0 != null
      ? {
          strongBuy: num(t0.strongBuy) ?? 0,
          buy: num(t0.buy) ?? 0,
          hold: num(t0.hold) ?? 0,
          sell: num(t0.sell) ?? 0,
          strongSell: num(t0.strongSell) ?? 0,
        }
      : null;

  return { targetMean, targetHigh, targetLow, numAnalysts, recommendationKey, recommendationMean, upsidePct, counts };
}

export function shapeShortInterest(keyStats: Partial<YahooKeyStats>): ShortInterest {
  const sharesShort = num(keyStats.sharesShort);
  // shortPercentOfFloat is a raw ratio (e.g. 0.0095 = 0.95%) — multiply by 100 for percentage
  const rawPct = num(keyStats.shortPercentOfFloat);
  const percentOfFloat = rawPct != null ? rawPct * 100 : null;
  const daysToCover = num(keyStats.shortRatio);
  // sharesShortPriorMonth returns as a Date in the Yahoo SDK due to a parsing bug — treat as null
  const priorSharesShort = null;
  const changePct =
    sharesShort != null && priorSharesShort != null && (priorSharesShort as number) !== 0
      ? ((sharesShort - (priorSharesShort as number)) / (priorSharesShort as number)) * 100
      : null;

  return { sharesShort, percentOfFloat, daysToCover, priorSharesShort, changePct };
}

// ── fetcher ───────────────────────────────────────────────────────────────────

export async function getMarketStats(ticker: string): Promise<MarketStats | null> {
  "use cache";
  applyCacheLife("hours");
  try {
    const result = (await yahooFinance.quoteSummary(ticker, {
      modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "recommendationTrend"],
    })) as {
      summaryDetail?: YahooSummaryDetail;
      defaultKeyStatistics?: YahooKeyStats;
      financialData?: YahooFinancialData;
      recommendationTrend?: YahooRecommendationTrend;
    };

    const sd = result.summaryDetail ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};
    const rt = result.recommendationTrend ?? {};

    // Use currentPrice as the last-close proxy for upside calculation
    const lastClose = num(fd.currentPrice) ?? num(sd.previousClose);

    const valuation = shapeValuation(sd, ks, lastClose);
    const analyst = shapeAnalyst(fd, rt, lastClose);
    const shortInterest = shapeShortInterest(ks);

    return { valuation, analyst, shortInterest };
  } catch (e) {
    console.error(`[marketStats] quoteSummary failed for ${ticker}:`, (e as Error).message);
    return null;
  }
}
