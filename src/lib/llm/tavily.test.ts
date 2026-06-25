import { describe, expect, it } from "vitest";

import { parseTavilyResults, dedupeArticles } from "./tavily";

describe("parseTavilyResults", () => {
  it("maps results to articles and derives publisher from the URL host", () => {
    const out = parseTavilyResults({
      results: [
        { title: "Apple beats", url: "https://www.cnbc.com/x", content: "Strong quarter.", published_date: "2025-01-15T10:00:00Z" },
        { title: "Apple pricey", url: "https://kiplinger.com/y", content: "Valuation rich." },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ title: "Apple beats", url: "https://www.cnbc.com/x", publisher: "cnbc.com", content: "Strong quarter.", publishedAt: "2025-01-15T10:00:00Z" });
    expect(out[1].publisher).toBe("kiplinger.com");
  });

  it("prefers raw_content over content snippet when raw_content is present", () => {
    const out = parseTavilyResults({
      results: [
        {
          title: "Full article",
          url: "https://reuters.com/z",
          content: "Short snippet.",
          raw_content: "This is the full extracted article body with many more paragraphs of detail.",
          published_date: "2025-03-10T08:00:00Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("This is the full extracted article body with many more paragraphs of detail.");
  });

  it("falls back to snippet content when raw_content is absent", () => {
    const out = parseTavilyResults({
      results: [
        { title: "Snippet only", url: "https://bloomberg.com/a", content: "Just a snippet.", published_date: "2025-04-01T00:00:00Z" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("Just a snippet.");
  });

  it("falls back to snippet content when raw_content is an empty string", () => {
    const out = parseTavilyResults({
      results: [
        { title: "Empty raw", url: "https://wsj.com/b", content: "Snippet text.", raw_content: "   " },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("Snippet text.");
  });

  it("drops entries without a title and tolerates missing fields", () => {
    const out = parseTavilyResults({ results: [{ url: "https://x.com" }, { title: "ok" }] });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ title: "ok", url: null, publisher: null, content: null, publishedAt: null });
  });

  it("returns [] on shapeless input", () => {
    expect(parseTavilyResults(null)).toEqual([]);
    expect(parseTavilyResults({})).toEqual([]);
  });
});

describe("dedupeArticles", () => {
  it("removes duplicate urls, keeping the first occurrence", () => {
    const a = { title: "A", url: "https://cnbc.com/a", publisher: "cnbc.com", content: "c1", publishedAt: null };
    const b = { title: "B", url: "https://reuters.com/b", publisher: "reuters.com", content: "c2", publishedAt: null };
    const aDup = { title: "A dup", url: "https://cnbc.com/a", publisher: "cnbc.com", content: "c3", publishedAt: null };
    expect(dedupeArticles([a, b, aDup])).toEqual([a, b]);
  });

  it("keeps null-url articles without deduping them against each other", () => {
    const n1 = { title: "N1", url: null, publisher: null, content: null, publishedAt: null };
    const n2 = { title: "N2", url: null, publisher: null, content: null, publishedAt: null };
    const a = { title: "A", url: "https://cnbc.com/a", publisher: "cnbc.com", content: "c", publishedAt: null };
    expect(dedupeArticles([n1, a, n2])).toEqual([n1, a, n2]);
  });

  it("returns [] for an empty input", () => {
    expect(dedupeArticles([])).toEqual([]);
  });
});
