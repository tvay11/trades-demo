import { describe, expect, it } from "vitest";

import {
  buildRelationshipScannerGroups,
  buildRelationshipScannerSummary,
  type RelationshipScannerPair,
} from "./relationshipScanner";

const basePair: RelationshipScannerPair = {
  pairKey: "1:2",
  politicianA: { id: 1, name: "Nancy Pelosi", party: "D", state: "CA" },
  politicianB: { id: 2, name: "Dan Crenshaw", party: "R", state: "TX" },
  sharedTradeCount: 5,
  sharedTickerCount: 2,
  sameDirectionCount: 4,
  oppositeDirectionCount: 1,
  buyTogetherCount: 3,
  sellTogetherCount: 1,
  estimatedVolume: 150_000,
  latestActivityDate: new Date("2026-05-01T00:00:00Z"),
  sharedCommittees: ["Energy and Commerce"],
  tickerHighlights: [
    { ticker: "NVDA", companyName: "NVIDIA Corporation", count: 3 },
    { ticker: "MSFT", companyName: "Microsoft Corporation", count: 2 },
  ],
  examples: [],
};

describe("relationship scanner helpers", () => {
  it("summarizes relationship facts into trader-facing percentages", () => {
    const summary = buildRelationshipScannerSummary({
      pairCount: 3,
      pairEventCount: 20,
      tickerCount: 7,
      politicianCount: 9,
      sameDirectionCount: 12,
      oppositeDirectionCount: 8,
    });

    expect(summary).toEqual({
      pairCount: 3,
      pairEventCount: 20,
      tickerCount: 7,
      politicianCount: 9,
      sameDirectionPercent: 60,
      oppositeDirectionPercent: 40,
    });
  });

  it("groups pairs into same-direction, opposite-direction, and mixed boards", () => {
    const groups = buildRelationshipScannerGroups([
      basePair,
      {
        ...basePair,
        pairKey: "3:4",
        sameDirectionCount: 1,
        oppositeDirectionCount: 3,
      },
      {
        ...basePair,
        pairKey: "5:6",
        sameDirectionCount: 2,
        oppositeDirectionCount: 2,
      },
    ]);

    expect(groups.map((group) => [group.title, group.pairs.map((pair) => pair.pairKey)])).toEqual([
      ["Same Direction", ["1:2"]],
      ["Opposite Direction", ["3:4"]],
      ["Mixed / Watchlist", ["5:6"]],
    ]);
  });
});
