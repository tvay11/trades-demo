import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { db } from "@/lib/db";
import { revalidateCacheTag } from "@/lib/cache";
import { getDailyBars, getEarningsSnapshot } from "@/lib/yahoo/client";
import { getEdgarFundamentals } from "@/lib/queries/edgarFundamentals";
import { getPriceForecast } from "@/lib/queries/priceForecast";
import { getStockAnalysis } from "@/lib/queries/stockAnalysis";
import { buildLedger, houseCallInputsFromLedger } from "./buildLedger";
import { getAltFlow } from "@/lib/queries/altFlow";
import { buildHouseCall } from "./houseCall";
import { getStreetMomentum } from "@/lib/queries/streetMomentum";
import { generateLedgerNews } from "./news";
import { analystAnalysisToLegacyNote, generateAnalystAnalysis } from "@/lib/llm/deepseekAnalyst";
import { generateGeopolitical } from "./geopolitical";
import { generateFundamentalsInsight } from "./fundamentalsInsight";
import { generateLongTermPlay } from "./longTermPlay";
import { getMacroRegime } from "@/lib/queries/macroRegime";
import { getOptionsSignal } from "@/lib/queries/optionsSignals";
import { getMarketStats } from "@/lib/queries/marketStats";
import { getForecastHistory } from "@/lib/queries/forecastHistory";
import { evaluateForecastRuns } from "./forecastTrackRecord";
import { computeIvRank } from "./ivRank";
import { getIvHistory } from "@/lib/queries/ivHistory";
import { appendIvRankNote } from "./tradeLens";
import { generateRiskShift } from "./riskShift";
import { generateSegmentBreakdown } from "./segments";
import type { Ledger, LedgerInsiderTrade, LedgerOfficialTrade, SignalsSummary } from "./types";

const DAY = 86_400_000;

async function ensureTable(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS Report (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       ticker TEXT NOT NULL,
       generatedAt TEXT NOT NULL,
       payload TEXT NOT NULL
     )`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS Report_ticker_generatedAt_idx ON Report (ticker, generatedAt)`,
  );
}

export async function persistReport(ledger: Ledger): Promise<void> {
  await ensureTable();
  await db.report.create({
    data: { ticker: ledger.ticker, generatedAt: ledger.generatedAt, payload: JSON.stringify(ledger) },
  });
  revalidateCacheTag(`report:${ledger.ticker}`, "max");
}

export async function generateReport(tickerInput: string): Promise<{ ok: boolean; ticker: string; error?: string }> {
  const ticker = tickerInput.trim().toUpperCase();
  console.log(`[ledger] generateReport START ticker=${ticker}`);
  const to = new Date();
  const from = new Date(to.getTime() - 400 * DAY);

  let bars: BarPoint[] = [];
  try {
    const rows = await getDailyBars(ticker, from, to);
    bars = rows.map((b) => ({
      date: b.date.toISOString().slice(0, 10),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  } catch (error) {
    console.error("[generateReport] price load failed", error);
  }
  console.log(`[ledger] ${ticker}: fetched ${bars.length} price bars`);
  if (bars.length === 0) {
    console.error(`[ledger] ${ticker}: NO price bars — aborting report`);
    return { ok: false, ticker, error: "No price history available for this ticker." };
  }

  try {
    const [forecastRes, edgar, news, analysis, macro, options, marketStats, earningsSnap, forecastHistory, spyBarsRaw, altFlowData, ivHistory] = await Promise.all([
      getPriceForecast(ticker),
      getEdgarFundamentals(ticker),
      generateLedgerNews(ticker),
      getStockAnalysis(ticker).catch(() => null),
      getMacroRegime().catch(() => null),
      getOptionsSignal(ticker).catch(() => null),
      getMarketStats(ticker).catch(() => null),
      getEarningsSnapshot(ticker).catch(() => null),
      getForecastHistory(ticker).catch(() => []),
      getDailyBars("SPY", from, to).catch(() => []),
      getAltFlow(ticker).catch(() => null),
      getIvHistory(ticker).catch(() => []),
    ]);

    console.log(
      `[ledger] ${ticker}: forecast=${forecastRes ? forecastRes.points.length + " pts" : "NONE"} | edgar=${edgar ? "yes" : "NONE"} | news=${news.items.length} items (skew ${news.skew.toFixed(2)}) | signals=${analysis ? "yes" : "NONE"}`,
    );

    const signals: SignalsSummary | null = analysis
      ? {
          congressNetFlowLabel:
            analysis.detail.summary.buyCount > analysis.detail.summary.sellCount
              ? "Buying"
              : analysis.detail.summary.sellCount > analysis.detail.summary.buyCount
                ? "Selling"
                : "Balanced",
          congressTradeCount: analysis.detail.summary.tradeCount,
          insiderTradeCount: analysis.insiderTrades.length,
          thirteenFCount: analysis.sourceRows.holdings.length,
          govContractCount: analysis.sourceRows.govContracts.length,
        }
      : null;

    const officialTrades: LedgerOfficialTrade[] = analysis
      ? [...analysis.detail.congressTrades]
          .sort((a, b) => b.disclosureDate.getTime() - a.disclosureDate.getTime())
          .slice(0, 15)
          .map((t) => ({
            branch: t.branch,
            name: t.politicianName,
            party: t.party,
            state: t.state,
            agency: t.agency,
            action: t.action,
            transactionType: t.transactionType,
            amountMin: t.amountMin,
            amountMax: t.amountMax,
            amountRangeRaw: t.amountRangeRaw,
            transactionDate: t.transactionDate.toISOString().slice(0, 10),
            disclosureDate: t.disclosureDate.toISOString().slice(0, 10),
          }))
      : [];
    const insiderTrades: LedgerInsiderTrade[] = analysis
      ? analysis.insiderTrades.map((t) => ({
          name: t.insiderName,
          title: t.insiderTitle,
          action: t.action,
          transactionType: t.transactionType,
          shares: t.shares,
          pricePerShare: t.pricePerShare,
          totalValue: t.totalValue,
          transactionDate: t.transactionDate.toISOString().slice(0, 10),
          filingDate: t.filingDate ? t.filingDate.toISOString().slice(0, 10) : null,
        }))
      : [];
    console.log(`[ledger] ${ticker}: trades official=${officialTrades.length} insider=${insiderTrades.length}`);

    const spyBars = spyBarsRaw.map((b) => ({ date: b.date.toISOString().slice(0, 10), close: b.close }));

    const ledger: Ledger = buildLedger({
      ticker,
      companyName: analysis?.detail.stock.companyName ?? null,
      bars,
      forecast: forecastRes ? { points: forecastRes.points, horizonDays: forecastRes.meta.horizonDays, probUp: forecastRes.meta.probUp, expectedMovePct: forecastRes.meta.expectedMovePct } : null,
      fundamentals: edgar,
      news: news.items,
      signals,
      consensusTarget: null,
      officialTrades,
      insiderTrades,
      macro: macro ?? null,
      options: options ?? null,
      valuation: marketStats?.valuation ?? null,
      analyst: marketStats?.analyst ?? null,
      shortInterest: marketStats?.shortInterest ?? null,
      benchmarkBars: spyBars.length > 0 ? spyBars : null,
      altFlow: altFlowData ?? null,
    });

    // Forecast track record — evaluate past runs against realized bars
    ledger.forecastTrackRecord = forecastHistory.length > 0
      ? evaluateForecastRuns(
          forecastHistory,
          ledger.bars.map((b) => ({ date: b.date, close: b.close })),
        )
      : null;

    // IV rank — percentile of current ATM-IV vs own historical snapshots
    if (ledger.options?.atmIvPct != null) {
      ledger.options.ivRankPct = computeIvRank(ledger.options.atmIvPct, ivHistory);
    }

    // Map earnings snapshot → nextEarnings ledger field
    if (earningsSnap && earningsSnap.earningsDate != null) {
      const earningsDate = earningsSnap.earningsDate;
      ledger.nextEarnings = {
        date: earningsDate.toISOString().slice(0, 10),
        daysUntil: Math.round((earningsDate.getTime() - Date.now()) / 86400000),
        isEstimate: earningsSnap.isEstimate,
      };
    } else {
      ledger.nextEarnings = null;
    }

    ledger.streetMomentum = await getStreetMomentum(ticker, ledger.nextEarnings?.daysUntil ?? null).catch(() => null);
    if (ledger.streetMomentum) {
      ledger.houseCall = buildHouseCall({
        ...houseCallInputsFromLedger(ledger),
        street: {
          read: ledger.streetMomentum.read,
          peadActive: ledger.streetMomentum.pead.active,
          peadDirection: ledger.streetMomentum.pead.direction,
        },
      });
    }
    console.log(`[ledger] ${ticker}: street momentum ${ledger.streetMomentum ? ledger.streetMomentum.read : "unavailable"}`);
    console.log(`[ledger] ${ticker}: alt flow ${ledger.altFlow ? "available" : "unavailable"}`);

    // Append IV rank context to trade lens note when rank is extreme (<25 cheap, >75 rich)
    if (ledger.tradeLens && ledger.options?.ivRankPct != null) {
      ledger.tradeLens.note = appendIvRankNote(ledger.tradeLens.note, ledger.options.ivRankPct);
    }

    console.log(
      `[ledger] ${ticker}: houseCall=${ledger.houseCall.rating} | lastClose=${ledger.lastClose} | scorecardRows=${ledger.scorecard.length} | fundamentals=${ledger.fundamentals ? "yes" : "NONE"}`,
    );
    console.log(`[ledger] ${ticker}: macro regime ${ledger.macro ? ledger.macro.label + " score=" + ledger.macro.score : "unavailable"}`);
    console.log(`[ledger] ${ticker}: options signal ${ledger.options ? ledger.options.lean + " pcr=" + (ledger.options.putCallVolume?.toFixed(2) ?? "n/a") : "unavailable"}`);

    ledger.analystAnalysis = await generateAnalystAnalysis(ledger);
    ledger.analystNote = ledger.analystAnalysis ? analystAnalysisToLegacyNote(ledger.analystAnalysis) : null;
    console.log(`[ledger] ${ticker}: analyst analysis ${ledger.analystAnalysis ? "generated" : "skipped"}`);

    ledger.geopolitical = await generateGeopolitical(
      ticker,
      analysis?.detail.stock.companyName ?? null,
      analysis?.detail.stock.sector ?? null,
    );
    console.log(`[ledger] ${ticker}: geopolitical ${ledger.geopolitical ? "generated" : "skipped"}`);

    ledger.fundamentalsInsight = await generateFundamentalsInsight(ticker, ledger.companyName, ledger.fundamentals);
    console.log(`[ledger] ${ticker}: fundamentals insight ${ledger.fundamentalsInsight ? "generated" : "skipped"}`);

    ledger.riskShift = await generateRiskShift(ticker, ledger.companyName);
    console.log(`[ledger] ${ticker}: risk shift ${ledger.riskShift ? "generated" : "skipped"}`);
    ledger.segments = await generateSegmentBreakdown(ticker, ledger.companyName, ledger.fundamentals?.annual?.revenue ?? null);
    console.log(`[ledger] ${ticker}: segments ${ledger.segments ? ledger.segments.segments.length + " segs" : "skipped"}`);

    ledger.longTermPlay = await generateLongTermPlay(ledger, analysis);
    console.log(`[ledger] ${ticker}: long-term play ${ledger.longTermPlay ? `generated (${ledger.longTermPlay.drivers.length} driver charts)` : "skipped"}`);

    await persistReport(ledger);
    console.log(
      `[ledger] ${ticker}: report SAVED generatedAt=${ledger.generatedAt} payloadBytes=${JSON.stringify(ledger).length}`,
    );
    return { ok: true, ticker };
  } catch (error) {
    console.error(`[ledger] ${ticker}: report generation FAILED`, error);
    return { ok: false, ticker, error: error instanceof Error ? error.message : "Report generation failed." };
  }
}
