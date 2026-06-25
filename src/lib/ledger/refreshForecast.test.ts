// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateAnalystAnalysis, analystAnalysisToLegacyNote } from "@/lib/llm/deepseekAnalyst";
import { getPriceForecast } from "@/lib/queries/priceForecast";
import type { AnalystAnalysis, Ledger } from "./types";
import { getReport } from "./getReport";
import { persistReport } from "./generateReport";
import { refreshForecast } from "./refreshForecast";

vi.mock("./getReport", () => ({
  getReport: vi.fn(),
}));

vi.mock("./generateReport", () => ({
  persistReport: vi.fn(),
}));

vi.mock("@/lib/queries/priceForecast", () => ({
  getPriceForecast: vi.fn(),
}));

vi.mock("@/lib/llm/deepseekAnalyst", () => ({
  generateAnalystAnalysis: vi.fn(),
  analystAnalysisToLegacyNote: vi.fn(),
}));

function bars(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i * 0.5;
    return { date: "2026-01-01", open: close, high: close + 1, low: close - 1, close, volume: 1000 };
  });
}

const oldAnalysis: AnalystAnalysis = {
  schemaVersion: 1,
  headline: "Old no forecast analysis stays stale",
  thesis: "This old report was generated before forecast data existed, so it should be replaced on refresh.",
  lensReads: [],
  takeaways: [],
  keyTension: "Old report tension should not survive a refreshed forecast.",
  whatWouldChange: "Old report changes should not survive a refreshed forecast.",
};

const refreshedAnalysis: AnalystAnalysis = {
  schemaVersion: 1,
  headline: "Fresh analysis now reflects the forecast",
  thesis: "The refreshed report analysis uses the newly loaded forecast summary before it is saved.",
  lensReads: [],
  takeaways: [],
  keyTension: "The forecast adds a new directional input.",
  whatWouldChange: "A lower forecast path would weaken the refreshed analysis.",
};

const previousReport: Ledger = {
  ticker: "NVDA",
  companyName: "NVIDIA",
  generatedAt: "2026-06-01T00:00:00.000Z",
  lastClose: 229.5,
  scorecard: [],
  trendGrid: [],
  houseCall: {
    rating: "HOLD",
    drivers: [],
    watchTrigger: "Watch for fresh data.",
    synthesis: "Previous report had no forecast.",
    score: 0,
    contributions: [],
  },
  forecast: null,
  fundamentals: null,
  signals: null,
  news: [],
  newsSkew: 0,
  consensusTarget: null,
  bars: bars(260),
  forecastPoints: [],
  analystNote: "old note",
  analystAnalysis: oldAnalysis,
  geopolitical: {
    summary: "Existing geopolitical output should be reused.",
    netLean: "mixed",
    factors: [],
  },
  fundamentalsInsight: {
    schemaVersion: 1,
    interpretation: "Existing fundamentals output should be reused.",
    riskFactors: [],
  },
  officialTrades: [],
  insiderTrades: [],
  longTermPlay: null,
  macro: null,
  options: null,
  valuation: null,
  analyst: null,
  shortInterest: null,
  nextEarnings: null,
  tradeLens: null,
  forecastTrackRecord: null,
  streetMomentum: null,
  altFlow: null,
  riskShift: null,
  forensics: null,
  segments: null,
};

describe("refreshForecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reruns DeepSeek analyst analysis after folding in a new forecast", async () => {
    vi.mocked(getReport).mockResolvedValue(previousReport);
    vi.mocked(getPriceForecast).mockResolvedValue({
      points: [{ date: "2026-07-01", close: 260, lower: 240, upper: 280 }],
      meta: {
        model: "Kronos-base",
        sampleCount: 100,
        horizonDays: 30,
        generatedAt: "2026-06-02",
        probUp: null,
        expectedMovePct: null,
      },
    });
    vi.mocked(generateAnalystAnalysis).mockResolvedValue(refreshedAnalysis);
    vi.mocked(analystAnalysisToLegacyNote).mockReturnValue("fresh note");
    vi.mocked(persistReport).mockResolvedValue(undefined);

    const result = await refreshForecast("nvda");

    expect(result).toEqual({ ok: true, ticker: "NVDA" });
    expect(generateAnalystAnalysis).toHaveBeenCalledTimes(1);
    expect(generateAnalystAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      ticker: "NVDA",
      forecast: expect.objectContaining({
        predictedClose: 260,
        horizonDays: 30,
      }),
    }));
    expect(analystAnalysisToLegacyNote).toHaveBeenCalledWith(refreshedAnalysis);
    expect(persistReport).toHaveBeenCalledWith(expect.objectContaining({
      analystAnalysis: refreshedAnalysis,
      analystNote: "fresh note",
      geopolitical: previousReport.geopolitical,
      fundamentalsInsight: previousReport.fundamentalsInsight,
    }));
  });
});
