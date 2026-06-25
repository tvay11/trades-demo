import { describe, it, expect } from "vitest";
import { buildAskPrompt, MAX_QUESTION_LEN } from "./askReport";
import type { Ledger } from "./types";

const LEDGER: Ledger = {
  ticker: "NVDA", companyName: "NVIDIA Corp", generatedAt: "2026-06-01T00:00:00.000+00:00",
  lastClose: 1200, scorecard: [{ label: "RSI(14)", value: "61.2", signal: "BULL" }],
  trendGrid: [], houseCall: { rating: "HOLD", drivers: ["Strong trend", "Tired tape"], watchTrigger: "Below SMA50", synthesis: "Mixed." },
  forecast: { lastClose: 1200, predictedClose: 1260, changePct: 5, bandPct: 12, confidence: "MODERATE", horizonDays: 30 },
  fundamentals: { annual: { fiscalLabel: "FY2026", periodEnd: "2026-01-31", form: "10-K", revenue: 215_900_000_000, revenueYoYPct: 78, grossMarginPct: 71.1, netIncome: 1e11, netIncomeYoYPct: 90, dilutedEps: 4.1 }, quarter: null },
  signals: { congressNetFlowLabel: "Buying", congressTradeCount: 5, insiderTradeCount: 2, thirteenFCount: 3, govContractCount: 0 },
  news: [{ title: "Beats earnings", publisher: "WSJ", url: "u", publishedAt: null, summary: null, sentiment: "bullish", score: 0.8 }],
  newsSkew: 2,
  analystAnalysis: { schemaVersion: 1, headline: "Strong trend, tired tape", thesis: "Momentum intact but extended.", lensReads: [], takeaways: [], keyTension: "Valuation vs momentum", whatWouldChange: "A break of SMA50" },
  analystNote: null,
  geopolitical: { summary: "Export-control overhang.", netLean: "headwind", factors: [] },
  fundamentalsInsight: { schemaVersion: 1, interpretation: "Margins expanding on AI demand.", riskFactors: ["Export controls"] },
} as unknown as Ledger;

const LEDGER_WITH_TRADES: Ledger = {
  ...LEDGER,
  officialTrades: [
    {
      branch: "congress",
      name: "Jane Smith",
      party: "D",
      state: "CA",
      agency: null,
      action: "buy",
      transactionType: "Purchase",
      amountMin: 15000,
      amountMax: 50000,
      amountRangeRaw: "$15,001 - $50,000",
      transactionDate: "2026-05-01",
      disclosureDate: "2026-05-10",
    },
  ],
  insiderTrades: [
    {
      name: "John Doe",
      title: "CEO",
      action: "sell",
      transactionType: "S",
      shares: 5000,
      pricePerShare: 200,
      totalValue: 1000000,
      transactionDate: "2026-05-15",
      filingDate: "2026-05-17",
    },
  ],
} as unknown as Ledger;

describe("buildAskPrompt", () => {
  it("embeds the question and key report facts with a strict grounding instruction", () => {
    const p = buildAskPrompt(LEDGER, "Why is the rating only HOLD?");
    expect(p).toContain("Why is the rating only HOLD?");
    expect(p).toContain("NVDA");
    expect(p).toContain("HOLD");
    expect(p).toContain("Strong trend, tired tape");           // analyst headline
    expect(p).toContain("Margins expanding on AI demand.");     // fundamentals insight
    expect(p).toContain("Export-control overhang.");            // geopolitical
    expect(p.toLowerCase()).toContain("only");                  // "Answer ONLY using the report data"
    expect(p.toLowerCase()).toContain("not financial advice");
  });
  it("notes when the forecast is absent", () => {
    const p = buildAskPrompt({ ...LEDGER, forecast: null } as unknown as Ledger, "What is the forecast?");
    expect(p).toContain("not available in this report");
  });
  it("exposes a question length cap", () => {
    expect(MAX_QUESTION_LEN).toBeGreaterThan(0);
  });
  it("includes official and insider trade filer names when present", () => {
    const p = buildAskPrompt(LEDGER_WITH_TRADES, "Any notable trades?");
    expect(p).toContain("Jane Smith");
    expect(p).toContain("congress");
    expect(p).toContain("John Doe");
    expect(p).toContain("CEO");
  });
});
