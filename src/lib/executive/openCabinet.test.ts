import { describe, expect, it } from "vitest";

import {
  parseOpenCabinetAmountRange,
  shapeOpenCabinetDataset,
} from "./openCabinet";

describe("parseOpenCabinetAmountRange", () => {
  it("parses executive disclosure ranges into cents", () => {
    expect(parseOpenCabinetAmountRange("$1,001-$15,000")).toEqual({
      minCents: BigInt(100_100),
      maxCents: BigInt(1_500_000),
      midCents: BigInt(800_050),
    });
  });

  it("parses open-ended over ranges", () => {
    expect(parseOpenCabinetAmountRange("Over $50,000,000")).toEqual({
      minCents: BigInt(5_000_000_000),
      maxCents: null,
      midCents: BigInt(5_000_000_000),
    });
  });
});

describe("shapeOpenCabinetDataset", () => {
  it("keeps non-ticker trades but only exposes valid tickers for stock sync", () => {
    const shaped = shapeOpenCabinetDataset({
      generatedAt: "2026-04-13T18:57:00Z",
      officialCount: 1,
      transactionCount: 2,
      officials: [
        {
          name: "Bedford, Bryan",
          slug: "bedford-bryan",
          title: "FAA Administrator",
          agency: "Department of Transportation",
          level: "Sub-Cabinet",
          party: "R",
          filingType: "278-T Periodic Transaction Report",
          mostRecentFilingDate: "2026-04-09",
          sourceFilings: [
            {
              date: "2026-04-09",
              url: "https://example.test/report.pdf",
              label: "278-T",
            },
          ],
          transactions: [
            {
              description: "Medtronic Plc",
              ticker: "MDT",
              type: "Purchase",
              date: "2025-07-11",
              amount: "$15,001-$50,000",
              lateFilingFlag: false,
            },
            {
              description: "Old Farm Partners",
              ticker: null,
              type: "Sale",
              date: "2025-01-28",
              amount: "$100,001-$250,000",
              lateFilingFlag: true,
            },
          ],
        },
      ],
    });

    expect(shaped.officials).toHaveLength(1);
    expect(shaped.sourceFilings).toHaveLength(1);
    expect(shaped.trades).toHaveLength(2);
    expect(shaped.stockTickers).toEqual(["MDT"]);
    expect(shaped.trades[1]).toMatchObject({
      ticker: null,
      assetDescription: "Old Farm Partners",
      lateFilingFlag: true,
    });
  });

  it("creates stable hashes so repeated imports dedupe the same JSON rows", () => {
    const first = shapeOpenCabinetDataset({
      generatedAt: "2026-04-13T18:57:00Z",
      officialCount: 1,
      transactionCount: 1,
      officials: [
        {
          name: "Bedford, Bryan",
          slug: "bedford-bryan",
          title: "FAA Administrator",
          agency: "Department of Transportation",
          transactions: [
            {
              description: "Medtronic Plc",
              ticker: "MDT",
              type: "Purchase",
              date: "2025-07-11",
              amount: "$15,001-$50,000",
              lateFilingFlag: false,
            },
          ],
        },
      ],
    });
    const second = shapeOpenCabinetDataset({
      generatedAt: "2026-05-01T00:00:00Z",
      officialCount: 1,
      transactionCount: 1,
      officials: [
        {
          name: "Bedford, Bryan",
          slug: "bedford-bryan",
          title: "FAA Administrator",
          agency: "Department of Transportation",
          transactions: [
            {
              description: "Medtronic Plc",
              ticker: "MDT",
              type: "Purchase",
              date: "2025-07-11",
              amount: "$15,001-$50,000",
              lateFilingFlag: false,
            },
          ],
        },
      ],
    });

    expect(first.trades[0]?.sourceHash).toEqual(second.trades[0]?.sourceHash);
  });

  it("preserves repeated identical disclosure rows with distinct hashes", () => {
    const shaped = shapeOpenCabinetDataset({
      officials: [
        {
          name: "Bessent, Scott",
          slug: "bessent-scott",
          title: "Secretary",
          agency: "Department of the Treasury",
          transactions: [
            {
              description: "SPDR Gold Shares (GLD)",
              ticker: "GLD",
              type: "Sale",
              date: "2025-03-04",
              amount: "$50,001-$100,000",
              lateFilingFlag: false,
            },
            {
              description: "SPDR Gold Shares (GLD)",
              ticker: "GLD",
              type: "Sale",
              date: "2025-03-04",
              amount: "$50,001-$100,000",
              lateFilingFlag: false,
            },
          ],
        },
      ],
    });

    expect(shaped.trades).toHaveLength(2);
    expect(shaped.trades[0]?.sourceHash).not.toEqual(shaped.trades[1]?.sourceHash);
  });
});
