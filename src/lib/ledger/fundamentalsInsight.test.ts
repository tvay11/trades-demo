import { describe, it, expect } from "vitest";
import { buildFundamentalsPrompt, parseFundamentalsInsight } from "./fundamentalsInsight";
import type { EdgarFundamentals } from "./types";

const FUND: EdgarFundamentals = {
  annual: { fiscalLabel: "FY2026", periodEnd: "2026-01-31", form: "10-K", revenue: 215_900_000_000,
    revenueYoYPct: 78.2, grossMarginPct: 71.1, netIncome: 100_000_000_000, netIncomeYoYPct: 90.1, dilutedEps: 4.1 },
  quarter: { fiscalLabel: "Q1 FY2027", periodEnd: "2026-04-30", form: "10-Q", revenue: 81_600_000_000,
    revenueYoYPct: 60.0, grossMarginPct: 74.9, netIncome: 40_000_000_000, netIncomeYoYPct: 55.0, dilutedEps: 1.6 },
};

describe("buildFundamentalsPrompt", () => {
  it("includes the numbers, the article text, the grounding instruction and the JSON schema", () => {
    const p = buildFundamentalsPrompt("NVDA", "NVIDIA Corp", FUND, [
      { title: "Export controls hit China sales", url: "u", publisher: "Reuters", publishedAt: null, content: "New export curbs may reduce data-center revenue." },
    ]);
    expect(p).toContain("FY2026");
    expect(p).toContain("71.1");
    expect(p).toContain("Export controls hit China sales");
    expect(p).toContain("Use ONLY these articles");
    expect(p).toContain('"interpretation"');
    expect(p).toContain('"riskFactors"');
  });
  it("handles missing fundamentals and no articles", () => {
    const p = buildFundamentalsPrompt("TST", null, null, []);
    expect(p).toContain("(no data)");
    expect(p).toContain("(no risk-factor articles found)");
  });
});

describe("parseFundamentalsInsight", () => {
  it("parses a clean JSON object", () => {
    const out = parseFundamentalsInsight('{"interpretation":"Strong growth, expanding margins.","riskFactors":["Export controls","Customer concentration"]}');
    expect(out).toEqual({ schemaVersion: 1, interpretation: "Strong growth, expanding margins.", riskFactors: ["Export controls", "Customer concentration"] });
  });
  it("tolerates code fences and prose around the JSON", () => {
    const out = parseFundamentalsInsight('Here:\n```json\n{"interpretation":"Ok.","riskFactors":[]}\n```\nthanks');
    expect(out?.interpretation).toBe("Ok.");
    expect(out?.riskFactors).toEqual([]);
  });
  it("drops non-string risks, trims, and caps to 6", () => {
    const risks = Array.from({ length: 9 }, (_, i) => `risk ${i}`);
    const out = parseFundamentalsInsight(JSON.stringify({ interpretation: "x", riskFactors: [...risks, 5, null, "  "] }));
    expect(out?.riskFactors).toHaveLength(6);
    expect(out?.riskFactors.every((r) => typeof r === "string" && r.length > 0)).toBe(true);
  });
  it("returns null on invalid JSON", () => {
    expect(parseFundamentalsInsight("not json")).toBeNull();
  });
  it("returns null when both interpretation and risks are empty", () => {
    expect(parseFundamentalsInsight('{"interpretation":"","riskFactors":[]}')).toBeNull();
  });
});
