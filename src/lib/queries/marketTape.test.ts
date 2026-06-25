// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shapeTapeQuote, TAPE_SYMBOLS } from "./marketTape";

describe("shapeTapeQuote", () => {
  it("maps a yahoo quote to a tape cell", () => {
    const cell = shapeTapeQuote("^GSPC", {
      regularMarketPrice: 6000.12,
      regularMarketChangePercent: -0.55,
    });
    expect(cell).toMatchObject({ symbol: "^GSPC", label: "S&P 500", price: 6000.12, changePct: -0.55 });
  });
  it("returns null when price is missing", () => {
    expect(shapeTapeQuote("^GSPC", { regularMarketPrice: undefined, regularMarketChangePercent: 1 })).toBeNull();
  });
  it("covers all tape symbols with labels", () => {
    expect(TAPE_SYMBOLS.map((s) => s.symbol)).toContain("BTC-USD");
    expect(TAPE_SYMBOLS).toHaveLength(10);
  });
});
