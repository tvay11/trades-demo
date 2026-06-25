import { describe, expect, it } from "vitest";

import {
  buildDashboardAlerts,
  calculatePostDisclosureReturn,
  classifyDualInsiderAlignment,
  isOptionAssetDescription,
  isOwnerRelatedDisclosure,
  rankDisclosureReturnFacts,
  summarizeTickerBreadth,
  type DisclosureReturnInput,
  type TickerBreadthInput,
} from "./dashboardFacts";

function breadth(partial: Partial<TickerBreadthInput>): TickerBreadthInput {
  return {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    politicianName: "Nancy Pelosi",
    state: "CA",
    transactionType: "Purchase",
    amountMinimum: 100_000,
    disclosureDate: new Date("2026-05-10T00:00:00Z"),
    ...partial,
  };
}

function disclosureReturn(partial: Partial<DisclosureReturnInput>): DisclosureReturnInput {
  return {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    return30d: 10,
    disclosureDate: new Date("2026-05-01T00:00:00Z"),
    ...partial,
  };
}

describe("dashboard trader facts", () => {
  it("detects true option disclosures without matching capital calls", () => {
    expect(isOptionAssetDescription("CALL OPTIONS; STRIKE PRICE $320; EXPIRES 06/18/2026")).toBe(true);
    expect(isOptionAssetDescription("Put option position, expires 01/17/2027")).toBe(true);
    expect(isOptionAssetDescription("CAPITAL CALL OF $40,112.60")).toBe(false);
    expect(isOptionAssetDescription("capital call notice for private fund")).toBe(false);
  });

  it("summarizes ticker breadth by politicians, states, direction, and net dollars", () => {
    const [fact] = summarizeTickerBreadth([
      breadth({ politicianName: "Nancy Pelosi", amountMinimum: 250_000 }),
      breadth({ politicianName: "Debbie Wasserman Schultz", state: "FL", amountMinimum: 50_000 }),
      breadth({
        politicianName: "Tommy Tuberville",
        state: "AL",
        transactionType: "Sale",
        amountMinimum: 100_000,
      }),
    ]);

    expect(fact).toMatchObject({
      ticker: "NVDA",
      tradeCount: 3,
      buyCount: 2,
      sellCount: 1,
      politicianCount: 3,
      stateCount: 3,
      buyVolume: 300_000,
      sellVolume: 100_000,
      netVolume: 200_000,
      latestDisclosureDate: new Date("2026-05-10T00:00:00Z"),
    });
  });

  it("counts ticker breadth by politician identity when available", () => {
    const [fact] = summarizeTickerBreadth([
      breadth({ politicianKey: "P000197", politicianName: "Nancy Pelosi" }),
      breadth({ politicianKey: "P000197", politicianName: "Pelosi, Nancy" }),
      breadth({ politicianKey: "T000278", politicianName: "Tommy Tuberville", state: "AL" }),
    ]);

    expect(fact.politicianCount).toBe(2);
  });

  it("uses the first cached close on or after disclosure as return entry", () => {
    const result = calculatePostDisclosureReturn({
      disclosureDate: new Date("2026-05-10T00:00:00Z"),
      horizonDays: 30,
      closes: [
        { date: new Date("2026-05-09T00:00:00Z"), close: 90 },
        { date: new Date("2026-05-10T00:00:00Z"), close: 100 },
        { date: new Date("2026-06-09T00:00:00Z"), close: 120 },
      ],
    });

    expect(result).toBe(20);
  });

  it("only counts explicit spouse or dependent owner flags", () => {
    expect(isOwnerRelatedDisclosure({ ownerType: "Spouse", ownerName: null, ownerRaw: null })).toBe(true);
    expect(isOwnerRelatedDisclosure({ ownerType: null, ownerName: null, ownerRaw: "Dependent child" })).toBe(true);
    expect(isOwnerRelatedDisclosure({ ownerType: null, ownerName: "John Doe", ownerRaw: null })).toBe(false);
  });

  it("classifies dual-insider alignment only when both groups point the same direction", () => {
    expect(
      classifyDualInsiderAlignment({
        congressBuyVolume: 300,
        congressSellVolume: 100,
        insiderBuyVolume: 50,
        insiderSellVolume: 0,
      }),
    ).toBe("Bullish");

    expect(
      classifyDualInsiderAlignment({
        congressBuyVolume: 20,
        congressSellVolume: 100,
        insiderBuyVolume: 0,
        insiderSellVolume: 50,
      }),
    ).toBe("Bearish");

    expect(
      classifyDualInsiderAlignment({
        congressBuyVolume: 300,
        congressSellVolume: 100,
        insiderBuyVolume: 0,
        insiderSellVolume: 50,
      }),
    ).toBeNull();
  });

  it("ranks disclosure return facts by average post-filing return and win rate", () => {
    const facts = rankDisclosureReturnFacts([
      disclosureReturn({ ticker: "NVDA", return30d: 10 }),
      disclosureReturn({ ticker: "NVDA", return30d: -2 }),
      disclosureReturn({ ticker: "MSFT", companyName: "Microsoft", return30d: 12 }),
      disclosureReturn({ ticker: "MSFT", companyName: "Microsoft", return30d: 8 }),
    ]);

    expect(facts[0]).toMatchObject({
      ticker: "MSFT",
      sampleSize: 2,
      averageReturn30d: 10,
      positiveReturn30dPercent: 100,
    });
    expect(facts[1]).toMatchObject({
      ticker: "NVDA",
      sampleSize: 2,
      averageReturn30d: 4,
      positiveReturn30dPercent: 50,
    });
  });

  it("builds trader alert cards from factual dashboard counts", () => {
    const alerts = buildDashboardAlerts({
      newFilingsToday: 12,
      committeeLinkedTrades: 4,
      spouseTrades30d: 2,
      largeTrades30d: 9,
      darkFlowIntersections: 3,
      failedDatasetCount: 1,
    });

    expect(alerts.map((alert) => alert.key)).toEqual([
      "new-filings",
      "committee-linked",
      "spouse-owner",
      "large-trades",
      "dark-flow",
      "ingest-health",
    ]);
    expect(alerts[0]).toMatchObject({
      label: "New Filings",
      value: "12",
      tone: "positive",
      href: "/trades",
    });
    expect(alerts[5]).toMatchObject({
      label: "Ingest Health",
      value: "1",
      tone: "warning",
      href: "/admin/data-health",
    });
  });
});
