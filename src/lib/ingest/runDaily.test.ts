// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const runAllMock = vi.fn();
const appendIngestRunMock = vi.fn();
const syncPoliticianStatesMock = vi.fn();
const syncStockUniverseMock = vi.fn();
const runMarketCapBackfillMock = vi.fn();

vi.mock("@/lib/ingest/datasets", () => ({
  DATASETS: [{ name: "OffExchangeActivity" }],
}));

vi.mock("@/lib/ingest/engine", () => ({
  runAll: runAllMock,
}));

vi.mock("@/lib/ingest/jobs", () => ({
  readBackfillJob: vi.fn(),
  writeBackfillJob: vi.fn(),
  appendIngestRun: appendIngestRunMock,
}));

vi.mock("@/lib/ingest/politicians", () => ({
  syncPoliticianStates: syncPoliticianStatesMock,
}));

vi.mock("@/lib/stock-universe", () => ({
  syncStockUniverse: syncStockUniverseMock,
}));

vi.mock("@/lib/marketcap", () => ({
  runMarketCapBackfill: runMarketCapBackfillMock,
}));

describe("runDaily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAllMock.mockResolvedValue([]);
    appendIngestRunMock.mockResolvedValue(undefined);
    syncPoliticianStatesMock.mockResolvedValue(undefined);
    syncStockUniverseMock.mockResolvedValue({
      inserted: 0,
      companyNamesFilled: 0,
      totalStocks: 0,
    });
    runMarketCapBackfillMock.mockResolvedValue({
      total: 1,
      candidates: 1,
      ok: 1,
      skipped: 0,
      fail: 0,
    });
  });

  it("skips market cap refresh when daily marketCapLimit is 0", async () => {
    const { runDaily } = await import("./runDaily");

    const result = await runDaily({
      apiKey: "test",
      totalBudgetMs: 1000,
      perDatasetBudgetMs: 1000,
      datasetNames: ["OffExchangeActivity"],
      marketCapLimit: 0,
    });

    expect(runMarketCapBackfillMock).not.toHaveBeenCalled();
    expect(syncPoliticianStatesMock).not.toHaveBeenCalled();
    expect(syncStockUniverseMock).not.toHaveBeenCalled();
    expect(result.marketCap).toEqual({
      total: 0,
      candidates: 0,
      ok: 0,
      skipped: 0,
      fail: 0,
    });
  });

  it("runs market cap refresh when daily marketCapLimit is positive", async () => {
    const { runDaily } = await import("./runDaily");

    await runDaily({
      apiKey: "test",
      totalBudgetMs: 1000,
      perDatasetBudgetMs: 1000,
      datasetNames: ["OffExchangeActivity"],
      marketCapLimit: 5,
    });

    expect(runMarketCapBackfillMock).toHaveBeenCalledWith({ limit: 5 });
  });

  it("runs auxiliary syncs for the full daily pipeline", async () => {
    const { runDaily } = await import("./runDaily");

    await runDaily({
      apiKey: "test",
      totalBudgetMs: 1000,
      perDatasetBudgetMs: 1000,
      datasetNames: null,
      marketCapLimit: 0,
    });

    expect(syncPoliticianStatesMock).toHaveBeenCalledOnce();
    expect(syncStockUniverseMock).toHaveBeenCalledOnce();
  });
});
