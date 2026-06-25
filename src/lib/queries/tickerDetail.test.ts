import { describe, expect, it } from "vitest";

import type { BarRow } from "@/lib/yahoo/client";
import {
  shapeTickerCongressTrades,
  shapeTickerSummary,
  type RawTickerTrade,
} from "./tickerDetail";

const bar = (iso: string, close: number): BarRow => ({
  date: new Date(`${iso}T00:00:00Z`),
  open: close,
  high: close,
  low: close,
  close,
  volume: 0,
});

function trade(partial: Partial<RawTickerTrade>): RawTickerTrade {
  return {
    id: "1",
    branch: "congress",
    politicianName: "Pelosi, Nancy",
    party: "D",
    state: "CA",
    agency: null,
    transactionType: "Purchase",
    transactionDate: new Date("2025-09-02T00:00:00Z"),
    disclosureDate: new Date("2025-09-12T00:00:00Z"),
    amountMin: 1_000,
    amountMax: 15_000,
    amountRangeRaw: "$1K-$15K",
    ...partial,
  };
}

describe("ticker detail shaping", () => {
  it("attaches nearest close on or before the trade date and computes since-trade return", () => {
    const rows = shapeTickerCongressTrades(
      [
        trade({
          transactionDate: new Date("2025-09-03T00:00:00Z"),
          transactionType: "Purchase",
        }),
      ],
      [
        bar("2025-09-01", 100),
        bar("2025-09-02", 110),
        bar("2025-09-05", 121),
      ],
    );

    expect(rows[0]).toMatchObject({
      action: "buy",
      priceAtTrade: 110,
      priceAtDisclosure: null,
      latestClose: 121,
      returnSinceTrade: 10,
      return7dFromDisclosure: null,
      amountMinimum: 1_000,
    });
  });

  it("computes tradable returns from disclosure date windows", () => {
    const rows = shapeTickerCongressTrades(
      [
        trade({
          transactionDate: new Date("2025-09-01T00:00:00Z"),
          disclosureDate: new Date("2025-09-03T00:00:00Z"),
        }),
      ],
      [
        bar("2025-09-01", 100),
        bar("2025-09-03", 120),
        bar("2025-09-10", 132),
        bar("2025-10-03", 108),
        bar("2025-12-02", 180),
      ],
    );

    expect(rows[0]).toMatchObject({
      priceAtTrade: 100,
      priceAtDisclosure: 120,
      return7dFromDisclosure: 10,
      return30dFromDisclosure: -10,
      return90dFromDisclosure: 50,
    });
  });

  it("uses the first close on or after disclosure as the tradable entry", () => {
    const rows = shapeTickerCongressTrades(
      [
        trade({
          transactionDate: new Date("2025-09-01T00:00:00Z"),
          disclosureDate: new Date("2025-09-03T00:00:00Z"),
        }),
      ],
      [
        bar("2025-09-01", 100),
        bar("2025-09-02", 110),
        bar("2025-09-04", 120),
        bar("2025-09-10", 132),
      ],
    );

    expect(rows[0]).toMatchObject({
      priceAtDisclosure: 120,
      return7dFromDisclosure: 10,
    });
  });

  it("classifies sales and exchange-like transactions separately", () => {
    const rows = shapeTickerCongressTrades(
      [
        trade({ id: "1", transactionType: "Sale (Full)" }),
        trade({ id: "2", transactionType: "Exchange" }),
      ],
      [bar("2025-09-02", 100)],
    );

    expect(rows.map((row) => row.action)).toEqual(["sell", "other"]);
  });

  it("summarizes buy and sell counts with minimum disclosed volume", () => {
    const rows = shapeTickerCongressTrades(
      [
        trade({ id: "1", transactionType: "Purchase", amountMin: 1_000, amountMax: 15_000 }),
        trade({ id: "2", transactionType: "Sale", amountMin: 15_000, amountMax: 50_000 }),
      ],
      [bar("2025-09-02", 100)],
    );

    expect(shapeTickerSummary(rows)).toEqual({
      tradeCount: 2,
      buyCount: 1,
      sellCount: 1,
      estimatedVolume: 16_000,
    });
  });
});
