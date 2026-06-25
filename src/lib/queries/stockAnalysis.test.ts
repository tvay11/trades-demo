import { describe, expect, it } from "vitest";

import {
  calculateSignalScore,
  rankPoliticianActivity,
  shapeStockInsiderTrades,
  shapeStockSourceRows,
  type SignalScoreInput,
} from "./stockAnalysis";
import type { TickerCongressTrade } from "./tickerDetail";

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

describe("stock analysis shaping", () => {
  it("ranks politicians by estimated volume and summarizes their flow", () => {
    const leaders = rankPoliticianActivity([
      trade({ id: "1", politicianName: "Nancy Pelosi", amountMinimum: 8_000 }),
      trade({
        id: "2",
        politicianName: "Nancy Pelosi",
        action: "sell",
        transactionType: "Sale",
        amountMinimum: 32_500,
        returnSinceTrade: -4,
        return30dFromDisclosure: -6,
        disclosureDate: new Date("2026-01-20T00:00:00Z"),
      }),
      trade({
        id: "3",
        politicianName: "Dan Crenshaw",
        party: "R",
        state: "TX",
        amountMinimum: 15_000,
        returnSinceTrade: null,
      }),
    ]);

    expect(leaders[0]).toMatchObject({
      politicianName: "Nancy Pelosi",
      party: "D",
      state: "CA",
      tradeCount: 2,
      buyCount: 1,
      sellCount: 1,
      totalEstimatedVolume: 40_500,
      averageReturn: 2,
      latestDisclosureDate: new Date("2026-01-20T00:00:00Z"),
      netFlowLabel: "Balanced",
    });
    expect(leaders[1].politicianName).toBe("Dan Crenshaw");
  });

  it("scores active tickers higher when multiple political and alternative signals appear", () => {
    const active: SignalScoreInput = {
      tradeCount: 14,
      buyCount: 10,
      sellCount: 2,
      estimatedVolume: 3_500_000,
      alternativeCounts: {
        "Insider trades": 4,
        Lobbying: 2,
        "Gov contracts": 3,
        Patents: 8,
        "13F holdings": 6,
        "Social mentions": 250,
        "Wikipedia views": 100,
        "Political beta": 1,
      },
      politicalBeta: 1.4,
    };
    const quiet: SignalScoreInput = {
      tradeCount: 0,
      buyCount: 0,
      sellCount: 0,
      estimatedVolume: 0,
      alternativeCounts: {},
      politicalBeta: null,
    };

    expect(calculateSignalScore(active)).toMatchObject({
      rating: "Elevated",
    });
    expect(calculateSignalScore(active).score).toBeGreaterThan(75);
    expect(calculateSignalScore(quiet)).toMatchObject({
      rating: "Quiet",
    });
    expect(calculateSignalScore(quiet).score).toBeLessThan(20);
  });

  it("shapes corporate insider rows into factual stock-page rows", () => {
    const rows = shapeStockInsiderTrades([
      {
        id: 42,
        insiderName: "Jensen Huang",
        insiderTitle: "CEO",
        transactionType: "P - Purchase",
        transactionDate: new Date("2026-05-01T00:00:00Z"),
        filingDate: new Date("2026-05-03T00:00:00Z"),
        shares: 100,
        pricePerShareCents: 120_50,
        totalValueCents: 1_205_000n,
        sharesOwnedAfter: 1_000_100,
      },
      {
        id: 43,
        insiderName: "Director Example",
        insiderTitle: null,
        transactionType: "Sale",
        transactionDate: new Date("2026-05-02T00:00:00Z"),
        filingDate: null,
        shares: null,
        pricePerShareCents: null,
        totalValueCents: null,
        sharesOwnedAfter: null,
      },
    ]);

    expect(rows[0]).toMatchObject({
      id: 42,
      insiderName: "Jensen Huang",
      insiderTitle: "CEO",
      action: "buy",
      pricePerShare: 120.5,
      totalValue: 12050,
      sharesOwnedAfter: 1_000_100,
    });
    expect(rows[1]).toMatchObject({
      action: "sell",
      pricePerShare: null,
      totalValue: null,
    });
  });

  it("shapes alternative SQL rows into stock-page source panels", () => {
    const rows = shapeStockSourceRows({
      lobbyingRows: [
        {
          id: 1,
          client: "NVIDIA Corporation",
          registrant: "Policy Group",
          amountCents: 2_500_000n,
          filingYear: 2026,
          filingQuarter: 1,
          issues: "AI export controls",
          filedAt: null,
        },
      ],
      govContractRows: [
        {
          id: 2,
          agency: "Department of Defense",
          description: "GPU research award",
          amountCents: 10_000_000n,
          awardedAt: new Date("2026-05-02T00:00:00Z"),
          contractId: "DOD-1",
        },
      ],
      patentRows: [
        {
          id: 3,
          patentNumber: "US123",
          title: "Accelerated compute",
          filedAt: new Date("2026-04-01T00:00:00Z"),
          grantedAt: null,
          inventors: "Jane Doe",
        },
      ],
      thirteenFRows: [
        {
          id: 4,
          filer: "Fund LP",
          shares: 1000,
          valueCents: 50_000_000n,
          filingDate: new Date("2026-05-10T00:00:00Z"),
          reportDate: new Date("2026-03-31T00:00:00Z"),
          changeShares: 250,
        },
      ],
      offExchangeRows: [
        {
          id: 5,
          date: new Date("2026-05-12T00:00:00Z"),
          shortVolume: 200,
          totalVolume: 1000,
          shortVolumePercent: 20.4,
          darkPoolPercent: 45.8,
        },
      ],
      wsbRows: [{ id: 6, date: new Date("2026-05-11T00:00:00Z"), mentions: 42, sentiment: 0.2 }],
      twitterRows: [
        { id: 7, date: new Date("2026-05-11T00:00:00Z"), mentions: 99, sentiment: null, followers: 1000 },
      ],
      wikipediaRows: [{ id: 8, date: new Date("2026-05-11T00:00:00Z"), views: 1234 }],
      betaRows: [{ id: 9, beta: 1.25, asOfDate: new Date("2026-05-01T00:00:00Z") }],
    });

    expect(rows.lobbying[0]).toMatchObject({
      amount: 25_000,
      filingPeriod: "2026 Q1",
      issue: "AI export controls",
    });
    expect(rows.govContracts[0]).toMatchObject({ amount: 100_000 });
    expect(rows.patents[0]).toMatchObject({ effectiveDate: new Date("2026-04-01T00:00:00Z") });
    expect(rows.holdings[0]).toMatchObject({ value: 500_000, changeShares: 250 });
    expect(rows.offExchange[0]).toMatchObject({ shortVolumePercent: 20.4, darkPoolPercent: 45.8 });
    expect(rows.attention.map((row) => row.source)).toEqual(["WSB", "Twitter", "Wikipedia"]);
    expect(rows.politicalBeta[0]).toMatchObject({ beta: 1.25 });
  });
});
