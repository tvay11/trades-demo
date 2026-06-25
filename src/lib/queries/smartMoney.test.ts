import { describe, expect, it } from "vitest";

import {
  buildSmartMoneyAnalysis,
  type SmartMoneyHoldingInput,
} from "./smartMoney";

function holding(partial: Partial<SmartMoneyHoldingInput>): SmartMoneyHoldingInput {
  return {
    filer: "Fund A",
    ticker: "AAAA",
    companyName: "Aaaa Inc.",
    sector: "Technology",
    marketCap: 5_000_000_000,
    shares: 100_000,
    value: 10_000_000,
    changeShares: 25_000,
    putCall: null,
    filingDate: new Date("2026-05-15T00:00:00Z"),
    reportDate: new Date("2026-03-31T00:00:00Z"),
    ...partial,
  };
}

function lowOverlapHistory(filers: string[]): SmartMoneyHoldingInput[] {
  const quarters = ["2025-06-30", "2025-09-30", "2025-12-31"];
  return filers.flatMap((filer, fundIndex) =>
    quarters.map((quarter, quarterIndex) =>
      holding({
        filer,
        ticker: `H${fundIndex}${quarterIndex}`,
        companyName: `Historical ${fundIndex}${quarterIndex}`,
        changeShares: 1_000,
        reportDate: new Date(`${quarter}T00:00:00Z`),
        filingDate: new Date("2026-02-14T00:00:00Z"),
      }),
    ),
  );
}

function crowdedHistory(filers: string[]): SmartMoneyHoldingInput[] {
  const quarters = ["2025-06-30", "2025-09-30", "2025-12-31"];
  const tickers = ["AAPL", "MSFT", "NVDA"];
  return filers.flatMap((filer) =>
    quarters.flatMap((quarter) =>
      tickers.map((ticker) =>
        holding({
          filer,
          ticker,
          companyName: ticker,
          marketCap: 3_000_000_000_000,
          changeShares: 1_000,
          reportDate: new Date(`${quarter}T00:00:00Z`),
          filingDate: new Date("2026-02-14T00:00:00Z"),
        }),
      ),
    ),
  );
}

describe("smart money 13F analysis", () => {
  it("flags a mid-cap bought by five historically unrelated funds in the same 13F quarter", () => {
    const filers = ["Renaissance", "Two Sigma", "D. E. Shaw", "AQR", "Citadel"];
    const current = filers.map((filer, i) =>
      holding({
        filer,
        ticker: "OSCR",
        companyName: "Oscar Health",
        marketCap: 6_400_000_000,
        value: 12_000_000 + i * 1_000_000,
        changeShares: 50_000 + i * 5_000,
        filingDate: new Date(`2026-05-${12 + i}T00:00:00Z`),
      }),
    );

    const analysis = buildSmartMoneyAnalysis([...lowOverlapHistory(filers), ...current], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });

    expect(analysis.signals[0]).toMatchObject({
      ticker: "OSCR",
      companyName: "Oscar Health",
      fundCount: 5,
      publicSignalDate: new Date("2026-05-16T00:00:00Z"),
      reportDate: new Date("2026-03-31T00:00:00Z"),
      stance: "Bullish anomaly",
      signalSide: "LONG_BUY",
      confidence: "High",
    });
    expect(analysis.signals[0].score).toBeGreaterThanOrEqual(75);
    expect(analysis.signals[0].averageHistoricalOverlap).toBeLessThan(0.2);
    expect(analysis.signals[0].reasons).toContain("5 funds increased or opened the position");
    expect(analysis.signals[0].warnings).not.toContain("13F filings are delayed quarterly snapshots, not real-time trades");
    expect(analysis.network.nodes.filter((node) => node.kind === "fund")).toHaveLength(5);
    expect(analysis.network.nodes.some((node) => node.id === "stock:LONG_BUY:OSCR")).toBe(true);
  });

  it("penalizes convergence when the funds already crowd into the same names", () => {
    const filers = ["Renaissance", "Two Sigma", "D. E. Shaw", "AQR", "Citadel"];
    const current = filers.map((filer) =>
      holding({
        filer,
        ticker: "OSCR",
        companyName: "Oscar Health",
        marketCap: 6_400_000_000,
        reportDate: new Date("2026-03-31T00:00:00Z"),
      }),
    );

    const unrelated = buildSmartMoneyAnalysis([...lowOverlapHistory(filers), ...current], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });
    const crowded = buildSmartMoneyAnalysis([...crowdedHistory(filers), ...current], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });

    expect(crowded.signals[0].averageHistoricalOverlap).toBeGreaterThan(0.5);
    expect(crowded.signals[0].score).toBeLessThan(unrelated.signals[0].score);
    expect(crowded.signals[0].warnings).toContain("Funds already have high historical overlap");
  });

  it("does not treat unchanged legacy holdings as a fresh convergence signal", () => {
    const filers = ["Renaissance", "Two Sigma", "D. E. Shaw", "AQR", "Citadel"];
    const previous = filers.map((filer) =>
      holding({
        filer,
        ticker: "OSCR",
        reportDate: new Date("2025-12-31T00:00:00Z"),
        filingDate: new Date("2026-02-14T00:00:00Z"),
        changeShares: 10_000,
      }),
    );
    const current = filers.map((filer) =>
      holding({
        filer,
        ticker: "OSCR",
        reportDate: new Date("2026-03-31T00:00:00Z"),
        changeShares: 0,
      }),
    );

    const analysis = buildSmartMoneyAnalysis([...previous, ...current], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });

    expect(analysis.signals).toHaveLength(0);
    expect(analysis.summary.signalCount).toBe(0);
  });

  it("flags a mid-cap reduced by five tracked funds as a bearish sell cluster", () => {
    const filers = ["Renaissance", "Two Sigma", "D. E. Shaw", "AQR", "Citadel"];
    const previous = filers.map((filer, i) =>
      holding({
        filer,
        ticker: "OSCR",
        companyName: "Oscar Health",
        marketCap: 6_400_000_000,
        shares: 200_000 + i * 10_000,
        value: 20_000_000 + i * 1_000_000,
        changeShares: 50_000,
        reportDate: new Date("2025-12-31T00:00:00Z"),
        filingDate: new Date("2026-02-14T00:00:00Z"),
      }),
    );
    const current = filers.map((filer, i) =>
      holding({
        filer,
        ticker: "OSCR",
        companyName: "Oscar Health",
        marketCap: 6_400_000_000,
        shares: 150_000 + i * 10_000,
        value: 15_000_000 + i * 1_000_000,
        changeShares: -50_000,
        filingDate: new Date(`2026-05-${12 + i}T00:00:00Z`),
      }),
    );

    const analysis = buildSmartMoneyAnalysis([...lowOverlapHistory(filers), ...previous, ...current], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });

    expect(analysis.signals[0]).toMatchObject({
      ticker: "OSCR",
      signalSide: "LONG_SELL",
      stance: "Bearish sell cluster",
      fundCount: 5,
    });
    expect(analysis.signals[0].totalChangeShares).toBe(250_000);
    expect(analysis.signals[0].reasons).toContain("5 funds reduced or exited the position");
  });

  it("flags a mid-cap put position opened by five tracked funds as bearish put exposure", () => {
    const filers = ["Renaissance", "Two Sigma", "D. E. Shaw", "AQR", "Citadel"];
    const current = filers.map((filer, i) =>
      holding({
        filer,
        ticker: "OSCR",
        companyName: "Oscar Health",
        marketCap: 6_400_000_000,
        putCall: "PUT",
        value: 8_000_000 + i * 1_000_000,
        changeShares: 10_000 + i * 1_000,
        filingDate: new Date(`2026-05-${12 + i}T00:00:00Z`),
      }),
    );

    const analysis = buildSmartMoneyAnalysis([...lowOverlapHistory(filers), ...current], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });

    expect(analysis.signals[0]).toMatchObject({
      ticker: "OSCR",
      signalSide: "PUT_BEARISH",
      stance: "Bearish put cluster",
      fundCount: 5,
    });
    expect(analysis.signals[0].reasons).toContain("5 funds opened or increased put exposure");
  });

  it("calculates prior overlap separately for bearish put clusters", () => {
    const filers = ["Renaissance", "Two Sigma", "D. E. Shaw", "AQR", "Citadel"];
    const crowdedCommonHistory = crowdedHistory(filers).map((row) => ({ ...row, putCall: null }));
    const currentPuts = filers.map((filer) =>
      holding({
        filer,
        ticker: "OSCR",
        companyName: "Oscar Health",
        marketCap: 6_400_000_000,
        putCall: "PUT",
        value: 8_000_000,
        changeShares: 10_000,
      }),
    );

    const analysis = buildSmartMoneyAnalysis([...crowdedCommonHistory, ...currentPuts], {
      minFundCount: 5,
      targetReportDate: new Date("2026-03-31T00:00:00Z"),
    });

    expect(analysis.signals[0].signalSide).toBe("PUT_BEARISH");
    expect(analysis.signals[0].averageHistoricalOverlap).toBeLessThan(0.2);
  });
});
