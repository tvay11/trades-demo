// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  congressFindMany: vi.fn(),
  executiveFindMany: vi.fn(),
}));
const { congressFindMany, executiveFindMany } = mocks;

vi.mock("@/lib/db", () => ({
  db: {
    congressTrade: { findMany: mocks.congressFindMany },
    executiveTrade: { findMany: mocks.executiveFindMany },
  },
}));

import { fetchAllTrades } from "./unified";

beforeEach(() => {
  congressFindMany.mockReset();
  executiveFindMany.mockReset();
});

function makeCongressFixture(id: number, date: string) {
  return {
    id,
    ticker: "AAPL",
    assetDescription: null,
    transactionType: "Purchase",
    transactionDate: new Date(date),
    disclosureDate: new Date(date),
    reportDate: null,
    amountMinCents: null,
    amountMaxCents: null,
    amountRangeRaw: null,
    ownerType: null,
    ownerName: null,
    ownerRaw: null,
    filingUrl: null,
    documentId: null,
    sourceHash: `c${id}`,
    politician: { id, name: `P${id}`, party: null, state: null, chamber: null },
  };
}

function makeExecFixture(id: number, date: string) {
  return {
    id,
    ticker: "NVDA",
    assetDescription: "",
    transactionType: "Sale",
    transactionDate: new Date(date),
    amountMinCents: null,
    amountMaxCents: null,
    amountRangeRaw: "",
    lateFilingFlag: false,
    sourceHash: `e${id}`,
    official: { id, name: `O${id}`, title: null, party: null, agency: null },
  };
}

describe("fetchAllTrades", () => {
  it("merges both tables, sorts by disclosureDate desc with transactionDate fallback", async () => {
    congressFindMany.mockResolvedValue([
      {
        id: 1,
        ticker: "AAPL",
        assetDescription: "Apple",
        transactionType: "Purchase",
        transactionDate: new Date("2026-01-01"),
        disclosureDate: new Date("2026-01-10"),
        reportDate: null,
        amountMinCents: 5_000_000n,
        amountMaxCents: 10_000_000n,
        amountRangeRaw: "$50K-$100K",
        ownerType: null,
        ownerName: null,
        ownerRaw: null,
        filingUrl: null,
        documentId: null,
        sourceHash: "c1",
        politician: { id: 7, name: "Pelosi", party: "D", state: "CA", chamber: "House" },
      },
    ]);
    executiveFindMany.mockResolvedValue([
      {
        id: 2,
        ticker: "NVDA",
        assetDescription: "NVIDIA",
        transactionType: "Sale",
        transactionDate: new Date("2026-01-15"),
        amountMinCents: 1_000_000n,
        amountMaxCents: 5_000_000n,
        amountRangeRaw: "$10K-$50K",
        lateFilingFlag: false,
        sourceHash: "e1",
        official: {
          id: 3,
          name: "Yellen",
          title: "Treasury Secretary",
          party: null,
          agency: { name: "Treasury" },
        },
      },
    ]);

    const rows = await fetchAllTrades();
    expect(rows).toHaveLength(2);
    // Executive (transactionDate=2026-01-15) ranks ahead of congress (disclosureDate=2026-01-10).
    expect(rows[0]?.id).toBe("exec-2");
    expect(rows[0]?.branch).toBe("executive");
    expect(rows[0]?.person.agency).toBe("Treasury");
    expect(rows[1]?.id).toBe("cong-1");
    expect(rows[1]?.branch).toBe("congress");
    expect(rows[1]?.person.chamber).toBe("House");
  });

  it("filters by ticker on both tables", async () => {
    congressFindMany.mockResolvedValue([]);
    executiveFindMany.mockResolvedValue([]);
    await fetchAllTrades({ ticker: "AAPL" });
    expect(congressFindMany.mock.calls[0]?.[0].where).toMatchObject({ ticker: "AAPL" });
    expect(executiveFindMany.mock.calls[0]?.[0].where).toMatchObject({ ticker: "AAPL" });
  });

  it("excludes null-ticker executive rows by default", async () => {
    congressFindMany.mockResolvedValue([]);
    executiveFindMany.mockResolvedValue([]);
    await fetchAllTrades();
    expect(executiveFindMany.mock.calls[0]?.[0].where).toMatchObject({
      ticker: { not: null },
    });
  });

  it("includes null-ticker rows when includeNullTickers=true", async () => {
    congressFindMany.mockResolvedValue([]);
    executiveFindMany.mockResolvedValue([]);
    await fetchAllTrades({ includeNullTickers: true });
    expect(executiveFindMany.mock.calls[0]?.[0].where).not.toHaveProperty("ticker");
  });

  it("respects `take`", async () => {
    congressFindMany.mockResolvedValue([
      makeCongressFixture(1, "2026-01-10"),
      makeCongressFixture(2, "2026-01-09"),
    ]);
    executiveFindMany.mockResolvedValue([makeExecFixture(3, "2026-01-11")]);
    const rows = await fetchAllTrades({ take: 2 });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe("exec-3");
  });
});
