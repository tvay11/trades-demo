// @vitest-environment node

import { describe, it, expect } from "vitest";
import { shapeValuation, shapeAnalyst, shapeShortInterest } from "./marketStats";

describe("shapeValuation", () => {
  it("maps summaryDetail + keyStats fields and computes read", () => {
    const summaryDetail = { trailingPE: 70, forwardPE: 50, priceToSalesTrailing12Months: 12 };
    const keyStats = { priceToBook: 10, pegRatio: 3, enterpriseToEbitda: 35 };
    const result = shapeValuation(summaryDetail, keyStats, 200);
    expect(result.peTrailing).toBe(70);
    expect(result.peForward).toBe(50);
    expect(result.priceToSales).toBe(12);
    expect(result.priceToBook).toBe(10);
    expect(result.pegRatio).toBe(3);
    expect(result.evToEbitda).toBe(35);
    expect(result.read).toBe("expensive"); // trailingPE > 60
  });

  it("returns cheap when trailingPE < 15", () => {
    const summaryDetail = { trailingPE: 10, forwardPE: 9, priceToSalesTrailing12Months: 1 };
    const keyStats = { priceToBook: 1, pegRatio: 0.8, enterpriseToEbitda: 7 };
    const result = shapeValuation(summaryDetail, keyStats, 50);
    expect(result.read).toBe("cheap");
  });

  it("returns unknown when trailingPE is null", () => {
    const summaryDetail = { trailingPE: null, forwardPE: null, priceToSalesTrailing12Months: null };
    const keyStats = { priceToBook: null, pegRatio: null, enterpriseToEbitda: null };
    const result = shapeValuation(summaryDetail, keyStats, 100);
    expect(result.read).toBe("unknown");
  });
});

describe("shapeAnalyst", () => {
  it("maps financialData + recommendationTrend, computes upsidePct", () => {
    const financialData = {
      targetMeanPrice: 200,
      targetHighPrice: 250,
      targetLowPrice: 160,
      numberOfAnalystOpinions: 30,
      recommendationKey: "buy",
      recommendationMean: 2.1,
      currentPrice: 175,
    };
    const recommendationTrend = {
      trend: [{ period: "0m", strongBuy: 10, buy: 12, hold: 6, sell: 1, strongSell: 1 }],
    };
    const result = shapeAnalyst(financialData, recommendationTrend, 175);
    expect(result.targetMean).toBe(200);
    expect(result.numAnalysts).toBe(30);
    expect(result.recommendationKey).toBe("buy");
    expect(result.upsidePct).toBeCloseTo(((200 / 175) - 1) * 100, 1);
    expect(result.counts).toMatchObject({ strongBuy: 10, buy: 12, hold: 6, sell: 1, strongSell: 1 });
  });

  it("returns null upsidePct when lastClose is null", () => {
    const financialData = { targetMeanPrice: 200, targetHighPrice: null, targetLowPrice: null, numberOfAnalystOpinions: 5, recommendationKey: "hold", recommendationMean: 3, currentPrice: 190 };
    const result = shapeAnalyst(financialData, { trend: [] }, null);
    expect(result.upsidePct).toBeNull();
    expect(result.counts).toBeNull();
  });
});

describe("shapeShortInterest", () => {
  it("maps keyStats fields and multiplies percentOfFloat by 100", () => {
    const keyStats = {
      sharesShort: 50_000_000,
      shortPercentOfFloat: 0.085, // raw ratio → should become 8.5%
      shortRatio: 3.2,
      sharesShortPriorMonth: null,
    };
    const result = shapeShortInterest(keyStats);
    expect(result.sharesShort).toBe(50_000_000);
    expect(result.percentOfFloat).toBeCloseTo(8.5, 1);
    expect(result.daysToCover).toBe(3.2);
    expect(result.priorSharesShort).toBeNull();
    expect(result.changePct).toBeNull();
  });

  it("handles all-null input gracefully", () => {
    const result = shapeShortInterest({});
    expect(result.sharesShort).toBeNull();
    expect(result.percentOfFloat).toBeNull();
    expect(result.daysToCover).toBeNull();
    expect(result.priorSharesShort).toBeNull();
    expect(result.changePct).toBeNull();
  });
});
