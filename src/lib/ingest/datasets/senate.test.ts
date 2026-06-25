import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/senate.json";
import { SenateTradeSpec } from "./senate";

describe("SenateTradeSpec", () => {
  it("parses the fixture into one row", () => {
    const rows = SenateTradeSpec.parse(fixture as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].senator).toBe("Jane Doe");
    expect(rows[0].ticker).toBe("AAPL");
    expect(rows[0].amountMinCents).toBe(100100n);
    expect(rows[0].amountMaxCents).toBe(1500000n);
  });
  it("dedup hash is stable", () => {
    const rows = SenateTradeSpec.parse(fixture as never);
    expect(SenateTradeSpec.dedup(rows[0])).toBe(SenateTradeSpec.dedup(rows[0]));
  });

  it("parses current Quiver live rows that use Date instead of TransactionDate", () => {
    const rows = SenateTradeSpec.parse([
      {
        Senator: "Shelley Moore Capito",
        BioGuideID: "C001047",
        Date: "2026-04-17",
        Ticker: "CEG",
        Transaction: "Sale (Partial)",
        Range: "$1,001 - $15,000",
        Amount: "1001.0",
        last_modified: "2026-05-07",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      senator: "Shelley Moore Capito",
      ticker: "CEG",
      transactionType: "Sale (Partial)",
      amountMinCents: 100100n,
      amountMaxCents: 1500000n,
    });
    expect(rows[0].transactionDate.toISOString().slice(0, 10)).toBe("2026-04-17");
  });

  it("uses last_modified as disclosure freshness for daily cutoff filtering", () => {
    const previous = process.env.INGEST_MIN_DATE;
    process.env.INGEST_MIN_DATE = "2026-05-08";

    try {
      const rows = SenateTradeSpec.parse([
        {
          Senator: "Shelley Moore Capito",
          BioGuideID: "C001047",
          Date: "2026-04-17",
          Ticker: "CEG",
          Transaction: "Sale (Partial)",
          Range: "$1,001 - $15,000",
          Amount: "1001.0",
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
    const rows = SenateTradeSpec.parse([
      {
        Senator: "John Boozman",
        Date: "2026-04-02",
        Ticker: "TBLL",
        Transaction: "Sale (Partial)",
        Range: "$1,001 - $15,000",
        Owner: "SP",
        OwnerName: "Spouse",
        FilingURL: "https://disclosures.example/senate-ptr.pdf",
        DocumentID: "SEN-456",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      ownerType: "SPOUSE",
      ownerName: "Spouse",
      ownerRaw: "SP",
      filingUrl: "https://disclosures.example/senate-ptr.pdf",
      documentId: "SEN-456",
    });
  });
});
