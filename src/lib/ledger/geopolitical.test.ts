import { describe, expect, it } from "vitest";

import { buildGeoPrompt, parseGeoImpact } from "./geopolitical";
import type { TavilyArticle } from "@/lib/llm/tavily";

const articles: TavilyArticle[] = [
  { title: "US tightens chip export controls", url: "https://reuters.com/a", publisher: "reuters.com", publishedAt: "2026-05-30", content: "New export limits on advanced GPUs to China..." },
  { title: "Taiwan tensions ease", url: "https://ft.com/b", publisher: "ft.com", publishedAt: "2026-05-29", content: "Diplomatic thaw reduces supply-chain risk..." },
];

describe("buildGeoPrompt", () => {
  it("includes company, sector, JSON schema keys, and numbered articles", () => {
    const p = buildGeoPrompt("NVDA", "NVIDIA", "Technology", articles);
    expect(p).toMatch(/JSON/);
    expect(p).toContain("NVIDIA");
    expect(p).toContain("Technology");
    expect(p).toContain("netLean");
    expect(p).toContain("factors");
    expect(p).toContain("0. US tightens chip export controls");
    expect(p).toContain("1. Taiwan tensions ease");
    expect(p.toLowerCase()).toContain("do not invent");
  });

  it("asks for facets, not a numeric score", () => {
    const p = buildGeoPrompt("NVDA", "NVIDIA", "Technology", articles);
    expect(p).toContain('"channel"');
    expect(p).toContain('"exposure"');
    expect(p).toContain('"status"');
    expect(p).toContain("sanctions_export_controls");
    expect(p).toContain("company_targeted");
    expect(p).toContain("in_effect");
    expect(p).not.toContain('"score"');
    expect(p).not.toContain('"magnitude"');
  });
});

describe("parseGeoImpact", () => {
  const valid = JSON.stringify({
    summary: "Export-control risk dominates; some relief from eased tensions.",
    netLean: "headwind",
    factors: [
      { index: 0, event: "US chip export controls", impact: "negative", channel: "sanctions_export_controls", exposure: "company_targeted", status: "in_effect", rationale: "Caps China data-center revenue." },
      { index: 1, event: "Taiwan thaw", impact: "positive", channel: "diplomacy_summits", exposure: "sector_supply_chain", status: "speculative_rumor", rationale: "Lowers supply-chain tail risk." },
    ],
  });

  it("computes scores from facets and merges source url/publisher by index", () => {
    const out = parseGeoImpact(valid, articles);
    expect(out).not.toBeNull();
    expect(out!.netLean).toBe("headwind");
    expect(out!.factors).toHaveLength(2);
    // 0.9 * 1 * 1 = 0.9
    expect(out!.factors[0]).toMatchObject({
      event: "US chip export controls",
      impact: "negative",
      score: 0.9,
      channel: "sanctions_export_controls",
      exposure: "company_targeted",
      status: "in_effect",
      url: "https://reuters.com/a",
      publisher: "reuters.com",
    });
    // channel diplomacy_summits (0.3) * exposure sector_supply_chain (0.55) * status speculative_rumor (0.4) = 0.066 -> 0.07
    expect(out!.factors[1].score).toBe(0.07);
  });

  it("scores partial facet payloads conservatively low instead of falling back to legacy 0.5", () => {
    const text = JSON.stringify({
      summary: "x",
      netLean: "mixed",
      factors: [
        { index: 0, event: "only channel", impact: "negative", channel: "sanctions_export_controls", rationale: "x" },
      ],
    });
    const out = parseGeoImpact(text, articles);
    // missing exposure/status default to macro_broad (0.25) and speculative_rumor (0.4): 0.9 * 0.25 * 0.4 = 0.09
    expect(out!.factors[0].score).toBe(0.09);
    expect(out!.factors[0].exposure).toBe("macro_broad");
    expect(out!.factors[0].status).toBe("speculative_rumor");
  });

  it("normalizes bad facet values conservatively", () => {
    const text = JSON.stringify({
      summary: "x",
      netLean: "mixed",
      factors: [
        { index: 0, event: "weird facets", impact: "mixed", channel: "alien_invasion", exposure: "??", status: "soon", rationale: "x" },
      ],
    });
    const out = parseGeoImpact(text, articles);
    // diplomacy_summits (0.3) * macro_broad (0.25) * speculative_rumor (0.4) = 0.03
    expect(out!.factors[0].score).toBe(0.03);
    expect(out!.factors[0].channel).toBe("diplomacy_summits");
  });

  it("still accepts legacy numeric score payloads without facets", () => {
    const text = JSON.stringify({
      summary: "x",
      netLean: "headwind",
      factors: [{ index: 0, event: "legacy", impact: "negative", score: 0.82, rationale: "y" }],
    });
    const out = parseGeoImpact(text, articles);
    expect(out!.factors[0].score).toBe(0.82);
    expect(out!.factors[0].channel).toBeUndefined();
  });

  it("strips ```json fences", () => {
    expect(parseGeoImpact("```json\n" + valid + "\n```", articles)?.netLean).toBe("headwind");
  });

  it("drops factors with out-of-range index or missing fields, normalizes bad enums, and clamps score", () => {
    const text = JSON.stringify({
      summary: "x", netLean: "BOGUS",
      factors: [
        { index: 9, event: "ignored", impact: "negative", score: 0.9, rationale: "x" },
        { index: 0, event: "ok", impact: "POSITIVE", score: 1.4, rationale: "y" },
        { index: 1, event: "", impact: "mixed", score: 0.2, rationale: "z" },
      ],
    });
    const out = parseGeoImpact(text, articles);
    expect(out!.netLean).toBe("mixed"); // bad → mixed
    expect(out!.factors).toHaveLength(1); // index 9 dropped, empty-event dropped
    expect(out!.factors[0]).toMatchObject({ event: "ok", impact: "positive", score: 1 });
  });

  it("maps legacy magnitude values to numeric scores", () => {
    const text = JSON.stringify({
      summary: "x",
      netLean: "mixed",
      factors: [
        { index: 0, event: "legacy high", impact: "negative", magnitude: "high", rationale: "x" },
        { index: 1, event: "legacy low", impact: "positive", magnitude: "low", rationale: "y" },
      ],
    });

    const out = parseGeoImpact(text, articles);

    expect(out!.factors.map((f) => f.score)).toEqual([0.85, 0.25]);
  });

  it("returns null when summary missing or no valid factors", () => {
    expect(parseGeoImpact(JSON.stringify({ netLean: "mixed", factors: [] }), articles)).toBeNull();
    expect(parseGeoImpact("nonsense", articles)).toBeNull();
  });
});
