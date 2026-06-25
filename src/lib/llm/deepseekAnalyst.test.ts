import { describe, expect, it } from "vitest";

import {
  buildAnalystAnalysisMessages,
  parseAnalystAnalysis,
  analystAnalysisToLegacyNote,
  deriveConviction,
} from "./deepseekAnalyst";
import type { AnalystAnalysis, AnalystLensRead, AnalystPosture, Ledger } from "@/lib/ledger/types";

const minimalLedger: Ledger = {
  ticker: "NVDA",
  companyName: "NVIDIA Corporation",
  generatedAt: "2026-06-02T00:00:00.000Z",
  lastClose: 135.5,
  scorecard: [{ label: "Long-term trend", value: "Above SMA50", signal: "BULL" }],
  trendGrid: [{ label: "Momentum (MACD)", verdict: "BULL", signal: "BULL" }],
  houseCall: {
    rating: "BUY",
    drivers: ["Revenue +114% YoY"],
    watchTrigger: "Watch for export restriction escalation",
    synthesis: "Strong momentum across all lenses.",
    score: 2,
    contributions: [],
  },
  forecast: {
    lastClose: 135.5,
    predictedClose: 148.0,
    changePct: 9.23,
    bandPct: 12.1,
    confidence: "WIDE",
    horizonDays: 30,
    probUp: null,
    expectedMovePct: null,
    suspect: false,
    suspectReason: null,
  },
  fundamentals: {
    annual: {
      fiscalLabel: "FY2026",
      periodEnd: "2026-01-25",
      form: "10-K",
      revenue: 130_497_000_000,
      revenueYoYPct: 114,
      grossMarginPct: 73.5,
      netIncome: 72_880_000_000,
      netIncomeYoYPct: 145,
      dilutedEps: 2.94,
    },
    quarter: null,
  },
  signals: {
    congressNetFlowLabel: "Buying",
    congressTradeCount: 12,
    insiderTradeCount: 3,
    thirteenFCount: 4,
    govContractCount: 0,
  },
  news: [
    { title: "NVDA crushes estimates again", publisher: "CNBC", url: null, publishedAt: null, summary: null, sentiment: "bullish", score: 0.9 },
    { title: "Export curbs loom large", publisher: "Reuters", url: null, publishedAt: null, summary: null, sentiment: "bearish", score: 0.7 },
  ],
  newsSkew: 0.5,
  consensusTarget: 160,
  bars: [],
  forecastPoints: [],
  analystNote: null,
  analystAnalysis: null,
  geopolitical: null,
  fundamentalsInsight: null,
  officialTrades: [],
  insiderTrades: [],
  longTermPlay: null,
  macro: null,
  options: null,
  valuation: null,
  analyst: null,
  shortInterest: null,
  nextEarnings: null,
  tradeLens: null,
  forecastTrackRecord: null,
  streetMomentum: null,
  altFlow: null,
  riskShift: null,
  forensics: null,
  segments: null,
};

const validAnalysis: AnalystAnalysis = {
  schemaVersion: 1,
  verdict: { action: "BUY", conviction: "medium", bottomLine: "Momentum and fundamentals back the BUY, but news risk caps conviction." },
  headline: "Momentum supports the rating, but risk remains visible",
  thesis: "The BUY call is supported by momentum and fundamentals, with news risk keeping conviction measured.",
  lensReads: [
    { lens: "technicals", posture: "bullish", summary: "Momentum supports the call.", evidence: ["Momentum (MACD) BULL"] },
    { lens: "fundamentals", posture: "unavailable", summary: "No fundamentals were available.", evidence: [] },
    { lens: "flows", posture: "neutral", summary: "Flow is not decisive.", evidence: ["congressNetFlowLabel Balanced"] },
    { lens: "news", posture: "mixed", summary: "News is mixed.", evidence: ["newsSkew 0.5"] },
  ],
  takeaways: [
    { kind: "support", label: "Support", text: "Momentum and fundamentals help." },
    { kind: "risk", label: "Risk", text: "News risk remains." },
    { kind: "watch", label: "Watch", text: "Watch momentum deterioration." },
  ],
  keyTension: "Positive direction with visible uncertainty.",
  whatWouldChange: "A breakdown in momentum would weaken the view.",
};

describe("deriveConviction", () => {
  const lens = (posture: AnalystPosture): AnalystLensRead => ({ lens: "technicals", posture, summary: "x", evidence: [] });

  it("BUY with >=4 bullish and <=1 bearish lenses is high", () => {
    expect(deriveConviction("BUY", [lens("bullish"), lens("bullish"), lens("bullish"), lens("bullish"), lens("neutral"), lens("bearish")])).toBe("high");
  });
  it("BUY with only 2 bullish lenses is low", () => {
    expect(deriveConviction("BUY", [lens("bullish"), lens("bullish"), lens("neutral"), lens("neutral"), lens("mixed"), lens("unavailable")])).toBe("low");
  });
  it("BUY with 3 bullish and 1 bearish is medium", () => {
    expect(deriveConviction("BUY", [lens("bullish"), lens("bullish"), lens("bullish"), lens("bearish"), lens("neutral"), lens("mixed")])).toBe("medium");
  });
  it("SELL mirrors BUY: 4 bearish is high", () => {
    expect(deriveConviction("SELL", [lens("bearish"), lens("bearish"), lens("bearish"), lens("bearish"), lens("neutral"), lens("bullish")])).toBe("high");
  });
  it("HOLD pulled >=2 each way is low", () => {
    expect(deriveConviction("HOLD", [lens("bullish"), lens("bullish"), lens("bearish"), lens("bearish"), lens("neutral"), lens("mixed")])).toBe("low");
  });
  it("HOLD that is mostly flat is medium", () => {
    expect(deriveConviction("HOLD", [lens("neutral"), lens("neutral"), lens("mixed"), lens("bullish"), lens("unavailable"), lens("unavailable")])).toBe("medium");
  });
  it("BUY with 4 bullish but 2 bearish is medium (high requires disagree<=1)", () => {
    expect(deriveConviction("BUY", [lens("bullish"), lens("bullish"), lens("bullish"), lens("bullish"), lens("bearish"), lens("bearish")])).toBe("medium");
  });
  it("BUY with 3 bullish and 0 bearish is medium (high requires agree>=4)", () => {
    expect(deriveConviction("BUY", [lens("bullish"), lens("bullish"), lens("bullish"), lens("neutral"), lens("neutral"), lens("unavailable")])).toBe("medium");
  });
});

describe("parseAnalystAnalysis", () => {
  it("parses valid structured JSON and attaches the deterministic verdict", () => {
    const out = parseAnalystAnalysis(JSON.stringify({
      schemaVersion: 1,
      bottomLine: "Momentum and fundamentals back the BUY; mind export-policy risk.",
      headline: "Momentum supports the rating, but risk remains visible",
      thesis: "The BUY call is supported by momentum and fundamentals, with news risk keeping conviction measured.",
      lensReads: [
        { lens: "technicals", posture: "bullish", summary: "Momentum supports the call.", evidence: ["Momentum (MACD) BULL"] },
        { lens: "fundamentals", posture: "bullish", summary: "Growth and margins are strong.", evidence: ["revenue +114% YoY"] },
        { lens: "valuation", posture: "bullish", summary: "Valuation is reasonable relative to peers.", evidence: ["P/E at sector avg"] },
        { lens: "news", posture: "mixed", summary: "News is mixed.", evidence: ["newsSkew 0.5"] },
      ],
      takeaways: [
        { kind: "support", label: "Support", text: "Momentum and fundamentals help." },
        { kind: "risk", label: "Risk", text: "News risk remains." },
        { kind: "watch", label: "Watch", text: "Watch momentum deterioration." },
      ],
      keyTension: "Positive direction with visible uncertainty.",
      whatWouldChange: "A breakdown in momentum would weaken the view.",
    }), "BUY");

    expect(out?.schemaVersion).toBe(1);
    expect(out?.verdict?.action).toBe("BUY");
    expect(out?.verdict?.conviction).toBe("medium");
    expect(out?.verdict?.bottomLine).toContain("BUY");
    expect(out?.lensReads).toHaveLength(4);
  });

  it("returns null for malformed or incomplete JSON", () => {
    expect(parseAnalystAnalysis("", "HOLD")).toBeNull();
    expect(parseAnalystAnalysis("{ nope", "HOLD")).toBeNull();
    expect(parseAnalystAnalysis(JSON.stringify({ schemaVersion: 1 }), "HOLD")).toBeNull();
  });

  it("trims over-long evidence/lensReads/takeaways instead of rejecting", () => {
    const lens = (summary: string, evidence: string[]) => ({ lens: "technicals", posture: "bullish", summary, evidence });
    const out = parseAnalystAnalysis(JSON.stringify({
      schemaVersion: 1,
      bottomLine: "A decisive one-line bottom line for the verdict goes here.",
      headline: "Momentum supports the rating, but risk remains visible",
      thesis: "The BUY call is supported by momentum and fundamentals, with news risk keeping conviction measured.",
      lensReads: [
        lens("Momentum supports the call.", ["a", "b", "c", "d", "e", "f"]),
        lens("Second lens read.", ["x"]), lens("Third lens read.", ["x"]), lens("Fourth lens read.", ["x"]),
        lens("Fifth lens read.", ["x"]), lens("Sixth lens read.", ["x"]), lens("Seventh lens over the cap.", ["z"]),
      ],
      takeaways: [
        { kind: "support", label: "Support", text: "Momentum and fundamentals help." },
        { kind: "risk", label: "Risk", text: "News risk remains." },
        { kind: "watch", label: "Watch", text: "Watch momentum deterioration." },
        { kind: "support", label: "Support 2", text: "Second support point of view." },
        { kind: "risk", label: "Risk 2", text: "A fifth takeaway over the cap." },
      ],
      keyTension: "Positive direction with visible uncertainty.",
      whatWouldChange: "A breakdown in momentum would weaken the view.",
    }), "BUY");
    expect(out).not.toBeNull();
    expect(out!.lensReads).toHaveLength(6);
    expect(out!.lensReads[0].evidence).toHaveLength(4);
    expect(out!.takeaways).toHaveLength(4);
  });
});

describe("buildAnalystAnalysisMessages", () => {
  it("builds messages that request JSON mode-compatible output", () => {
    const messages = buildAnalystAnalysisMessages(minimalLedger);
    expect(messages.system.toLowerCase()).toContain("json");
    expect(messages.system).toContain("Return only valid JSON");
    expect(messages.user).toContain("requiredJsonExample");
    expect(messages.user).toContain("NVDA");
  });
});

describe("analystAnalysisToLegacyNote", () => {
  it("converts structured analysis to a legacy note string with the verdict first", () => {
    const note = analystAnalysisToLegacyNote(validAnalysis);
    expect(note.startsWith("BUY — medium conviction.")).toBe(true);
    expect(note).toContain(validAnalysis.thesis);
    expect(note).toContain(validAnalysis.keyTension);
    expect(note).toContain(validAnalysis.whatWouldChange);
  });
});

describe("buildAnalystAnalysisMessages enrichment", () => {
  const ledger = {
    ticker: "NVDA",
    companyName: "NVIDIA Corp.",
    lastClose: 170,
    houseCall: { rating: "BUY" },
    scorecard: [],
    trendGrid: [],
    newsSkew: 0.2,
    news: [],
    fundamentals: {
      annual: null,
      quarter: null,
      earnings: { fiscalLabel: "FY2025", periodEnd: "2025-01-31", form: "10-K", lines: [],
        trend: [{ fiscalLabel: "FY2025", revenue: 1, operatingMarginPct: 62, netMarginPct: 55, fcfMarginPct: 48 }] },
    },
    forensics: { overall: "clean", yearsAnalyzed: 3,
      patterns: [{ key: "fcf_vs_ni", label: "FCF vs net income", verdict: "clean", metric: "FCF/NI 0.95 over 3y", detail: "" }] },
    segments: { fiscalLabel: "FY2025", reconciledPct: 98, note: "",
      segments: [{ name: "Data Center", revenue: 1, sharePct: 78, yoyPct: 120 }] },
    valuation: { peTrailing: 50, peForward: 38, priceToSales: 30, priceToBook: 40, pegRatio: 1.2, evToEbitda: 28.4, read: "expensive" },
    analyst: { targetMean: 180, targetHigh: 220, targetLow: 140, numAnalysts: 50, recommendationKey: "buy",
      recommendationMean: 1.8, upsidePct: 6, counts: { strongBuy: 30, buy: 15, hold: 5, sell: 0, strongSell: 0 } },
    shortInterest: { sharesShort: 1, percentOfFloat: 1.2, daysToCover: 0.8, priorSharesShort: 1, changePct: -5 },
    options: { asOf: "", expiration: "", putCallVolume: 0.8, putCallOI: 0.9, atmIvPct: 42, ivSkewPct: 1,
      expectedMovePct: 7.5, lean: "neutral", daysToExp: 30, expectedMove60dPct: 10, expiration60d: "", ivRankPct: 40 },
    streetMomentum: { revisions: [], trendDeltas: [], surprises: [], beatCount: 4, surpriseTotal: 4, avgSurprisePct: 8,
      upgrades30: 6, downgrades30: 1, recentActions: [], pead: { active: true, daysSinceReport: 3, lastSurprisePct: 8, direction: "up" }, read: "improving" },
    altFlow: {
      wsb: { mentions7d: 400, mentionsPrior7d: 100, surgeRatio: 4, latestSentiment: 0.6, crowded: true },
      darkShort: { latestShortVolPct: 40, baselineShortVolPct: 34, excessPp: 6, sampleSize: 20 },
      thirteenF: { netChangeShares: 1000, holderCount: 50, topHolders: [], reportDate: null },
      govContracts: { count180d: 2, totalUsd180d: 5_000_000, recent: [] },
    },
    geopolitical: { summary: "Export controls weigh.", netLean: "headwind",
      factors: [{ event: "US export curbs", impact: "negative", score: -2, rationale: "", url: null, publisher: null }] },
    riskShift: { newRisks: ["New export-control risk language"], removedRisks: [], shiftSummary: "Added export-control risk.",
      fromFiling: "10-K 2025", toFiling: "10-K 2026" },
    macro: { asOf: "", score: 10, label: "risk-on", factors: [], note: "Curve steepening.", confidence: "ok" },
    fundamentalsInsight: { schemaVersion: 1, interpretation: "Strong growth with durable margins.", riskFactors: ["Customer concentration"] },
    signals: { congressNetFlowLabel: "Net buying", congressTradeCount: 2, insiderTradeCount: 1, thirteenFCount: 5, govContractCount: 2 },
  } as unknown as Ledger;

  it("directs the model to six lenses and a decisive bottom line", () => {
    const { system } = buildAnalystAnalysisMessages(ledger);
    expect(system).toContain("valuation");
    expect(system).toContain("positioning");
    expect(system).toContain("bottomLine");
  });

  it("feeds valuation, positioning, forensics, segments, geo and alt-flow into the user payload", () => {
    const { user } = buildAnalystAnalysisMessages(ledger);
    const parsed = JSON.parse(user);
    expect(parsed.valuation.read).toBe("expensive");
    expect(parsed.valuation.evToEbitda).toBe(28.4);
    expect(parsed.analystConsensus.upsidePct).toBe(6);
    expect(parsed.positioning.options.lean).toBe("neutral");
    expect(parsed.positioning.shortInterest.percentOfFloat).toBe(1.2);
    expect(parsed.positioning.streetMomentum.read).toBe("improving");
    expect(parsed.fundamentals.margins.operatingMarginPct).toBe(62);
    expect(parsed.fundamentals.forensics.overall).toBe("clean");
    expect(parsed.fundamentals.forensics.patterns[0]).toContain("FCF/NI 0.95 over 3y");
    expect(parsed.fundamentals.segments.top[0].name).toBe("Data Center");
    expect(parsed.flows.altFlow.darkShortExcessPp).toBe(6);
    expect(parsed.news.geopolitical.netLean).toBe("headwind");
    expect(parsed.news.riskShift.shiftSummary).toBe("Added export-control risk.");
    expect(parsed.macro.label).toBe("risk-on");
  });

  it("emits explicit nulls for missing sub-signals instead of throwing", () => {
    const sparse = {
      ticker: "ABC",
      companyName: "Abc Inc.",
      lastClose: 10,
      houseCall: { rating: "HOLD" },
      scorecard: [],
      trendGrid: [],
      newsSkew: 0,
      news: [],
      fundamentals: null,
      forensics: null,
      segments: null,
      valuation: null,
      analyst: null,
      shortInterest: null,
      options: null,
      streetMomentum: null,
      altFlow: { wsb: null, darkShort: null, thirteenF: null, govContracts: null },
      geopolitical: null,
      riskShift: null,
      macro: null,
      fundamentalsInsight: null,
      signals: null,
    } as unknown as Ledger;

    const { user } = buildAnalystAnalysisMessages(sparse);
    const parsed = JSON.parse(user);
    expect(parsed.valuation).toBeNull();
    expect(parsed.fundamentals.forensics).toBeNull();
    expect(parsed.positioning.options).toBeNull();
    expect(parsed.flows.altFlow.darkShortExcessPp).toBeNull();
    expect(parsed.flows.altFlow.wsbCrowded).toBeNull();
    expect(parsed.macro).toBeNull();
  });
});
