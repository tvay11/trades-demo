import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
  getQuoteSnapshot: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
    $executeRawUnsafe: mocks.executeRawUnsafe,
  },
}));

vi.mock("@/lib/yahoo/client", () => ({
  getQuoteSnapshot: mocks.getQuoteSnapshot,
}));

import { runMarketCapBackfill } from "./marketcap";

describe("runMarketCapBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRawUnsafe.mockResolvedValue([
      { ticker: "AAPL", marketCap: null, updatedAt: "2026-05-01T00:00:00.000Z" },
      { ticker: "MSFT", marketCap: null, updatedAt: "2026-05-01T00:00:00.000Z" },
      { ticker: "NVDA", marketCap: null, updatedAt: "2026-05-01T00:00:00.000Z" },
    ]);
    mocks.getQuoteSnapshot.mockResolvedValue({
      marketCap: 1_000_000,
      companyName: "Company",
      exchange: "NASDAQ",
      sector: "Technology",
      industry: "Software",
      country: "US",
      website: "https://example.com",
    });
    mocks.executeRawUnsafe.mockResolvedValue(1);
  });

  it("limits how many stale tickers are refreshed in daily mode", async () => {
    const summary = await runMarketCapBackfill({ limit: 2 } as never);

    expect(mocks.getQuoteSnapshot).toHaveBeenCalledTimes(2);
    expect(mocks.getQuoteSnapshot).toHaveBeenNthCalledWith(1, "AAPL");
    expect(mocks.getQuoteSnapshot).toHaveBeenNthCalledWith(2, "MSFT");
    expect(summary).toMatchObject({
      total: 3,
      candidates: 2,
      ok: 2,
      skipped: 0,
      fail: 0,
    });
  });

  it("treats limit=0 as no limit (was previously 'refresh zero stocks')", async () => {
    const summary = await runMarketCapBackfill({ limit: 0 } as never);
    expect(mocks.getQuoteSnapshot).toHaveBeenCalledTimes(3);
    expect(summary).toMatchObject({ total: 3, candidates: 3, ok: 3 });
  });

  it("treats limit=null as no limit", async () => {
    const summary = await runMarketCapBackfill({ limit: null } as never);
    expect(mocks.getQuoteSnapshot).toHaveBeenCalledTimes(3);
    expect(summary).toMatchObject({ total: 3, candidates: 3, ok: 3 });
  });
});
