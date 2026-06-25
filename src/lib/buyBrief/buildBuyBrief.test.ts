import { describe, expect, it } from "vitest";

import type { BuyBriefEnrichmentRow } from "@/lib/queries/buyBriefEnrichment";
import type { ExecutiveSignal } from "@/lib/queries/executiveSignals";
import type { DualInsiderSignal } from "@/lib/queries/dualInsider";
import type { DarkFlowCandidate, LongShortCandidate } from "@/lib/queries/marketSignals";
import type { StockListRow } from "@/lib/queries/stocksList";

import { BUY_BRIEF_PROMPT, buildBuyBrief } from "./buildBuyBrief";

function ls(overrides: Partial<LongShortCandidate> & { ticker: string }): LongShortCandidate {
  return {
    ticker: overrides.ticker,
    companyName: overrides.companyName ?? `${overrides.ticker} Inc`,
    sector: overrides.sector ?? "Tech",
    stance: overrides.stance ?? "Long",
    confidence: overrides.confidence ?? "High",
    score: overrides.score ?? 50,
    scoreBreakdown: overrides.scoreBreakdown ?? {
      flow: 1,
      cluster: 2,
      breadth: 3,
      insider: 4,
      committee: 5,
      lagPenalty: 6,
    },
    netFlow: overrides.netFlow ?? 1000,
    estimatedBuyVolume: overrides.estimatedBuyVolume ?? 9000,
    estimatedSellVolume: overrides.estimatedSellVolume ?? 8000,
    buyPressure: overrides.buyPressure ?? 9100,
    sellPressure: overrides.sellPressure ?? 8100,
    buyCount: overrides.buyCount ?? 3,
    sellCount: overrides.sellCount ?? 1,
    politicianCount: overrides.politicianCount ?? 2,
    insiderNetValue: overrides.insiderNetValue ?? 500,
    averageDisclosureLagDays: overrides.averageDisclosureLagDays ?? 12,
    latestDisclosureDate: overrides.latestDisclosureDate ?? null,
    committeeRelevanceScore: overrides.committeeRelevanceScore ?? 42,
    committeeRelevanceLabel: overrides.committeeRelevanceLabel ?? "Medium",
    reasons: overrides.reasons ?? ["strong flow"],
    warnings: overrides.warnings ?? [],
  };
}

function df(overrides: Partial<DarkFlowCandidate> & { ticker: string }): DarkFlowCandidate {
  return {
    ticker: overrides.ticker,
    companyName: overrides.companyName ?? `${overrides.ticker} Inc`,
    sector: overrides.sector ?? "Tech",
    archetype: overrides.archetype ?? "Stealth Accumulation",
    stance: overrides.stance ?? "Long Watch",
    confidence: overrides.confidence ?? "Medium",
    score: overrides.score ?? 40,
    darkPoolExcess: overrides.darkPoolExcess ?? 1.5,
    shortVolumeExcess: overrides.shortVolumeExcess ?? null,
    volumeSurge: overrides.volumeSurge ?? 0.2,
    hasOffExchangeBaseline: overrides.hasOffExchangeBaseline ?? true,
    socialHeat: overrides.socialHeat ?? 10,
    congressNetFlow: overrides.congressNetFlow ?? 700,
    insiderNetValue: overrides.insiderNetValue ?? 300,
    govContractValue: overrides.govContractValue ?? 0,
    latestDate: overrides.latestDate ?? null,
    committeeRelevanceScore: overrides.committeeRelevanceScore ?? 33,
    committeeRelevanceLabel: overrides.committeeRelevanceLabel ?? "Medium",
    reasons: overrides.reasons ?? ["dark pool buildup"],
    warnings: overrides.warnings ?? [],
  };
}

function di(overrides: Partial<DualInsiderSignal> & { ticker: string }): DualInsiderSignal {
  return {
    ticker: overrides.ticker,
    direction: overrides.direction ?? "Bullish",
    congressBuyCount: overrides.congressBuyCount ?? 4,
    congressSellCount: overrides.congressSellCount ?? 1,
    congressVolume: overrides.congressVolume ?? 250000,
    congressPoliticians: overrides.congressPoliticians ?? ["Rep A", "Sen B"],
    latestCongressDate: overrides.latestCongressDate ?? "2026-05-01",
    insiderBuyCount: overrides.insiderBuyCount ?? 2,
    insiderSellCount: overrides.insiderSellCount ?? 0,
    insiderVolume: overrides.insiderVolume ?? 120000,
    insiderNames: overrides.insiderNames ?? ["CEO X"],
    latestInsiderDate: overrides.latestInsiderDate ?? "2026-05-03",
    alignmentScore: overrides.alignmentScore ?? 70,
    overlapWindowDays: overrides.overlapWindowDays ?? 14,
  };
}

function stock(overrides: Partial<StockListRow> & { ticker: string }): StockListRow {
  return {
    ticker: overrides.ticker,
    companyName: overrides.companyName ?? `${overrides.ticker} Inc`,
    sector: overrides.sector ?? "Tech",
    industry: overrides.industry ?? "Semiconductors",
    country: overrides.country ?? "US",
    marketCap: overrides.marketCap ?? 1_000_000_000,
    tradeCount14: overrides.tradeCount14 ?? 1,
    tradeCount30: overrides.tradeCount30 ?? 2,
    tradeCount60: overrides.tradeCount60 ?? 3,
    tradeCount90: overrides.tradeCount90 ?? 4,
    tradeCount365: overrides.tradeCount365 ?? 5,
  };
}

function enrich(
  overrides: Partial<BuyBriefEnrichmentRow> & { ticker: string },
): BuyBriefEnrichmentRow {
  return {
    ticker: overrides.ticker,
    lastClose: overrides.lastClose ?? 15000,
    lastCloseDate: overrides.lastCloseDate ?? new Date("2026-05-28T00:00:00.000Z"),
    return30dPct: overrides.return30dPct ?? 4.2,
    return90dPct: overrides.return90dPct ?? 12.5,
    instHolders: overrides.instHolders ?? 8,
    instTotalShares: overrides.instTotalShares ?? 1_200_000,
    instShareChange: overrides.instShareChange ?? 50_000,
    instReportDate: overrides.instReportDate ?? new Date("2026-03-31T00:00:00.000Z"),
    govContractUsd1y: overrides.govContractUsd1y ?? 0,
    govContractCount1y: overrides.govContractCount1y ?? 0,
    lobbyingUsd1y: overrides.lobbyingUsd1y ?? 90000,
    patentGrants1y: overrides.patentGrants1y ?? 3,
    wsbMentions30d: overrides.wsbMentions30d ?? 120,
    wsbSentiment30d: overrides.wsbSentiment30d ?? 0.4,
    politicalBeta: overrides.politicalBeta ?? 1.1,
  };
}

function exec(overrides: Partial<ExecutiveSignal> & { ticker: string }): ExecutiveSignal {
  return {
    ticker: overrides.ticker,
    direction: overrides.direction ?? "Bullish",
    buyCount: overrides.buyCount ?? 2,
    sellCount: overrides.sellCount ?? 0,
    tradeCount: overrides.tradeCount ?? 2,
    netUsd: overrides.netUsd ?? 75000,
    totalUsd: overrides.totalUsd ?? 75000,
    officials: overrides.officials ?? ["Sec. Foo"],
    officialCount: overrides.officialCount ?? 1,
    latestDate: overrides.latestDate ?? new Date("2026-05-12T00:00:00.000Z"),
  };
}

function headerCells(csv: string): string[] {
  return csv.split("\r\n")[0].split(",");
}

function cell(csv: string, label: string, rowIndex = 1): string {
  const headers = headerCells(csv);
  const idx = headers.indexOf(label);
  if (idx === -1) throw new Error(`column not found: ${label}`);
  return csv.split("\r\n")[1 + rowIndex - 1].split(",")[idx];
}

describe("buildBuyBrief", () => {
  it("merges a ticker present in all sources into one row", () => {
    const result = buildBuyBrief(
      [ls({ ticker: "NVDA", score: 80 })],
      [df({ ticker: "NVDA", darkPoolExcess: 2.2 })],
      [di({ ticker: "NVDA", alignmentScore: 88 })],
      [stock({ ticker: "NVDA", marketCap: 3_000_000_000 })],
    );
    const row = result.rows.find((r) => r.ticker === "NVDA");
    expect(row).toBeDefined();
    expect(row?.lsScore).toBe(80);
    expect(row?.dfArchetype).toBe("Stealth Accumulation");
    expect(row?.darkPoolExcess).toBe(2.2);
    expect(row?.diAlignmentScore).toBe(88);
    expect(row?.marketCap).toBe(3_000_000_000);
    expect(row?.industry).toBe("Semiconductors");
  });

  it("includes long-short-only tickers with blank fields from other sources", () => {
    const result = buildBuyBrief([ls({ ticker: "AAPL" })], [], [], []);
    const row = result.rows.find((r) => r.ticker === "AAPL");
    expect(row?.dfArchetype).toBeNull();
    expect(row?.diDirection).toBeNull();
    expect(row?.marketCap).toBeNull();
  });

  it("includes dark-flow-only tickers with blank long-short fields", () => {
    const result = buildBuyBrief([], [df({ ticker: "TSLA" })], [], []);
    const row = result.rows.find((r) => r.ticker === "TSLA");
    expect(row?.lsStance).toBeNull();
    expect(row?.lsScore).toBeNull();
  });

  it("creates a row for dual-insider-only tickers but never for stock-only tickers", () => {
    const result = buildBuyBrief([], [], [di({ ticker: "META" })], [stock({ ticker: "SHOP" })]);
    expect(result.rows.find((r) => r.ticker === "META")?.diDirection).toBe("Bullish");
    // SHOP has fundamentals but no signal — it must NOT appear in the brief.
    expect(result.rows.find((r) => r.ticker === "SHOP")).toBeUndefined();
  });

  it("enriches a signal ticker with fundamentals when present", () => {
    const result = buildBuyBrief(
      [ls({ ticker: "NVDA" })],
      [],
      [],
      [stock({ ticker: "NVDA", marketCap: 3_000_000_000, industry: "Semiconductors" })],
    );
    const row = result.rows.find((r) => r.ticker === "NVDA");
    expect(row?.marketCap).toBe(3_000_000_000);
    expect(row?.industry).toBe("Semiconductors");
  });

  it("sorts rows by best available score descending", () => {
    const result = buildBuyBrief(
      [ls({ ticker: "LOW", score: 10 }), ls({ ticker: "HIGH", score: 90 })],
      [df({ ticker: "MID", score: 50 })],
      [di({ ticker: "DI", alignmentScore: 30 })],
      [],
    );
    expect(result.rows.map((r) => r.ticker)).toEqual(["HIGH", "MID", "DI", "LOW"]);
  });

  it("emits a wide header covering every source", () => {
    const result = buildBuyBrief([ls({ ticker: "NVDA" })], [], [], []);
    const headers = headerCells(result.csv);
    expect(headers.length).toBe(89);
    for (const label of [
      "Ticker",
      "Market Cap",
      "Trades 1y",
      "LS Score",
      "LS Flow Score",
      "LS Reasons",
      "DF Archetype",
      "Gov Contract Value",
      "DI Alignment Score",
      "DI Congress Politicians",
      "Last Close",
      "Return 30d %",
      "Exec Direction",
      "Exec Net USD",
      "Exec Officials",
      "Inst Holders",
      "Gov Contract USD 1y",
      "Lobbying USD 1y",
      "Patent Grants 1y",
      "WSB Mentions 30d",
      "Political Beta",
    ]) {
      expect(headers).toContain(label);
    }
  });

  it("enriches a signal ticker with price, executive, 13F, catalyst, and attention data", () => {
    const result = buildBuyBrief(
      [ls({ ticker: "NVDA" })],
      [],
      [],
      [],
      [enrich({ ticker: "NVDA", lastClose: 90000, return30dPct: 7.5, instHolders: 12 })],
    );
    const row = result.rows.find((r) => r.ticker === "NVDA");
    expect(row?.lastClose).toBe(90000);
    expect(row?.return30dPct).toBe(7.5);
    expect(row?.instHolders).toBe(12);
    expect(cell(result.csv, "Last Close")).toBe("90000");
    expect(cell(result.csv, "Return 30d %")).toBe("7.5");
    expect(cell(result.csv, "Inst Holders")).toBe("12");
  });

  it("never creates a row for an enrichment-only ticker with no signal", () => {
    const result = buildBuyBrief([ls({ ticker: "NVDA" })], [], [], [], [enrich({ ticker: "ZZZZ" })]);
    expect(result.rows.find((r) => r.ticker === "ZZZZ")).toBeUndefined();
    // NVDA has a signal but no matching enrichment → enrichment fields stay blank.
    expect(result.rows.find((r) => r.ticker === "NVDA")?.lastClose).toBeNull();
  });

  it("treats executive trades as a row-creating signal (exec-only ticker appears)", () => {
    const result = buildBuyBrief(
      [],
      [],
      [],
      [],
      [],
      [
        exec({
          ticker: "RTX",
          direction: "Bullish",
          buyCount: 3,
          netUsd: 120000,
          totalUsd: 120000,
          officials: ["Sec. A", "Sec. B"],
          officialCount: 2,
        }),
      ],
    );
    const row = result.rows.find((r) => r.ticker === "RTX");
    expect(row).toBeDefined();
    expect(row?.execDirection).toBe("Bullish");
    expect(row?.execBuyCount).toBe(3);
    expect(row?.execNetUsd).toBe(120000);
    expect(row?.execOfficialCount).toBe(2);
    expect(cell(result.csv, "Exec Officials")).toBe("Sec. A; Sec. B");
    expect(cell(result.csv, "Exec Direction")).toBe("Bullish");
  });

  it("merges executive trades into an existing signal row without inventing a score", () => {
    const result = buildBuyBrief(
      [ls({ ticker: "NVDA", score: 80 })],
      [],
      [],
      [],
      [],
      [
        exec({ ticker: "NVDA", netUsd: 12345 }),
        exec({ ticker: "RTX", totalUsd: 500000 }),
        exec({ ticker: "GD", totalUsd: 10000 }),
      ],
    );
    // NVDA keeps its single row, now carrying exec fields.
    expect(result.rows.filter((r) => r.ticker === "NVDA")).toHaveLength(1);
    expect(result.rows.find((r) => r.ticker === "NVDA")?.execNetUsd).toBe(12345);
    // No synthetic exec score: exec-only tickers fall back to 0 in the ranking,
    // so the scored signal (NVDA, ls 80) leads and the exec-only rows trail in
    // their original order.
    expect(result.rows.map((r) => r.ticker)).toEqual(["NVDA", "RTX", "GD"]);
  });

  it("flattens score breakdown, arrays, and dates", () => {
    const result = buildBuyBrief(
      [
        ls({
          ticker: "NVDA",
          scoreBreakdown: { flow: 11, cluster: 2, breadth: 3, insider: 4, committee: 5, lagPenalty: 6 },
          reasons: ["a", "b"],
          latestDisclosureDate: new Date("2026-05-20T00:00:00.000Z"),
        }),
      ],
      [],
      [di({ ticker: "NVDA", congressPoliticians: ["Rep A", "Sen B"] })],
      [],
    );
    expect(cell(result.csv, "LS Flow Score")).toBe("11");
    expect(cell(result.csv, "LS Reasons")).toBe("a; b");
    expect(cell(result.csv, "Latest Disclosure Date")).toBe("2026-05-20T00:00:00.000Z");
    expect(cell(result.csv, "DI Congress Politicians")).toBe("Rep A; Sen B");
  });

  it("renders blank cells for null values", () => {
    const result = buildBuyBrief([], [df({ ticker: "TSLA" })], [], []);
    expect(cell(result.csv, "LS Stance")).toBe("");
    expect(cell(result.csv, "LS Score")).toBe("");
    expect(cell(result.csv, "Market Cap")).toBe("");
    expect(cell(result.csv, "DI Direction")).toBe("");
  });

  it("document equals prompt + blank line + csv", () => {
    const result = buildBuyBrief([ls({ ticker: "NVDA" })], [], [], []);
    expect(result.document).toBe(`${BUY_BRIEF_PROMPT}\n\n${result.csv}`);
    expect(result.prompt).toBe(BUY_BRIEF_PROMPT);
  });
});
