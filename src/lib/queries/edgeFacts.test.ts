import { describe, expect, it } from "vitest";

import { buildEdgeFacts, type EdgeTrade } from "./edgeFacts";

function trade(partial: Partial<EdgeTrade>): EdgeTrade {
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
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    ...partial,
  };
}

describe("edge facts", () => {
  it("builds most bought and most sold ticker facts from raw trade rows", () => {
    const facts = buildEdgeFacts([
      trade({ id: "1", ticker: "NVDA", action: "buy", amountMinimum: 20_000 }),
      trade({ id: "2", ticker: "NVDA", action: "buy", amountMinimum: 30_000 }),
      trade({
        id: "3",
        ticker: "MSFT",
        companyName: "Microsoft Corporation",
        action: "sell",
        transactionType: "Sale",
        amountMinimum: 50_000,
      }),
    ]);

    expect(facts.mostBought[0]).toMatchObject({
      ticker: "NVDA",
      buyCount: 2,
      sellCount: 0,
      buyCountPercent: 100,
      buyDollarPercent: 100,
      estimatedVolume: 50_000,
    });
    expect(facts.mostSold[0]).toMatchObject({
      ticker: "MSFT",
      buyCount: 0,
      sellCount: 1,
      sellCountPercent: 100,
      sellDollarPercent: 100,
      estimatedVolume: 50_000,
    });
  });

  it("filters committee-linked rows and reports matched committee names", () => {
    const facts = buildEdgeFacts([
      trade({
        id: "1",
        ticker: "LMT",
        companyName: "Lockheed Martin Corporation",
        sector: "Industrials",
        committeeRelevance: {
          score: 92,
          label: "High",
          matches: ["Armed Services"],
          reasons: ["Committee jurisdiction matches ticker"],
        },
      }),
      trade({ id: "2", ticker: "AAPL", companyName: "Apple Inc." }),
    ]);

    expect(facts.committeeLinked).toHaveLength(1);
    expect(facts.committeeLinked[0]).toMatchObject({
      ticker: "LMT",
      committeeTradeCount: 1,
      committeeTradePercent: 100,
      topCommittees: ["Armed Services"],
    });
  });

  it("aggregates disclosure-date return windows without using private transaction date", () => {
    const facts = buildEdgeFacts([
      trade({ id: "1", ticker: "NVDA", return30dFromDisclosure: 10 }),
      trade({ id: "2", ticker: "NVDA", return30dFromDisclosure: -2 }),
      trade({ id: "3", ticker: "MSFT", return30dFromDisclosure: null }),
    ]);

    expect(facts.bestDisclosureReturns[0]).toMatchObject({
      ticker: "NVDA",
      averageReturn30d: 4,
      positiveReturn30dPercent: 50,
      returnSampleSize: 2,
    });
  });

  it("groups politicians by ticker and sorts by activity", () => {
    const facts = buildEdgeFacts([
      trade({ id: "1", ticker: "NVDA", politicianName: "Nancy Pelosi", amountMinimum: 20_000 }),
      trade({ id: "2", ticker: "NVDA", politicianName: "Nancy Pelosi", amountMinimum: 40_000 }),
      trade({ id: "3", ticker: "MSFT", politicianName: "Dan Crenshaw", amountMinimum: 10_000 }),
    ]);

    expect(facts.politiciansByTicker[0]).toMatchObject({
      politicianName: "Nancy Pelosi",
      ticker: "NVDA",
      tradeCount: 2,
      estimatedVolume: 60_000,
    });
    expect(facts.tickerActivity[0]).toMatchObject({
      ticker: "NVDA",
      politicianName: "Nancy Pelosi",
      amountMinimum: 20_000,
    });
  });
});
