// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildLongTermPlayPrompt, correlateReturns, parseLongTermPlay, resolveLongTermDrivers } from "./longTermPlay";
import type { Ledger } from "./types";
import type { StockAnalysis } from "@/lib/queries/stockAnalysis";

const ledger = {
  ticker: "IT",
  companyName: "Gartner Inc.",
  houseCall: { rating: "HOLD", drivers: [], watchTrigger: "", synthesis: "Mixed setup." },
  fundamentals: {
    annual: {
      fiscalLabel: "FY2025",
      periodEnd: "2025-12-31",
      form: "10-K",
      revenue: 6_270_000_000,
      revenueYoYPct: 6.4,
      grossMarginPct: 68.1,
      netIncome: 1_020_000_000,
      netIncomeYoYPct: 8.2,
      dilutedEps: 12.4,
    },
    quarter: null,
  },
  signals: { congressNetFlowLabel: "Balanced", congressTradeCount: 0, insiderTradeCount: 1, thirteenFCount: 4, govContractCount: 0 },
  news: [
    {
      title: "Enterprise technology budgets stabilize",
      publisher: "Example",
      url: null,
      publishedAt: null,
      summary: "CIOs continue to prioritize AI and cloud projects.",
      sentiment: "bullish",
      score: 0.72,
    },
  ],
  geopolitical: null,
  fundamentalsInsight: {
    schemaVersion: 1,
    interpretation: "Revenue is growing at a moderate rate with durable margins.",
    riskFactors: ["Clients could reduce discretionary IT advisory budgets."],
  },
} as unknown as Ledger;

const analysis = {
  detail: {
    stock: {
      ticker: "IT",
      companyName: "Gartner Inc.",
      sector: "Technology",
      industry: "Information Technology Services",
      marketCap: 34_000_000_000,
    },
    alternativeData: [
      { label: "Patents", count: 2 },
      { label: "Lobbying", count: 3 },
    ],
  },
  sourceRows: {
    patents: [
      {
        id: 1,
        patentNumber: "US123",
        title: "AI-assisted procurement recommendation engine",
        effectiveDate: new Date("2026-01-01"),
        filedAt: null,
        grantedAt: null,
        inventors: null,
      },
    ],
    govContracts: [],
    lobbying: [
      {
        id: 2,
        client: "Gartner Inc.",
        registrant: "Example",
        amount: 50_000,
        filingPeriod: "2026 Q1",
        issue: "Artificial intelligence policy and enterprise software procurement",
        filedAt: null,
      },
    ],
    holdings: [],
    offExchange: [],
    attention: [],
    politicalBeta: [],
  },
} as unknown as StockAnalysis;

const validJson = {
  schemaVersion: 1,
  horizon: "3-10 years",
  summary: "Gartner is a long-term bet on enterprise technology complexity, AI advisory demand, and resilient research subscriptions.",
  ifYouBelieve: "If you believe enterprises will keep increasing AI, cloud, cybersecurity, and software advisory spend, Gartner benefits from sitting in the IT decision layer.",
  whyItMatters: [
    "Recurring advisory relationships can compound if technology budgets remain complex.",
    "AI adoption creates demand for vendor selection, governance, and procurement guidance.",
  ],
  themes: [
    {
      name: "Enterprise AI advisory",
      score: 0.78,
      direction: "tailwind",
      summary: "AI strategy work can expand Gartner's role in CIO decision-making.",
      evidence: ["AI-assisted procurement patent", "Enterprise technology budgets stabilize"],
      risk: "Clients may automate some research and advisory workflows internally.",
    },
  ],
  confirmingSignals: ["Renewal strength", "Margin durability", "AI advisory growth"],
  breakingSignals: ["Weak IT budget commentary", "Client churn", "Margin compression"],
  dataGaps: ["Segment-level AI advisory revenue was not available."],
};

describe("parseLongTermPlay", () => {
  it("parses a valid DeepSeek JSON response into a long-term play", () => {
    expect(parseLongTermPlay(JSON.stringify(validJson))).toEqual({ ...validJson, drivers: [] });
  });

  it("rejects malformed scores outside the 0 to 1 range", () => {
    const invalid = {
      ...validJson,
      themes: [{ ...validJson.themes[0], score: 1.4 }],
    };

    expect(parseLongTermPlay(JSON.stringify(invalid))).toBeNull();
  });
});

describe("buildLongTermPlayPrompt", () => {
  it("grounds the future-thesis prompt in report data and forbids direct buy advice", () => {
    const prompt = buildLongTermPlayPrompt(ledger, analysis);

    expect(prompt).toContain("Gartner Inc.");
    expect(prompt).toContain("Information Technology Services");
    expect(prompt).toContain("AI-assisted procurement recommendation engine");
    expect(prompt).toContain("Artificial intelligence policy and enterprise software procurement");
    expect(prompt).toContain("Enterprise technology budgets stabilize");
    expect(prompt).toContain("Return ONLY JSON");
    expect(prompt).toContain("Do not tell the user to buy, sell, or hold");
    expect(prompt).toContain('"themes"');
    expect(prompt).toContain('"score"');
    expect(prompt).toContain("6 to 8");
    expect(prompt).toMatch(/mix of drivers/i);
  });
});

const validBase = {
  schemaVersion: 1,
  horizon: "3-10 years",
  summary: "This stock is a long-term bet on enterprise AI infrastructure and durable software demand.",
  ifYouBelieve: "If enterprise AI workloads keep compounding, the company benefits via cloud and platform scale.",
  whyItMatters: ["Multiple ways to monetize the same long-term tech budget."],
  themes: [{ name: "Enterprise AI", score: 0.8, direction: "tailwind", summary: "AI workload growth supports demand.", evidence: ["sector: Technology"], risk: "Capex intensity may dilute returns." }],
  confirmingSignals: ["Segment growth acceleration"],
  breakingSignals: ["Weak demand commentary"],
  dataGaps: [],
};

describe("parseLongTermPlay normalization", () => {
  it("trims over-long themes/evidence/bullets instead of rejecting", () => {
    const out = parseLongTermPlay(JSON.stringify({
      ...validBase,
      whyItMatters: Array.from({ length: 8 }, (_, i) => `point ${i}`),
      themes: Array.from({ length: 7 }, (_, i) => ({
        name: `Theme ${i}`, score: 0.5, direction: "tailwind",
        summary: "A grounded theme summary line.",
        evidence: Array.from({ length: 6 }, (_, j) => `ev ${j}`),
        risk: "Some risk to the thesis.",
      })),
    }));
    expect(out).not.toBeNull();
    expect(out!.themes.length).toBe(5);
    expect(out!.themes[0].evidence.length).toBe(4);
    expect(out!.whyItMatters.length).toBe(5);
  });
});

describe("parseLongTermPlay drivers", () => {
  it("parses driver entries (label/symbol/why) with empty points and drops empty symbols", () => {
    const out = parseLongTermPlay(JSON.stringify({
      ...validBase,
      drivers: [
        { label: "Semiconductors", symbol: "SOXX", why: "Compute demand proxy" },
        { label: "10Y Yield", symbol: "^TNX", why: "Discount rate on long-duration growth" },
        { label: "Bad", symbol: "", why: "no symbol" },
      ],
    }));
    expect(out).not.toBeNull();
    expect(out!.drivers.map((d) => d.symbol)).toEqual(["SOXX", "^TNX"]);
    expect(out!.drivers[0].points).toEqual([]);
  });

  it("defaults drivers to [] when the model omits them", () => {
    const out = parseLongTermPlay(JSON.stringify(validBase));
    expect(out).not.toBeNull();
    expect(out!.drivers).toEqual([]);
  });

  it("keeps up to 8 drivers and trims a 9th instead of rejecting", () => {
    const out = parseLongTermPlay(JSON.stringify({
      ...validBase,
      drivers: Array.from({ length: 9 }, (_, i) => ({ label: `Driver ${i}`, symbol: `SYM${i}`, why: "industry driver" })),
    }));
    expect(out).not.toBeNull();
    expect(out!.drivers.length).toBe(8);
  });
});

describe("resolveLongTermDrivers", () => {
  it("keeps drivers whose fetch returns enough points, mapping to {date,close}", async () => {
    const fetcher = async (symbol: string) => {
      if (symbol === "SOXX") return Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.UTC(2025, 0, i + 1)), close: 200 + i }));
      if (symbol === "^TNX") return [{ date: new Date(Date.UTC(2025, 0, 1)), close: 4.2 }];
      return [];
    };
    const out = await resolveLongTermDrivers(
      [
        { label: "Semis", symbol: "SOXX", why: "x", points: [] },
        { label: "10Y", symbol: "^TNX", why: "y", points: [] },
        { label: "Bad", symbol: "ZZZZ", why: "z", points: [] },
      ],
      fetcher,
    );
    expect(out.map((d) => d.symbol)).toEqual(["SOXX"]);
    expect(out[0].points[0]).toEqual({ date: "2025-01-01", close: 200 });
    expect(out[0].points.length).toBe(30);
  });
});

describe("correlateReturns", () => {
  const mkSeries = (closes: number[], startDay = 1) =>
    closes.map((c, i) => ({ date: `2025-01-${String(startDay + i).padStart(2, "0")}`, close: c }));

  // Alternating (non-monotonic) closes so daily RETURNS have an unambiguous sign.
  it("returns ~+1 when the two series move in the same direction each day", () => {
    const a = mkSeries([100, 105, 100, 105, 100, 105, 100, 105, 100, 105, 100]);
    const b = mkSeries([200, 210, 200, 210, 200, 210, 200, 210, 200, 210, 200]);
    expect(correlateReturns(a, b)!).toBeGreaterThan(0.95);
  });

  it("returns ~−1 when they move oppositely each day", () => {
    const a = mkSeries([100, 105, 100, 105, 100, 105, 100, 105, 100, 105, 100]);
    const b = mkSeries([200, 190, 200, 190, 200, 190, 200, 190, 200, 190, 200]);
    expect(correlateReturns(a, b)!).toBeLessThan(-0.95);
  });

  it("returns null with fewer than 10 overlapping return points", () => {
    const a = mkSeries([100, 105, 100]);
    const b = mkSeries([200, 210, 200]);
    expect(correlateReturns(a, b)).toBeNull();
  });

  it("aligns on dates, ignoring a driver's non-overlapping trailing days", () => {
    const a = mkSeries([100, 105, 100, 105, 100, 105, 100, 105, 100, 105, 100], 1);            // days 1-11
    const b = mkSeries([200, 210, 200, 210, 200, 210, 200, 210, 200, 210, 200, 210, 200], 1);  // days 1-13
    expect(correlateReturns(a, b)!).toBeGreaterThan(0.95);
  });
});
