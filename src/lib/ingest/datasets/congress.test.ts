import { describe, expect, it } from "vitest";

import { CongressTradeSpec } from "./congress";

describe("CongressTradeSpec", () => {
  it("normalizes current Quiver bulk fields into the app trade shape", () => {
    const rows = CongressTradeSpec.parse([
      {
        Ticker: "TCNNF",
        TickerType: "ST",
        Company: null,
        Traded: "2026-05-06",
        Transaction: "Sale",
        Trade_Size_USD: "15001.0",
        Description: "THIS STOCK WAS ACQUIRED AS PART OF AN EXECUTIVE COMPENSATION PACKAGE.",
        Name: "Greg Stanton",
        BioGuideID: "S001211",
        Filed: "2026-05-07",
        Party: "Democratic",
        District: "4.0",
        Chamber: "Representatives",
        State: "AZ",
      },
    ] as never);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Representative: "Greg Stanton",
      Ticker: "TCNNF",
      Transaction: "Sale",
      TransactionDate: "2026-05-06",
      ReportDate: "2026-05-07",
      Disclosed: "2026-05-07",
      Range: "$15,001 - $50,000",
      House: "House",
      Party: "D",
      State: "AZ",
      AssetDescription: "THIS STOCK WAS ACQUIRED AS PART OF AN EXECUTIVE COMPENSATION PACKAGE.",
      BioGuideID: "S001211",
    });
  });

  it("keeps current live fields when already in app trade shape", () => {
    const rows = CongressTradeSpec.parse([
      {
        Representative: "John Boozman",
        BioGuideID: "B001236",
        ReportDate: "2026-05-08",
        TransactionDate: "2026-04-02",
        Ticker: "TBLL",
        Transaction: "Sale (Partial)",
        Range: "$1,001 - $15,000",
        House: "Senate",
        Amount: "1001.0",
        Party: "R",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      Representative: "John Boozman",
      TransactionDate: "2026-04-02",
      Range: "$1,001 - $15,000",
      House: "Senate",
      Party: "R",
    });
  });

  it("keeps a newly filed disclosure even when the transaction date is older than the daily cutoff", () => {
    const previous = process.env.INGEST_MIN_DATE;
    process.env.INGEST_MIN_DATE = "2026-05-08";

    try {
      const rows = CongressTradeSpec.parse([
        {
          Representative: "John Boozman",
          BioGuideID: "B001236",
          ReportDate: "2026-05-08",
          TransactionDate: "2026-04-02",
          Ticker: "TBLL",
          Transaction: "Sale (Partial)",
          Range: "$1,001 - $15,000",
          House: "Senate",
          Amount: "1001.0",
          Party: "R",
        },
      ] as never);

      expect(rows).toHaveLength(1);
    } finally {
      process.env.INGEST_MIN_DATE = previous;
    }
  });

  it("preserves owner metadata for spouse and dependent tracking when provided", () => {
    const rows = CongressTradeSpec.parse([
      {
        Representative: "Nancy Pelosi",
        Ticker: "NVDA",
        Transaction: "Purchase",
        TransactionDate: "2026-05-01",
        ReportDate: "2026-05-09",
        Range: "$100,001 - $250,000",
        House: "House",
        Party: "D",
        Owner: "Spouse",
        OwnerName: "Paul Pelosi",
        FilingURL: "https://disclosures.example/ptr.pdf",
        DocumentID: "PTR-123",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      OwnerType: "SPOUSE",
      OwnerName: "Paul Pelosi",
      OwnerRaw: "Spouse",
      FilingUrl: "https://disclosures.example/ptr.pdf",
      DocumentId: "PTR-123",
    });
  });
});
