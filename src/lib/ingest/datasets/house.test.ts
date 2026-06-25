import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/house.json";
import { HouseTradeSpec } from "./house";

describe("HouseTradeSpec", () => {
  it("parses the fixture into one row", () => {
    const rows = HouseTradeSpec.parse(fixture as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].representative).toBe("John Smith");
    expect(rows[0].ticker).toBe("MSFT");
    expect(rows[0].district).toBe("TX-22");
    expect(rows[0].amountMinCents).toBe(1500100n);
    expect(rows[0].amountMaxCents).toBe(5000000n);
  });
  it("dedup hash is stable", () => {
    const rows = HouseTradeSpec.parse(fixture as never);
    expect(HouseTradeSpec.dedup(rows[0])).toBe(HouseTradeSpec.dedup(rows[0]));
  });

  it("parses current Quiver live rows that use Date instead of TransactionDate", () => {
    const rows = HouseTradeSpec.parse([
      {
        Representative: "Greg Stanton",
        BioGuideID: "S001211",
        Date: "2026-05-06",
        Ticker: "TCNNF",
        Transaction: "Sale",
        Range: "$15,001 - $50,000",
        Amount: "15001.0",
        last_modified: "2026-05-08",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      representative: "Greg Stanton",
      ticker: "TCNNF",
      transactionType: "Sale",
      amountMinCents: 1500100n,
      amountMaxCents: 5000000n,
    });
    expect(rows[0].transactionDate.toISOString().slice(0, 10)).toBe("2026-05-06");
  });

  it("uses last_modified as disclosure freshness for daily cutoff filtering", () => {
    const previous = process.env.INGEST_MIN_DATE;
    process.env.INGEST_MIN_DATE = "2026-05-08";

    try {
      const rows = HouseTradeSpec.parse([
        {
          Representative: "Greg Stanton",
          BioGuideID: "S001211",
          Date: "2026-04-12",
          Ticker: "TCNNF",
          Transaction: "Sale",
          Range: "$15,001 - $50,000",
          Amount: "15001.0",
          last_modified: "2026-05-08",
        },
      ] as never);

      expect(rows).toHaveLength(1);
      expect(rows[0].reportDate?.toISOString().slice(0, 10)).toBe("2026-05-08");
    } finally {
      process.env.INGEST_MIN_DATE = previous;
    }
  });

  it("preserves owner metadata for spouse and dependent tracking when provided", () => {
    const rows = HouseTradeSpec.parse([
      {
        Representative: "Nancy Pelosi",
        Date: "2026-05-01",
        Ticker: "NVDA",
        Transaction: "Purchase",
        Range: "$100,001 - $250,000",
        Owner: "Dependent Child",
        OwnerName: "Dependent Child",
        FilingURL: "https://disclosures.example/house-ptr.pdf",
        DocumentID: "HOUSE-789",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      ownerType: "DEPENDENT_CHILD",
      ownerName: "Dependent Child",
      ownerRaw: "Dependent Child",
      filingUrl: "https://disclosures.example/house-ptr.pdf",
      documentId: "HOUSE-789",
    });
  });
});
