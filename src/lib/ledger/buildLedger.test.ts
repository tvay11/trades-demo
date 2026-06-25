import { describe, expect, it } from "vitest";

import { assessForecastSuspect, buildLedger, houseCallInputsFromLedger } from "./buildLedger";
import { buildHouseCall } from "./houseCall";
import type { LedgerInputs } from "./types";
import type { BarPoint } from "@/components/charts/TickerPriceChart";

function bars(n: number): BarPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i * 0.5;
    return { date: `2026-01-01`, open: close, high: close + 1, low: close - 1, close, volume: 1000 };
  });
}

const base: LedgerInputs = {
  ticker: "NVDA",
  companyName: "NVIDIA",
  bars: bars(260),
  forecast: { points: [{ date: "2026-07-01", close: 90, lower: 80, upper: 100 }], horizonDays: 30 },
  fundamentals: {
    annual: { fiscalLabel: "FY2026", periodEnd: "2026-01-25", form: "10-K", revenue: 215_938_000_000, revenueYoYPct: 40, grossMarginPct: 70, netIncome: 120_067_000_000, netIncomeYoYPct: 64, dilutedEps: 4.9 },
    quarter: { fiscalLabel: "Q1 FY2027", periodEnd: "2026-04-26", form: "10-Q", revenue: 81_615_000_000, revenueYoYPct: 43, grossMarginPct: 75, netIncome: 58_321_000_000, netIncomeYoYPct: 83, dilutedEps: 2.39 },
  },
  news: [{ title: "x", publisher: "CNBC", url: "u", publishedAt: null, summary: "s", sentiment: "bullish", score: 0.8 }],
  signals: { congressNetFlowLabel: "Buying", congressTradeCount: 5, insiderTradeCount: 2, thirteenFCount: 3, govContractCount: 1 },
  consensusTarget: 305,
};

describe("buildLedger", () => {
  it("assembles a complete ledger with all sections present", () => {
    const led = buildLedger(base);
    expect(led.ticker).toBe("NVDA");
    // 6 technical rows + 2 momentum rows (12-1 momentum, 52w high distance) from 260 bars; no RS (no benchmarkBars)
    expect(led.scorecard).toHaveLength(8);
    expect(led.trendGrid).toHaveLength(6);
    expect(["BUY", "SELL", "HOLD"]).toContain(led.houseCall.rating);
    expect(led.forecast?.predictedClose).toBe(90);
    expect(led.forecast?.confidence).toBeDefined();
    expect(led.newsSkew).toBeCloseTo(1, 6);
    expect(led.bars.length).toBeLessThanOrEqual(260);
    expect(led.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("derives confidence band from the forecast spread", () => {
    const led = buildLedger(base);
    expect(led.forecast?.confidence).toBe("WIDE");
  });

  it("degrades: no forecast / fundamentals / news still builds", () => {
    const led = buildLedger({ ...base, forecast: null, fundamentals: null, news: [], signals: null });
    expect(led.forecast).toBeNull();
    expect(led.fundamentals).toBeNull();
    expect(led.news).toEqual([]);
    // 6 technical rows + 2 momentum rows (12-1 momentum, 52w high distance) from 260 bars; no RS (no benchmarkBars)
    expect(led.scorecard).toHaveLength(8);
  });

  it("initializes analystAnalysis to null", () => {
    const led = buildLedger(base);
    expect(led.analystAnalysis).toBeNull();
  });

  it("attaches a forensics report when the fundamentals carry a series", () => {
    const led = buildLedger({
      ...base,
      fundamentals: {
        annual: null,
        quarter: null,
        forensicsSeries: [
          { fiscalLabel: "FY2024", periodEnd: "2024-12-31", revenue: 1000, netIncome: 200, operatingCashFlow: 180, capex: 30, freeCashFlow: 150, sbc: 60, dilutedShares: 100, dilutedEps: 2, accountsReceivable: 100, inventory: 50, costOfRevenue: 400, deferredRevenue: 90 },
          { fiscalLabel: "FY2025", periodEnd: "2025-12-31", revenue: 1200, netIncome: 150, operatingCashFlow: 90, capex: 40, freeCashFlow: 50, sbc: 140, dilutedShares: 110, dilutedEps: 1.36, accountsReceivable: 200, inventory: 60, costOfRevenue: 480, deferredRevenue: 70 },
        ],
      },
    });
    expect(led.forensics).not.toBeNull();
    expect(led.forensics?.overall).toBe("concerning");
  });

  it("sets forensics to a report with unavailable overall when no series is present", () => {
    const led = buildLedger({ ...base, fundamentals: null });
    expect(led.forensics?.overall).toBe("unavailable");
  });

  it("initializes fundamentalsInsight to null", () => {
    const ledger = buildLedger({
      ticker: "TST", companyName: null, bars: [], forecast: null,
      fundamentals: null, news: [], signals: null, consensusTarget: null,
    });
    expect(ledger.fundamentalsInsight).toBeNull();
  });

  it("initializes longTermPlay to null", () => {
    const ledger = buildLedger({
      ticker: "TST", companyName: null, bars: [], forecast: null,
      fundamentals: null, news: [], signals: null, consensusTarget: null,
    });
    expect(ledger.longTermPlay).toBeNull();
  });

  it("defaults officialTrades and insiderTrades to empty arrays when not provided", () => {
    const ledger = buildLedger({
      ticker: "TST", companyName: null, bars: [], forecast: null,
      fundamentals: null, news: [], signals: null, consensusTarget: null,
    });
    expect(ledger.officialTrades).toEqual([]);
    expect(ledger.insiderTrades).toEqual([]);
  });

  it("passes through officialTrades and insiderTrades when provided", () => {
    const official = [
      {
        branch: "congress" as const,
        name: "Jane Smith",
        party: "D",
        state: "CA",
        agency: null,
        action: "buy" as const,
        transactionType: "Purchase",
        amountMin: 15000,
        amountMax: 50000,
        amountRangeRaw: "$15,001 - $50,000",
        transactionDate: "2026-05-01",
        disclosureDate: "2026-05-10",
      },
    ];
    const insider = [
      {
        name: "John Doe",
        title: "CEO",
        action: "sell" as const,
        transactionType: "S",
        shares: 5000,
        pricePerShare: 200,
        totalValue: 1000000,
        transactionDate: "2026-05-15",
        filingDate: "2026-05-17",
      },
    ];
    const ledger = buildLedger({ ...base, officialTrades: official, insiderTrades: insider });
    expect(ledger.officialTrades).toEqual(official);
    expect(ledger.insiderTrades).toEqual(insider);
  });
});

describe("analyst upside recompute", () => {
  it("recomputes analyst upside from the ledger's own last close", () => {
    // bars(1): single bar with close=100; analyst targetMean 110, fetched upsidePct 55 (stale base)
    const ledger = buildLedger({
      ticker: "TST",
      companyName: null,
      bars: bars(1),
      forecast: null,
      fundamentals: null,
      news: [],
      signals: null,
      consensusTarget: null,
      analyst: {
        targetMean: 110,
        targetHigh: null,
        targetLow: null,
        numAnalysts: 5,
        recommendationKey: null,
        recommendationMean: null,
        upsidePct: 55,
        counts: null,
      },
    });
    expect(ledger.analyst?.upsidePct).toBeCloseTo(10, 5);
  });
});

describe("houseCallInputsFromLedger", () => {
  it("re-derives HouseCallInputs from a finished ledger and reproduces the same houseCall", () => {
    const l = buildLedger(base);
    expect(buildHouseCall(houseCallInputsFromLedger(l))).toEqual(l.houseCall);
  });

  it("reproduces houseCall when optional lenses (analyst/valuation/options/macro/altFlow) are non-null", () => {
    const richInputs: LedgerInputs = {
      ...base,
      analyst: {
        targetMean: 120,
        targetHigh: 130,
        targetLow: 110,
        numAnalysts: 10,
        recommendationKey: "buy",
        recommendationMean: 2.0,
        upsidePct: null, // will be recomputed from bars lastClose
        counts: null,
      },
      valuation: {
        peTrailing: 80,
        peForward: 60,
        priceToSales: 12,
        priceToBook: 20,
        pegRatio: 2.5,
        evToEbitda: 50,
        read: "expensive",
      },
      options: {
        asOf: "2026-06-10",
        expiration: "2026-07-18",
        putCallVolume: 0.6,
        putCallOI: 0.55,
        atmIvPct: 30,
        ivSkewPct: 2,
        expectedMovePct: 8,
        lean: "bullish",
        daysToExp: 38,
        expectedMove60dPct: 10,
        expiration60d: "2026-08-15",
      },
      macro: {
        asOf: "2026-06-10",
        score: 30,
        label: "risk-on",
        factors: [],
        note: "Risk appetite elevated.",
        confidence: "ok",
      },
      altFlow: {
        wsb: null,
        darkShort: {
          latestShortVolPct: 62,
          baselineShortVolPct: 50,
          excessPp: 12,   // ≥ 10 → triggers -0.5 house call contribution
          sampleSize: 6,
        },
        thirteenF: null,
        govContracts: null,
      },
    };
    const l = buildLedger(richInputs);
    expect(buildHouseCall(houseCallInputsFromLedger(l))).toEqual(l.houseCall);
  });
});

describe("assessForecastSuspect", () => {
  it("flags TSCO-style degenerate forecast (large move, narrow band)", () => {
    const result = assessForecastSuspect({ movePct: 78.7, bandPct: 1.7, probUp: 100 });
    expect(result.suspect).toBe(true);
    expect(result.suspectReason).toMatch(/mean-revert/i);
  });

  it("flags near-certain probability on a large move even with a wider band", () => {
    const result = assessForecastSuspect({ movePct: 30, bandPct: 8, probUp: 99.5 });
    expect(result.suspect).toBe(true);
  });

  it("does not flag a normal forecast (TSLA-style)", () => {
    const result = assessForecastSuspect({ movePct: -8.2, bandPct: 5.1, probUp: 4.5 });
    expect(result.suspect).toBe(false);
    expect(result.suspectReason).toBeNull();
  });

  it("does not flag a large move when the band is honestly wide", () => {
    const result = assessForecastSuspect({ movePct: 40, bandPct: 18, probUp: 80 });
    expect(result.suspect).toBe(false);
  });

  it("flags TSCO via buildLedger (full pipeline)", () => {
    const tscoClose = 30.06;
    const barsArr: BarPoint[] = Array.from({ length: 260 }, () => ({
      date: "2026-01-01",
      open: tscoClose,
      high: tscoClose + 0.5,
      low: tscoClose - 0.5,
      close: tscoClose,
      volume: 1000,
    }));
    const ledger = buildLedger({
      ticker: "TSCO",
      companyName: "Tractor Supply",
      bars: barsArr,
      forecast: {
        points: [{ date: "2026-08-31", close: 53.59, lower: 52.7, upper: 54.5 }],
        horizonDays: 60,
        probUp: 100,
        expectedMovePct: 78.7,
      },
      fundamentals: null,
      news: [],
      signals: null,
      consensusTarget: null,
    });
    expect(ledger.forecast?.suspect).toBe(true);
    expect(ledger.forecast?.suspectReason).toMatch(/mean-revert/i);
  });
});
