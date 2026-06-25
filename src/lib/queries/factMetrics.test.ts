import { describe, expect, it } from "vitest";

import {
  longShortFactMetrics,
  safePercent,
  stockTradeFacts,
} from "./factMetrics";
import type { LongShortCandidate } from "./marketSignals";
import type { TickerCongressTrade } from "./tickerDetail";

function candidate(partial: Partial<LongShortCandidate>): LongShortCandidate {
  return {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    stance: "Long",
    confidence: "Medium",
    score: 62,
    scoreBreakdown: {
      flow: 32,
      cluster: 14,
      breadth: 5,
      insider: 4,
      committee: 7,
      lagPenalty: 0,
    },
    netFlow: 400_000,
    estimatedBuyVolume: 750_000,
    estimatedSellVolume: 250_000,
    buyPressure: 750_000,
    sellPressure: 250_000,
    buyCount: 6,
    sellCount: 2,
    politicianCount: 4,
    insiderNetValue: 0,
    averageDisclosureLagDays: 18,
    latestDisclosureDate: new Date("2026-05-01T00:00:00Z"),
    committeeRelevanceScore: 42,
    committeeRelevanceLabel: "Medium",
    reasons: [],
    warnings: [],
    ...partial,
  };
}

function trade(partial: Partial<TickerCongressTrade>): TickerCongressTrade {
  return {
    id: "1",
    branch: "congress",
    politicianName: "Nancy Pelosi",
    party: "D",
    state: "CA",
    agency: null,
    transactionType: "Purchase",
    transactionDate: new Date("2026-01-05T00:00:00Z"),
    disclosureDate: new Date("2026-01-12T00:00:00Z"),
    amountMin: 1_000,
    amountMax: 15_000,
    amountRangeRaw: "$1K-$15K",
    action: "buy",
    amountMinimum: 8_000,
    priceAtTrade: 100,
    priceAtDisclosure: 102,
    latestClose: 120,
    returnSinceTrade: 20,
    return7dFromDisclosure: 5,
    return30dFromDisclosure: 10,
    return90dFromDisclosure: 18,
    committeeRelevance: {
      score: 0,
      label: "Low",
      matches: [],
      reasons: [],
    },
    ...partial,
  };
}

describe("fact metrics", () => {
  it("calculates percentages safely", () => {
    expect(safePercent(3, 4)).toBe(75);
    expect(safePercent(1, 3)).toBe(33.3);
    expect(safePercent(10, 0)).toBe(0);
  });

  it("summarizes long-short candidates as raw facts instead of scores", () => {
    expect(longShortFactMetrics(candidate({}))).toMatchObject({
      tradeCount: 8,
      buyCountPercent: 75,
      sellCountPercent: 25,
      buyDollarPercent: 75,
      sellDollarPercent: 25,
      averageDisclosureLagDays: 18,
    });
  });

  it("summarizes stock trade returns and committee coverage", () => {
    const facts = stockTradeFacts([
      trade({ id: "1", action: "buy", amountMinimum: 20_000, return30dFromDisclosure: 10 }),
      trade({
        id: "2",
        action: "sell",
        transactionType: "Sale",
        amountMinimum: 5_000,
        return7dFromDisclosure: -2,
        return30dFromDisclosure: -4,
        return90dFromDisclosure: null,
        committeeRelevance: {
          score: 81,
          label: "High",
          matches: ["ticker"],
          reasons: ["Armed Services maps to defense tickers"],
        },
      }),
      trade({
        id: "3",
        action: "buy",
        amountMinimum: 15_000,
        return7dFromDisclosure: null,
        return30dFromDisclosure: null,
        return90dFromDisclosure: 12,
      }),
    ]);

    expect(facts).toMatchObject({
      tradeCount: 3,
      buyCount: 2,
      sellCount: 1,
      buyCountPercent: 66.7,
      buyDollarPercent: 87.5,
      averageReturn7d: 1.5,
      averageReturn30d: 3,
      averageReturn90d: 15,
      positiveReturn30dPercent: 50,
      committeeRelevantTradeCount: 1,
      committeeRelevantTradePercent: 33.3,
    });
  });
});
