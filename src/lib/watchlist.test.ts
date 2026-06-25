import { describe, expect, it } from "vitest";

import { normalizeWatchlistTicker } from "./watchlist";

describe("normalizeWatchlistTicker", () => {
  it("uppercases, trims, and converts dotted class tickers to Yahoo-style hyphens", () => {
    expect(normalizeWatchlistTicker(" brk.b ")).toBe("BRK-B");
  });

  it("rejects empty strings and non-ticker text", () => {
    expect(normalizeWatchlistTicker("")).toBeNull();
    expect(normalizeWatchlistTicker("not a ticker")).toBeNull();
  });
});
