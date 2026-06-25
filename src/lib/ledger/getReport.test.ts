// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { Ledger } from "./types";
import { normalizeLedgerSnapshot } from "./getReport";

const snapshot: Ledger = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  generatedAt: "2026-06-05T12:00:00.000Z",
  lastClose: 200,
  scorecard: [],
  trendGrid: [],
  houseCall: {
    rating: "HOLD",
    drivers: ["Mixed setup"],
    watchTrigger: "Watch the next close",
    synthesis: "The setup is mixed.",
    score: 0,
    contributions: [],
  },
  forecast: null,
  fundamentals: null,
  signals: null,
  news: [],
  newsSkew: 0,
  consensusTarget: null,
  bars: [{ date: "2026-06-04", open: 199, high: 201, low: 198, close: 200, volume: 1000 }],
  forecastPoints: [],
  analystNote: null,
  analystAnalysis: null,
  geopolitical: null,
  fundamentalsInsight: null,
  longTermPlay: null,
  macro: null,
  options: null,
  valuation: null,
  analyst: null,
  shortInterest: null,
  nextEarnings: null,
  officialTrades: [
    {
      branch: "congress",
      name: "Example Filer",
      party: "D",
      state: "CA",
      agency: null,
      action: "buy",
      transactionType: "purchase",
      amountMin: 1000,
      amountMax: 15000,
      amountRangeRaw: "$1,001 - $15,000",
      transactionDate: "2026-05-01",
      disclosureDate: "2026-05-10",
    },
  ],
  insiderTrades: [
    {
      name: "Example Insider",
      title: "CFO",
      action: "sell",
      transactionType: "sale",
      shares: 100,
      pricePerShare: 200,
      totalValue: 20000,
      transactionDate: "2026-05-02",
      filingDate: "2026-05-04",
    },
  ],
  tradeLens: null,
  forecastTrackRecord: null,
  streetMomentum: null,
  altFlow: null,
  riskShift: null,
  forensics: null,
  segments: null,
};

describe("normalizeLedgerSnapshot", () => {
  it("backfills missing trade arrays for legacy stored report payloads", () => {
    const legacySnapshot = { ...snapshot };
    delete (legacySnapshot as Partial<Ledger>).officialTrades;
    delete (legacySnapshot as Partial<Ledger>).insiderTrades;

    expect(normalizeLedgerSnapshot(legacySnapshot as Ledger)).toMatchObject({
      officialTrades: [],
      insiderTrades: [],
    });
  });

  it("preserves existing trade arrays from current report payloads", () => {
    expect(normalizeLedgerSnapshot(snapshot)).toMatchObject({
      officialTrades: snapshot.officialTrades,
      insiderTrades: snapshot.insiderTrades,
    });
  });

  it("normalizes legacy geopolitical magnitude labels to numeric scores", () => {
    const legacySnapshot = {
      ...snapshot,
      geopolitical: {
        summary: "Export controls remain a headwind.",
        netLean: "headwind",
        factors: [
          {
            event: "US export controls",
            impact: "negative",
            magnitude: "high",
            rationale: "Limits China revenue.",
            url: "https://example.com",
            publisher: "Example",
          },
        ],
      },
    } as unknown as Ledger;

    expect(normalizeLedgerSnapshot(legacySnapshot).geopolitical?.factors[0]).toMatchObject({
      impact: "negative",
      score: 0.85,
    });
  });

  it("round-trips facet-based geopolitical factors with score and facets intact", () => {
    const facetSnapshot = {
      ...snapshot,
      geopolitical: {
        summary: "Export controls remain a headwind.",
        netLean: "headwind",
        factors: [
          {
            event: "US export controls",
            impact: "negative",
            score: 0.9,
            channel: "sanctions_export_controls",
            exposure: "company_targeted",
            status: "in_effect",
            rationale: "Limits China revenue.",
            url: "https://example.com",
            publisher: "Example",
          },
        ],
      },
    } as unknown as Ledger;

    expect(normalizeLedgerSnapshot(facetSnapshot).geopolitical?.factors[0]).toMatchObject({
      score: 0.9,
      channel: "sanctions_export_controls",
      exposure: "company_targeted",
      status: "in_effect",
    });
  });

  it("normalizes legacy news without scores to moderate numeric scores", () => {
    const legacySnapshot = {
      ...snapshot,
      news: [
        {
          title: "Legacy headline",
          publisher: "Example",
          url: null,
          publishedAt: null,
          summary: null,
          sentiment: "bullish",
        },
      ],
    } as Ledger;

    expect(normalizeLedgerSnapshot(legacySnapshot).news[0]).toMatchObject({
      title: "Legacy headline",
      sentiment: "bullish",
      score: 0.5,
    });
  });

  it("backfills missing longTermPlay as null for legacy report payloads", () => {
    const legacySnapshot = { ...snapshot };
    delete (legacySnapshot as Partial<Ledger>).longTermPlay;

    expect(normalizeLedgerSnapshot(legacySnapshot as Ledger).longTermPlay).toBeNull();
  });

  it("backfills suspect/suspectReason on legacy forecast that lacks those fields", () => {
    const legacyForecast = {
      lastClose: 200,
      predictedClose: 210,
      changePct: 5,
      bandPct: 8,
      confidence: "MODERATE" as const,
      horizonDays: 30,
      probUp: 60,
      expectedMovePct: 5,
      // suspect and suspectReason intentionally absent (legacy)
    };
    const legacySnapshot = {
      ...snapshot,
      forecast: legacyForecast,
    } as unknown as Ledger;

    const result = normalizeLedgerSnapshot(legacySnapshot);
    expect(result.forecast?.suspect).toBe(false);
    expect(result.forecast?.suspectReason).toBeNull();
  });

  it("backfills missing forecastTrackRecord as null for legacy report payloads", () => {
    const legacySnapshot = { ...snapshot };
    delete (legacySnapshot as Partial<Ledger>).forecastTrackRecord;

    expect(normalizeLedgerSnapshot(legacySnapshot as Ledger).forecastTrackRecord).toBeNull();
  });

  it("backfills streetMomentum null for legacy snapshots", () => {
    const legacySnapshot = { ...snapshot };
    delete (legacySnapshot as Partial<Ledger>).streetMomentum;
    expect(normalizeLedgerSnapshot(legacySnapshot as Ledger).streetMomentum).toBeNull();
  });

  it("backfills altFlow null for legacy snapshots", () => {
    const legacySnapshot = { ...snapshot };
    delete (legacySnapshot as Partial<Ledger>).altFlow;
    expect(normalizeLedgerSnapshot(legacySnapshot as Ledger).altFlow).toBeNull();
  });

  it("backfills riskShift null for legacy snapshots", () => {
    const legacySnapshot = { ...snapshot };
    delete (legacySnapshot as Partial<Ledger>).riskShift;
    expect(normalizeLedgerSnapshot(legacySnapshot as Ledger).riskShift).toBeNull();
  });
});
