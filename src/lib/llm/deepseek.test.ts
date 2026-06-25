import { describe, expect, it } from "vitest";

import * as deepseek from "./deepseek";
import { parseVerdicts, mergeVerdicts, buildNewsPrompt } from "./deepseek";
import type { TavilyArticle } from "./tavily";

// buildNewsPrompt: names the subject and includes metadata
describe("buildNewsPrompt", () => {
  it("names the subject company and ticker", () => {
    const p = buildNewsPrompt([{ title: "T", content: "C", url: null, publisher: "Pub", publishedAt: "2026-06-01" }], "TSCO", "Tractor Supply Company");
    expect(p).toContain("Tractor Supply Company (TSCO)");
    expect(p).toContain("Pub");
    expect(p).toContain("2026-06-01");
    expect(p).toContain('"relevance"');
    expect(p).toContain('"eventType"');
    expect(p).toContain('"surprise"');
    expect(p).not.toContain('"score"'); // LLM no longer emits the float
  });
  it("falls back to ticker when company name missing", () => {
    const p = buildNewsPrompt([{ title: "T", content: null, url: null, publisher: null, publishedAt: null }], "TSCO", null);
    expect(p).toContain("(TSCO)");
  });
  it("is exported as a named export", () => {
    expect((deepseek as unknown as { buildNewsPrompt?: unknown }).buildNewsPrompt).toBeTypeOf("function");
  });
});

// parseVerdicts: facets with conservative fallbacks, LLM score ignored
describe("parseVerdicts", () => {
  it("parses facets and ignores any LLM-supplied score", () => {
    const raw = JSON.stringify([{ index: 0, sentiment: "bullish", relevance: "direct", eventType: "earnings_guidance", surprise: "new_material", score: 0.1, summary: "s" }]);
    const v = parseVerdicts(raw);
    expect(v[0]).toMatchObject({ relevance: "direct", eventType: "earnings_guidance", surprise: "new_material" });
  });
  it("falls back conservatively on garbage facets", () => {
    const raw = JSON.stringify([{ index: 0, sentiment: "bearish", relevance: "huh", eventType: 7, summary: null }]);
    const v = parseVerdicts(raw);
    expect(v[0]).toMatchObject({ relevance: "unrelated", eventType: "commentary_listicle", surprise: "recycled_known" });
  });
  it("strips ```json fences, normalizes bad sentiment to neutral", () => {
    const text = "```json\n[{\"index\":0,\"sentiment\":\"POSITIVE\",\"relevance\":\"direct\",\"eventType\":\"earnings_guidance\",\"surprise\":\"new_material\"}]\n```";
    const out = parseVerdicts(text);
    expect(out[0]).toMatchObject({ index: 0, sentiment: "neutral" });
  });
  it("returns [] on unparseable input", () => {
    expect(parseVerdicts("nope")).toEqual([]);
  });
  it("drops entries with missing index", () => {
    const raw = JSON.stringify([{ sentiment: "bearish", relevance: "direct", eventType: "earnings_guidance", surprise: "new_material" }]);
    expect(parseVerdicts(raw)).toEqual([]);
  });
});

// mergeVerdicts: score computed in code from facets
describe("mergeVerdicts", () => {
  it("computes score from facets", () => {
    const arts: TavilyArticle[] = [{ title: "T", content: null, url: null, publisher: null, publishedAt: null }];
    const items = mergeVerdicts(arts, [{ index: 0, sentiment: "bullish", summary: null, relevance: "direct", eventType: "earnings_guidance", surprise: "new_material" }]);
    expect(items[0].score).toBe(0.95);
    expect(items[0].relevance).toBe("direct");
  });
  it("merges verdicts onto the source articles, preserving title/url/publisher", () => {
    const articles: TavilyArticle[] = [
      { title: "A", url: "https://cnbc.com/a", publisher: "cnbc.com", content: "...", publishedAt: "2025-05-01T00:00:00Z" },
      { title: "B", url: null, publisher: null, content: null, publishedAt: null },
    ];
    const items = mergeVerdicts(articles, [
      { index: 1, sentiment: "bearish", summary: "down", relevance: "direct", eventType: "product_demand", surprise: "new_material" },
      { index: 0, sentiment: "bullish", summary: "up", relevance: "sector", eventType: "analyst_action", surprise: "incremental" },
      { index: 9, sentiment: "bullish", summary: "ignored", relevance: "macro", eventType: "routine_filing", surprise: "recycled_known" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("A");
    expect(items[0].publisher).toBe("cnbc.com");
    expect(items[0].sentiment).toBe("bullish");
    expect(items[1].title).toBe("B");
    expect(items[1].sentiment).toBe("bearish");
  });
});
