import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/thirteenf.json";
import { ThirteenFHoldingSpec } from "./thirteenf";

describe("ThirteenFHoldingSpec", () => {
  it("parses fixture with cents conversion", () => {
    const rows = ThirteenFHoldingSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].filer).toBe("Berkshire Hathaway");
    expect(rows[0].valueCents).toBe(BigInt(17_500_000_000_000));
    expect(rows[1].changeShares).toBe(1500000);
  });
  it("dedup distinct per (filer, ticker, reportDate)", () => {
    const rows = ThirteenFHoldingSpec.parse(fixture as never);
    expect(ThirteenFHoldingSpec.dedup(rows[0])).not.toBe(ThirteenFHoldingSpec.dedup(rows[1]));
  });

  it("coerces numeric strings from live Quiver rows", () => {
    const rows = ThirteenFHoldingSpec.parse([
      {
        Filer: "Test Fund",
        Ticker: "NVDA",
        Shares: "1000",
        Value: "250000",
        ChangeShares: "-25",
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      shares: 1000,
      valueCents: BigInt(25_000_000),
      changeShares: -25,
    });
  });

  it("normalizes 13F put and call option markers", () => {
    const rows = ThirteenFHoldingSpec.parse([
      {
        Filer: "Options Fund",
        Ticker: "NVDA",
        Shares: 1000,
        Value: 250000,
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
        "Put/Call": "Put",
      },
      {
        Filer: "Options Fund",
        Ticker: "MSFT",
        Shares: 1000,
        Value: 250000,
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
        "Put/Call": "Call",
      },
      {
        Filer: "Options Fund",
        Ticker: "AAPL",
        Shares: 1000,
        Value: 250000,
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
      },
    ] as never);

    expect(rows.map((row) => row.putCall)).toEqual(["PUT", "CALL", null]);
  });

  it("parses sec13fchanges rows into common-stock holdings with share changes", () => {
    const rows = ThirteenFHoldingSpec.parse([
      {
        Date: "2026-05-15T20:33:48.000",
        ReportPeriod: "2026-03-31T00:00:00.000",
        Ticker: "FIHL",
        Fund: "MILLENNIUM MANAGEMENT LLC",
        Change_Share: -473316,
        Held: 132842,
        Close: 19.11,
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      filer: "MILLENNIUM MANAGEMENT LLC",
      ticker: "FIHL",
      shares: 132842,
      changeShares: -473316,
      putCall: null,
    });
    expect(rows[0].valueCents).toBe(BigInt(253_861_062));
  });

  it("dedups common stock, calls, and puts separately for the same filer ticker and report date", () => {
    const rows = ThirteenFHoldingSpec.parse([
      {
        Filer: "Options Fund",
        Ticker: "NVDA",
        Shares: 1000,
        Value: 250000,
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
      },
      {
        Filer: "Options Fund",
        Ticker: "NVDA",
        Shares: 1000,
        Value: 250000,
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
        "Put/Call": "Call",
      },
      {
        Filer: "Options Fund",
        Ticker: "NVDA",
        Shares: 1000,
        Value: 250000,
        FilingDate: "2026-05-10",
        ReportDate: "2026-03-31",
        "Put/Call": "Put",
      },
    ] as never);

    expect(new Set(rows.map((row) => ThirteenFHoldingSpec.dedup(row))).size).toBe(3);
  });
});
