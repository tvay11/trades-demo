import { describe, expect, it } from "vitest";

import {
  buildLongShortScannerGroups,
  buildLongShortSummary,
  type LongShortScannerCandidate,
} from "./longShortScanner";

const baseCandidate: LongShortScannerCandidate = {
  ticker: "NVDA",
  companyName: "NVIDIA Corporation",
  sector: "Technology",
  stance: "Long",
  confidence: "High",
  score: 72,
  scoreBreakdown: {
    flow: 38,
    cluster: 18,
    breadth: 8,
    insider: 0,
    committee: 8,
    lagPenalty: 0,
  },
  netFlow: 1_000_000,
  estimatedBuyVolume: 1_200_000,
  estimatedSellVolume: 200_000,
  buyPressure: 1_200_000,
  sellPressure: 200_000,
  buyCount: 3,
  sellCount: 1,
  politicianCount: 2,
  insiderNetValue: 0,
  averageDisclosureLagDays: 9,
  latestDisclosureDate: new Date("2026-05-01T00:00:00Z"),
  committeeRelevanceScore: 80,
  committeeRelevanceLabel: "High",
  reasons: [],
  warnings: [],
};

describe("long-short scanner helpers", () => {
  it("summarizes long, short, balanced, flow, and lag facts", () => {
    const summary = buildLongShortSummary([
      baseCandidate,
      { ...baseCandidate, ticker: "TSLA", stance: "Short", netFlow: -500_000, averageDisclosureLagDays: 21 },
      { ...baseCandidate, ticker: "MSFT", stance: "Neutral", netFlow: 0, averageDisclosureLagDays: 0 },
    ]);

    expect(summary).toMatchObject({
      longCount: 1,
      shortCount: 1,
      balancedCount: 1,
      netFlow: 500_000,
      insiderConfirmedCount: 0,
      averageLagDays: 10,
    });
  });

  it("groups candidates into long, short, and balanced buckets", () => {
    const groups = buildLongShortScannerGroups([
      baseCandidate,
      { ...baseCandidate, ticker: "TSLA", stance: "Short", netFlow: -500_000 },
      { ...baseCandidate, ticker: "MSFT", stance: "Neutral", netFlow: 0 },
    ]);

    expect(groups.map((group) => [group.title, group.candidates.map((c) => c.ticker)])).toEqual([
      ["Long Flow", ["NVDA"]],
      ["Short Flow", ["TSLA"]],
      ["Balanced / Watchlist", ["MSFT"]],
    ]);
  });
});
