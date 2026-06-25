// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const yahooMocks = vi.hoisted(() => ({
  quote: vi.fn(),
  screener: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn(function YahooFinanceMock() {
    return {
    quote: yahooMocks.quote,
    screener: yahooMocks.screener,
    };
  }),
}));

import { getStreetPulse } from "./streetPulse";

describe("getStreetPulse", () => {
  beforeEach(() => {
    yahooMocks.quote.mockReset();
    yahooMocks.screener.mockReset();
  });

  // Runs first so the module-level memo is still null (an empty result is not cached).
  it("resolves with empty arrays when yahoo rejects instead of crashing the page", async () => {
    yahooMocks.screener.mockRejectedValue(new Error("fetch failed"));
    yahooMocks.quote.mockRejectedValue(new Error("fetch failed"));

    await expect(getStreetPulse()).resolves.toEqual({
      gainers: [],
      losers: [],
      actives: [],
      sectors: [],
    });
  });

  it("disables yahoo screener result validation and maps loose quote rows", async () => {
    yahooMocks.screener.mockImplementation(async ({ scrIds }: { scrIds: string }) => ({
      quotes: [
        {
          symbol: scrIds === "day_losers" ? "DOWN" : "UP",
          shortName: `${scrIds} row`,
          regularMarketPrice: 123.45,
          regularMarketChangePercent: scrIds === "day_losers" ? -4.2 : 3.1,
          unexpectedYahooField: "schema drift should not matter",
        },
      ],
    }));
    yahooMocks.quote.mockResolvedValue([]);

    const result = await getStreetPulse();

    expect(result.gainers).toEqual([
      { ticker: "UP", name: "day_gainers row", price: 123.45, changePct: 3.1 },
    ]);
    expect(result.losers).toEqual([
      { ticker: "DOWN", name: "day_losers row", price: 123.45, changePct: -4.2 },
    ]);
    expect(yahooMocks.screener).toHaveBeenCalledWith(
      { scrIds: "day_gainers", count: 6 },
      undefined,
      { validateResult: false },
    );
    expect(yahooMocks.screener).toHaveBeenCalledWith(
      { scrIds: "day_losers", count: 6 },
      undefined,
      { validateResult: false },
    );
    expect(yahooMocks.screener).toHaveBeenCalledWith(
      { scrIds: "most_actives", count: 6 },
      undefined,
      { validateResult: false },
    );
  });
});
