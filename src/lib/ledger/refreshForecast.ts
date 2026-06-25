import { buildLedger } from "./buildLedger";
import { getReport } from "./getReport";
import { persistReport } from "./generateReport";
import { getPriceForecast } from "@/lib/queries/priceForecast";
import { analystAnalysisToLegacyNote, generateAnalystAnalysis } from "@/lib/llm/deepseekAnalyst";

export async function refreshForecast(tickerInput: string): Promise<{ ok: boolean; ticker: string; error?: string }> {
  const ticker = tickerInput.trim().toUpperCase();
  try {
    const prev = await getReport(ticker);
    if (!prev) return { ok: false, ticker, error: "No existing report — use Create Report first." };

    const forecastRes = await getPriceForecast(ticker);
    if (!forecastRes || forecastRes.points.length === 0) {
      return {
        ok: false,
        ticker,
        error: "No forecast found yet — run the forecaster (Colab/local) for this ticker, then refresh.",
      };
    }

    // Rebuild forecast-derived parts from the SAME stored inputs + the new forecast.
    const rebuilt = buildLedger({
      ticker,
      companyName: prev.companyName,
      bars: prev.bars,
      forecast: { points: forecastRes.points, horizonDays: forecastRes.meta.horizonDays, probUp: forecastRes.meta.probUp, expectedMovePct: forecastRes.meta.expectedMovePct },
      fundamentals: prev.fundamentals,
      news: prev.news,
      signals: prev.signals,
      consensusTarget: prev.consensusTarget,
      officialTrades: prev.officialTrades,
      insiderTrades: prev.insiderTrades,
      macro: prev.macro,
      options: prev.options,
      valuation: prev.valuation,
      analyst: prev.analyst,
      shortInterest: prev.shortInterest,
    });
    rebuilt.analystAnalysis = await generateAnalystAnalysis(rebuilt);
    rebuilt.analystNote = rebuilt.analystAnalysis ? analystAnalysisToLegacyNote(rebuilt.analystAnalysis) : null;

    // Reuse the other expensive LLM outputs and cached data as-is; refresh only changes the forecast lens.
    rebuilt.geopolitical = prev.geopolitical;
    rebuilt.fundamentalsInsight = prev.fundamentalsInsight;
    rebuilt.longTermPlay = prev.longTermPlay;
    rebuilt.nextEarnings = prev.nextEarnings ?? null;

    await persistReport(rebuilt);
    console.log(
      `[refreshForecast] ${ticker}: forecast folded in (${forecastRes.points.length} pts), analyst analysis ${
        rebuilt.analystAnalysis ? "regenerated" : "skipped"
      }`,
    );
    return { ok: true, ticker };
  } catch (error) {
    console.error(`[refreshForecast] ${ticker} failed`, error);
    return { ok: false, ticker, error: error instanceof Error ? error.message : "Refresh failed." };
  }
}
