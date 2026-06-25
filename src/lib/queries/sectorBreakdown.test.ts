import { describe, it, expect } from "vitest";
import { shapeSectorBreakdown, type SectorInput } from "./sectorBreakdown";

function trade(partial: Partial<SectorInput>): SectorInput {
  return {
    ticker: "NVDA",
    amountMin: 1000,
    amountMax: 15000,
    ...partial,
  };
}

describe("shapeSectorBreakdown", () => {
  it("returns empty array for empty input", () => {
    expect(shapeSectorBreakdown([])).toEqual([]);
  });

  it("aggregates total minimum per sector", () => {
    const out = shapeSectorBreakdown([
      trade({ ticker: "NVDA", amountMin: 1000, amountMax: 15000 }),
      trade({ ticker: "AAPL", amountMin: 0, amountMax: 1000 }),
      trade({ ticker: "JPM", amountMin: 100, amountMax: 1000 }),
    ]);
    const it = out.find((r) => r.sector === "Information Technology");
    const fin = out.find((r) => r.sector === "Financials");
    expect(it).toEqual({ sector: "Information Technology", value: 1000 });
    expect(fin).toEqual({ sector: "Financials", value: 100 });
  });

  it("sorts by value descending", () => {
    const out = shapeSectorBreakdown([
      trade({ ticker: "JPM", amountMin: 0, amountMax: 1000 }),
      trade({ ticker: "NVDA", amountMin: 1000, amountMax: 15000 }),
      trade({ ticker: "XOM", amountMin: 100, amountMax: 500 }),
    ]);
    expect(out[0].sector).toBe("Information Technology");
  });

  it("buckets unknown tickers under 'Unknown'", () => {
    const out = shapeSectorBreakdown([trade({ ticker: "ZZZZQ", amountMin: 100, amountMax: 100 })]);
    expect(out).toEqual([{ sector: "Unknown", value: 100 }]);
  });

  it("excludes sectors with zero total", () => {
    const out = shapeSectorBreakdown([
      trade({ ticker: "NVDA", amountMin: null, amountMax: null }),
    ]);
    // NVDA has 0 minimum → IT bucket is 0 → excluded
    expect(out).toEqual([]);
  });
});
