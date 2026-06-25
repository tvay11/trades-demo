import { describe, expect, it } from "vitest";

import {
  scoreDarkFlowCandidates,
  scoreLongShortCandidates,
  type DarkFlowSignalInput,
  type LongShortSignalInput,
} from "./marketSignals";

function longShort(partial: Partial<LongShortSignalInput>): LongShortSignalInput {
  return {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    buyCount: 0,
    sellCount: 0,
    politicianCount: 0,
    estimatedBuyVolume: 0,
    estimatedSellVolume: 0,
    averageDisclosureLagDays: 12,
    latestDisclosureDate: new Date("2026-05-01T00:00:00Z"),
    altDataBreadth: 0,
    insiderNetValue: 0,
    committeeRelevanceScore: 0,
    committeeRelevanceLabel: "Low",
    ...partial,
  };
}

function darkFlow(partial: Partial<DarkFlowSignalInput>): DarkFlowSignalInput {
  return {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    latestDarkPoolPercent: 50,
    averageDarkPoolPercent: 45,
    latestShortVolumePercent: 48,
    averageShortVolumePercent: 45,
    latestTotalVolume: 1_000_000,
    averageTotalVolume: 900_000,
    offExchangeSampleSize: 30,
    congressNetFlow: 0,
    insiderNetValue: 0,
    govContractValue: 0,
    lobbyingValue: 0,
    thirteenFNetShares: 0,
    socialMentions: 0,
    wikipediaViews: 0,
    politicalBeta: null,
    latestDate: new Date("2026-05-01T00:00:00Z"),
    committeeRelevanceScore: 0,
    committeeRelevanceLabel: "Low",
    ...partial,
  };
}

describe("market signal scoring", () => {
  it("ranks clustered congressional net buying as a long candidate", () => {
    const [candidate] = scoreLongShortCandidates([
      longShort({
        ticker: "NVDA",
        buyCount: 8,
        sellCount: 1,
        politicianCount: 4,
        estimatedBuyVolume: 2_500_000,
        estimatedSellVolume: 50_000,
        altDataBreadth: 4,
        insiderNetValue: 800_000,
      }),
    ]);

    expect(candidate).toMatchObject({
      ticker: "NVDA",
      stance: "Long",
      confidence: "High",
    });
    expect(candidate.score).toBeGreaterThan(80);
    expect(candidate.reasons).toContain("Clustered congressional buying");
    expect(candidate.reasons).toContain("Insider flow confirms the buy side");
  });

  it("marks sell-heavy stale disclosures as lower-confidence short candidates", () => {
    const [candidate] = scoreLongShortCandidates([
      longShort({
        ticker: "MSFT",
        buyCount: 1,
        sellCount: 7,
        politicianCount: 2,
        estimatedBuyVolume: 15_000,
        estimatedSellVolume: 1_000_000,
        averageDisclosureLagDays: 41,
        insiderNetValue: -300_000,
      }),
    ]);

    expect(candidate.stance).toBe("Short");
    expect(candidate.warnings).toContain("Disclosure lag is near the STOCK Act limit");
    expect(candidate.reasons).toContain("Congressional selling dominates disclosed flow");
  });

  it("boosts long-short scores when committee jurisdiction matches the ticker", () => {
    const [withoutEdge] = scoreLongShortCandidates([
      longShort({
        ticker: "LMT",
        sector: "Industrials",
        buyCount: 2,
        sellCount: 0,
        politicianCount: 1,
        estimatedBuyVolume: 80_000,
      }),
    ]);
    const [withEdge] = scoreLongShortCandidates([
      longShort({
        ticker: "LMT",
        sector: "Industrials",
        buyCount: 2,
        sellCount: 0,
        politicianCount: 1,
        estimatedBuyVolume: 80_000,
        committeeRelevanceScore: 92,
        committeeRelevanceLabel: "High",
      }),
    ]);

    expect(withEdge.score).toBeGreaterThan(withoutEdge.score);
    expect(withEdge.reasons).toContain("Committee jurisdiction directly matches the ticker");
  });

  it("returns the long-short score components that make up the aggregate score", () => {
    const [candidate] = scoreLongShortCandidates([
      longShort({
        buyCount: 5,
        sellCount: 1,
        politicianCount: 3,
        estimatedBuyVolume: 1_200_000,
        estimatedSellVolume: 100_000,
        altDataBreadth: 2,
        insiderNetValue: 250_000,
        committeeRelevanceScore: 60,
        averageDisclosureLagDays: 32,
      }),
    ]);

    expect(candidate.scoreBreakdown).toMatchObject({
      flow: expect.any(Number),
      cluster: expect.any(Number),
      breadth: expect.any(Number),
      insider: expect.any(Number),
      committee: expect.any(Number),
      lagPenalty: 5,
    });
    expect(candidate.score).toBe(
      Math.round(
        candidate.scoreBreakdown.flow +
          candidate.scoreBreakdown.cluster +
          candidate.scoreBreakdown.breadth +
          candidate.scoreBreakdown.insider +
          candidate.scoreBreakdown.committee -
          candidate.scoreBreakdown.lagPenalty,
      ),
    );
  });

  it("detects quiet dark-flow accumulation when off-exchange activity confirms political buying", () => {
    const [candidate] = scoreDarkFlowCandidates([
      darkFlow({
        latestDarkPoolPercent: 74,
        averageDarkPoolPercent: 46,
        latestShortVolumePercent: 42,
        averageShortVolumePercent: 40,
        latestTotalVolume: 3_600_000,
        averageTotalVolume: 1_000_000,
        congressNetFlow: 1_400_000,
        insiderNetValue: 350_000,
        thirteenFNetShares: 500_000,
        socialMentions: 18,
        wikipediaViews: 90,
        politicalBeta: 1.2,
      }),
    ]);

    expect(candidate).toMatchObject({
      ticker: "NVDA",
      archetype: "Stealth Accumulation",
      stance: "Long Watch",
      confidence: "High",
    });
    expect(candidate.score).toBeGreaterThan(80);
    expect(candidate.reasons).toContain("Dark-pool participation is far above baseline");
    expect(candidate.reasons).toContain("Quiet attention profile");
  });

  it("flags social mania with short pressure as a crowded fade setup", () => {
    const [candidate] = scoreDarkFlowCandidates([
      darkFlow({
        ticker: "PLTR",
        latestDarkPoolPercent: 58,
        averageDarkPoolPercent: 45,
        latestShortVolumePercent: 82,
        averageShortVolumePercent: 44,
        latestTotalVolume: 4_200_000,
        averageTotalVolume: 1_100_000,
        congressNetFlow: -250_000,
        insiderNetValue: -900_000,
        socialMentions: 12_000,
        wikipediaViews: 18_000,
      }),
    ]);

    expect(candidate).toMatchObject({
      ticker: "PLTR",
      archetype: "Crowded Fade",
      stance: "Short Watch",
    });
    expect(candidate.reasons).toContain("Short-volume pressure is unusually high");
    expect(candidate.warnings).toContain("High squeeze risk because public attention is elevated");
  });

  it("nulls out off-exchange excess when there is no baseline", () => {
    // A single snapshot per ticker means latest === average by construction;
    // the page should render "—" rather than a misleading "0.0 pts".
    const [candidate] = scoreDarkFlowCandidates([
      darkFlow({
        offExchangeSampleSize: 1,
        congressNetFlow: 250_000,
      }),
    ]);

    expect(candidate.darkPoolExcess).toBeNull();
    expect(candidate.shortVolumeExcess).toBeNull();
    expect(candidate.volumeSurge).toBeNull();
    expect(candidate.hasOffExchangeBaseline).toBe(false);
    // Flow signals still surface so the row isn't dropped entirely.
    expect(candidate.congressNetFlow).toBe(250_000);
  });

  it("adds policy catalyst context from committee relevance in dark-flow scoring", () => {
    const [candidate] = scoreDarkFlowCandidates([
      darkFlow({
        ticker: "LMT",
        sector: "Industrials",
        latestDarkPoolPercent: 62,
        averageDarkPoolPercent: 48,
        congressNetFlow: 600_000,
        govContractValue: 3_000_000,
        committeeRelevanceScore: 95,
        committeeRelevanceLabel: "High",
      }),
    ]);

    expect(candidate.score).toBeGreaterThan(60);
    expect(candidate.reasons).toContain("Committee jurisdiction strengthens the policy edge");
  });
});
