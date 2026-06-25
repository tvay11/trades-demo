import { describe, expect, it } from "vitest";

import { computeDisclosureBacktest, type BacktestInputTrade } from "./backtest";

function trade(partial: Partial<BacktestInputTrade>): BacktestInputTrade {
  return {
    id: 1,
    ticker: "NVDA",
    transactionType: "Purchase",
    transactionDate: new Date("2026-01-02T00:00:00Z"),
    disclosureDate: new Date("2026-01-10T00:00:00Z"),
    amountMinCents: 1_000_00,
    amountMaxCents: 15_000_00,
    ...partial,
  };
}

describe("disclosure backtest", () => {
  it("uses disclosure date as entry date because transaction date is not tradable", () => {
    const result = computeDisclosureBacktest({
      trades: [trade({ transactionDate: new Date("2026-01-02T00:00:00Z") })],
      pricesByTicker: new Map([
        [
          "NVDA",
          [
            { date: new Date("2026-01-02T00:00:00Z"), close: 100 },
            { date: new Date("2026-01-10T00:00:00Z"), close: 120 },
            { date: new Date("2026-02-09T00:00:00Z"), close: 150 },
          ],
        ],
      ]),
      horizonDays: 30,
    });

    expect(result.positions[0]).toMatchObject({
      ticker: "NVDA",
      side: "long",
      entryPrice: 120,
      exitPrice: 150,
      returnPercent: 25,
    });
    expect(result.averageReturnPercent).toBe(25);
  });

  it("treats sales as short-side signals", () => {
    const result = computeDisclosureBacktest({
      trades: [trade({ transactionType: "Sale", disclosureDate: new Date("2026-01-10T00:00:00Z") })],
      pricesByTicker: new Map([
        [
          "NVDA",
          [
            { date: new Date("2026-01-10T00:00:00Z"), close: 100 },
            { date: new Date("2026-02-09T00:00:00Z"), close: 80 },
          ],
        ],
      ]),
      horizonDays: 30,
    });

    expect(result.positions[0]).toMatchObject({
      side: "short",
      returnPercent: 20,
    });
    expect(result.winRate).toBe(100);
  });
});
