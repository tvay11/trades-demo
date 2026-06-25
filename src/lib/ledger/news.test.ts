import { describe, expect, it } from "vitest";

import { newsSkew } from "./news";
import type { NewsItem } from "./types";

describe("newsSkew", () => {
  it("weights bullish and bearish articles by score", () => {
    const items: NewsItem[] = [
      { title: "Small upside", publisher: null, url: null, publishedAt: null, summary: null, sentiment: "bullish", score: 0.2 },
      { title: "Large downside", publisher: null, url: null, publishedAt: null, summary: null, sentiment: "bearish", score: 0.8 },
      { title: "Neutral context", publisher: null, url: null, publishedAt: null, summary: null, sentiment: "neutral", score: 1 },
    ];

    expect(newsSkew(items)).toBeCloseTo(-0.6, 6);
  });

  it("uses a moderate fallback score for legacy news without scores", () => {
    const items = [
      { title: "Legacy upside", publisher: null, url: null, publishedAt: null, summary: null, sentiment: "bullish" },
    ] as NewsItem[];

    expect(newsSkew(items)).toBeCloseTo(1, 6);
  });
});
