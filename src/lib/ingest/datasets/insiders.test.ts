import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/insiders.json";
import { InsiderTradeSpec } from "./insiders";

describe("InsiderTradeSpec", () => {
  it("parses fixture with cents conversion for price and total", () => {
    const rows = InsiderTradeSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].insiderName).toBe("Tim Cook");
    expect(rows[0].pricePerShareCents).toBe(17550);
    expect(rows[0].totalValueCents).toBe(BigInt(877_500_000));
    expect(rows[1].pricePerShareCents).toBe(41200);
    expect(rows[1].totalValueCents).toBe(BigInt(412_000_000));
  });
  it("dedup distinct per row", () => {
    const rows = InsiderTradeSpec.parse(fixture as never);
    expect(InsiderTradeSpec.dedup(rows[0])).not.toBe(InsiderTradeSpec.dedup(rows[1]));
  });

  it("parses current Quiver live rows with SEC ownership fields", () => {
    const rows = InsiderTradeSpec.parse([
      {
        Ticker: "NEWT",
        Date: "2026-05-07T00:00:00.000",
        Name: "SALUTE RICHARD J",
        AcquiredDisposedCode: "A",
        TransactionCode: "P",
        Shares: 1000,
        PricePerShare: 13.4699,
        SharesOwnedFollowing: 45772,
        fileDate: "2026-05-08T13:36:32.000",
        officerTitle: null,
        isDirector: true,
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      ticker: "NEWT",
      insiderName: "SALUTE RICHARD J",
      insiderTitle: "Director",
      transactionType: "P/A",
      shares: 1000,
      pricePerShareCents: 1347,
      totalValueCents: BigInt(1_346_990),
      sharesOwnedAfter: 45772,
      formType: "director",
    });
    expect(rows[0].filingDate?.toISOString().slice(0, 10)).toBe("2026-05-08");
  });

  it("coerces numeric strings from live Quiver rows", () => {
    const rows = InsiderTradeSpec.parse([
      {
        Ticker: "NVDA",
        Date: "2026-05-10",
        Name: "Jane Insider",
        AcquiredDisposedCode: "A",
        TransactionCode: "P",
        Shares: "125",
        PricePerShare: "80.25",
        TotalValue: "10031.25",
        SharesOwnedFollowing: "5000",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      shares: 125,
      pricePerShareCents: 8025,
      totalValueCents: BigInt(1_003_125),
      sharesOwnedAfter: 5000,
    });
  });
});
