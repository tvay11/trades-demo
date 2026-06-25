import { describe, expect, it } from "vitest";

import {
  buildRelationshipFacts,
  type RelationshipTradeInput,
} from "./relationships";

function trade(partial: Partial<RelationshipTradeInput>): RelationshipTradeInput {
  return {
    id: "1",
    politicianId: 1,
    politicianName: "Nancy Pelosi",
    party: "D",
    state: "CA",
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    transactionType: "Purchase",
    action: "buy",
    transactionDate: new Date("2026-02-01T00:00:00Z"),
    disclosureDate: new Date("2026-02-10T00:00:00Z"),
    amountMinimum: 125_000,
    amountRangeRaw: "$100K-$250K",
    committees: ["House Administration"],
    ...partial,
  };
}

describe("relationship facts", () => {
  it("links politicians who traded the same ticker inside the selected window", () => {
    const result = buildRelationshipFacts(
      [
        trade({ id: "1", politicianId: 1, politicianName: "Nancy Pelosi" }),
        trade({
          id: "2",
          politicianId: 2,
          politicianName: "Tommy Tuberville",
          party: "R",
          state: "AL",
          transactionDate: new Date("2026-02-08T00:00:00Z"),
        }),
        trade({
          id: "3",
          politicianId: 3,
          politicianName: "Josh Gottheimer",
          transactionDate: new Date("2026-03-20T00:00:00Z"),
        }),
      ],
      { windowDays: 14 },
    );

    expect(result.summary.pairCount).toBe(1);
    expect(result.pairs[0]).toMatchObject({
      politicianA: { id: 1, name: "Nancy Pelosi" },
      politicianB: { id: 2, name: "Tommy Tuberville" },
      sharedTradeCount: 1,
      sharedTickerCount: 1,
      sameDirectionCount: 1,
      oppositeDirectionCount: 0,
    });
    expect(result.pairs[0].tickerHighlights).toEqual([
      { ticker: "NVDA", companyName: "NVIDIA Corporation", count: 1 },
    ]);
  });

  it("separates same-direction and opposite-direction pair events", () => {
    const result = buildRelationshipFacts(
      [
        trade({ id: "1", politicianId: 1, politicianName: "Nancy Pelosi" }),
        trade({
          id: "2",
          politicianId: 2,
          politicianName: "Tommy Tuberville",
          transactionDate: new Date("2026-02-03T00:00:00Z"),
        }),
        trade({
          id: "3",
          politicianId: 2,
          politicianName: "Tommy Tuberville",
          action: "sell",
          transactionType: "Sale",
          transactionDate: new Date("2026-02-05T00:00:00Z"),
        }),
      ],
      { windowDays: 7 },
    );

    expect(result.pairs[0]).toMatchObject({
      sharedTradeCount: 2,
      sameDirectionCount: 1,
      oppositeDirectionCount: 1,
      buyTogetherCount: 1,
      sellTogetherCount: 0,
    });
  });

  it("reports shared committees and ticker clusters from pair events", () => {
    const result = buildRelationshipFacts(
      [
        trade({
          id: "1",
          politicianId: 1,
          politicianName: "Nancy Pelosi",
          ticker: "LMT",
          companyName: "Lockheed Martin Corporation",
          committees: ["Armed Services", "Appropriations"],
        }),
        trade({
          id: "2",
          politicianId: 2,
          politicianName: "Mike Rogers",
          party: "R",
          ticker: "LMT",
          companyName: "Lockheed Martin Corporation",
          transactionDate: new Date("2026-02-04T00:00:00Z"),
          committees: ["Armed Services"],
        }),
        trade({
          id: "3",
          politicianId: 3,
          politicianName: "Debbie Wasserman Schultz",
          ticker: "XOM",
          companyName: "Exxon Mobil Corporation",
          transactionDate: new Date("2026-02-04T00:00:00Z"),
        }),
      ],
      { windowDays: 7 },
    );

    expect(result.pairs[0].sharedCommittees).toEqual(["Armed Services"]);
    expect(result.clusters[0]).toMatchObject({
      ticker: "LMT",
      politicianCount: 2,
      pairEventCount: 1,
      sameDirectionCount: 1,
    });
  });
});
