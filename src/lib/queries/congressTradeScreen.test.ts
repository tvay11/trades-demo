import { describe, expect, it } from "vitest";

import {
  buildCongressTradeScreen,
  type CongressStockInfo,
  type CongressTradeInput,
} from "./congressTradeScreen";

function trade(overrides: Partial<CongressTradeInput> & { ticker: string }): CongressTradeInput {
  return {
    ticker: overrides.ticker,
    representative: overrides.representative ?? "Jane Doe",
    politicianId: overrides.politicianId ?? 1,
    party: overrides.party ?? "D",
    house: overrides.house ?? "House",
    transactionType: overrides.transactionType ?? "Purchase",
    transactionDate: overrides.transactionDate ?? new Date("2026-05-01T00:00:00.000Z"),
    disclosureDate: overrides.disclosureDate ?? new Date("2026-05-05T00:00:00.000Z"),
    // $1,000 .. $2,000 → minimumDollars = $1,000
    amountMinCents: overrides.amountMinCents ?? 100_000,
    amountMaxCents: overrides.amountMaxCents ?? 200_000,
  };
}

const stocks: CongressStockInfo[] = [
  { ticker: "NVDA", companyName: "NVIDIA Corp", sector: "Technology" },
];

describe("buildCongressTradeScreen", () => {
  it("aggregates buy/sell counts, dollars, and distinct politicians per ticker", () => {
    const { rows } = buildCongressTradeScreen(
      [
        trade({ ticker: "NVDA", politicianId: 1, transactionType: "Purchase" }),
        trade({ ticker: "NVDA", politicianId: 2, transactionType: "Purchase" }),
        trade({ ticker: "NVDA", politicianId: 1, transactionType: "Sale" }),
      ],
      stocks,
    );

    const row = rows.find((r) => r.ticker === "NVDA");
    expect(row).toBeDefined();
    expect(row?.companyName).toBe("NVIDIA Corp");
    expect(row?.sector).toBe("Technology");
    expect(row?.trades).toBe(3);
    expect(row?.buys).toBe(2);
    expect(row?.sells).toBe(1);
    expect(row?.netTrades).toBe(1);
    expect(row?.politicians).toBe(2);
    expect(row?.buyers).toBe(2);
    expect(row?.sellers).toBe(1);
    expect(row?.buyUsd).toBe(2000);
    expect(row?.sellUsd).toBe(1000);
    expect(row?.netUsd).toBe(1000);
    expect(row?.grossUsd).toBe(3000);
  });

  it("splits trades by party and chamber from the raw rows", () => {
    const { rows } = buildCongressTradeScreen(
      [
        trade({ ticker: "NVDA", party: "D", house: "House", transactionType: "Purchase" }),
        trade({ ticker: "NVDA", party: "R", house: "Senate", transactionType: "Purchase", politicianId: 2 }),
        trade({ ticker: "NVDA", party: "R", house: "House", transactionType: "Sale", politicianId: 3 }),
        trade({ ticker: "NVDA", party: "Independent", house: "House", transactionType: "Sale", politicianId: 4 }),
      ],
      stocks,
    );

    const row = rows[0];
    expect(row.demBuys).toBe(1);
    expect(row.demSells).toBe(0);
    expect(row.repBuys).toBe(1);
    expect(row.repSells).toBe(1);
    expect(row.houseTrades).toBe(3);
    expect(row.senateTrades).toBe(1);
  });

  it("flags bipartisan buying only when both parties are net buyers", () => {
    const bipartisan = buildCongressTradeScreen(
      [
        trade({ ticker: "AAA", party: "D", transactionType: "Purchase", politicianId: 1 }),
        trade({ ticker: "AAA", party: "R", transactionType: "Purchase", politicianId: 2 }),
      ],
      [],
    ).rows[0];
    expect(bipartisan.bipartisanBuying).toBe(true);

    const oneSided = buildCongressTradeScreen(
      [
        trade({ ticker: "BBB", party: "D", transactionType: "Purchase", politicianId: 1 }),
        trade({ ticker: "BBB", party: "R", transactionType: "Sale", politicianId: 2 }),
      ],
      [],
    ).rows[0];
    expect(oneSided.bipartisanBuying).toBe(false);
  });

  it("skips non-directional (Exchange) rows entirely", () => {
    const { rows } = buildCongressTradeScreen(
      [
        trade({ ticker: "NVDA", transactionType: "Exchange" }),
        trade({ ticker: "NVDA", transactionType: "Purchase" }),
      ],
      stocks,
    );
    expect(rows[0].trades).toBe(1);
    expect(rows[0].buys).toBe(1);
  });

  it("counts committee leadership trades without weighting them", () => {
    const { rows } = buildCongressTradeScreen(
      [
        trade({ ticker: "NVDA", politicianId: 1 }),
        trade({ ticker: "NVDA", politicianId: 2 }),
        trade({ ticker: "NVDA", politicianId: 3 }),
      ],
      stocks,
      new Set([1, 3]),
    );
    expect(rows[0].leadershipTrades).toBe(2);
  });

  it("averages disclosure lag in days and tracks the latest dates", () => {
    const { rows } = buildCongressTradeScreen(
      [
        trade({
          ticker: "NVDA",
          transactionDate: new Date("2026-05-01T00:00:00.000Z"),
          disclosureDate: new Date("2026-05-03T00:00:00.000Z"), // 2 days
        }),
        trade({
          ticker: "NVDA",
          politicianId: 2,
          transactionDate: new Date("2026-05-10T00:00:00.000Z"),
          disclosureDate: new Date("2026-05-18T00:00:00.000Z"), // 8 days
        }),
      ],
      stocks,
    );
    expect(rows[0].avgDisclosureLagDays).toBe(5);
    expect(rows[0].latestTransactionDate?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(rows[0].latestDisclosureDate?.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  it("lists the most active traders by name, capped at three", () => {
    const { rows } = buildCongressTradeScreen(
      [
        trade({ ticker: "NVDA", representative: "Alice", politicianId: 1 }),
        trade({ ticker: "NVDA", representative: "Alice", politicianId: 1 }),
        trade({ ticker: "NVDA", representative: "Bob", politicianId: 2 }),
        trade({ ticker: "NVDA", representative: "Carol", politicianId: 3 }),
        trade({ ticker: "NVDA", representative: "Dave", politicianId: 4 }),
      ],
      stocks,
    );
    expect(rows[0].topTraders).toEqual(["Alice", "Bob", "Carol"]);
  });

  it("sorts rows by trade count descending and summarizes totals", () => {
    const { rows, summary } = buildCongressTradeScreen(
      [
        trade({ ticker: "QUIET", transactionType: "Purchase" }),
        trade({ ticker: "BUSY", transactionType: "Purchase", politicianId: 1 }),
        trade({ ticker: "BUSY", transactionType: "Sale", politicianId: 2 }),
        trade({ ticker: "BUSY", transactionType: "Purchase", politicianId: 3 }),
      ],
      [],
    );

    expect(rows.map((r) => r.ticker)).toEqual(["BUSY", "QUIET"]);
    expect(summary.tickers).toBe(2);
    expect(summary.trades).toBe(4);
    expect(summary.buys).toBe(3);
    expect(summary.sells).toBe(1);
    // 3 buys * $1,000 - 1 sell * $1,000 = $2,000
    expect(summary.netUsd).toBe(2000);
    expect(summary.grossUsd).toBe(4000);
  });

  it("returns an empty screen for no trades", () => {
    const { rows, summary } = buildCongressTradeScreen([], stocks);
    expect(rows).toEqual([]);
    expect(summary.tickers).toBe(0);
    expect(summary.trades).toBe(0);
    expect(summary.latestTransactionDate).toBeNull();
  });
});
