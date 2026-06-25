import { describe, expect, it, vi } from "vitest";
import {
  getDailyBars,
  shapeEarningsSnapshot,
  type BarRow,
  type DailyBarsDeps,
} from "./client";

const bar = (iso: string, n: number, volume?: number): BarRow => ({
  date: new Date(`${iso}T00:00:00Z`),
  open: n - 1,
  high: n + 1,
  low: n - 2,
  close: n,
  volume: volume ?? 1_000 * n,
});

function makeDeps(overrides: Partial<DailyBarsDeps> = {}): DailyBarsDeps {
  return {
    readCache: vi.fn().mockResolvedValue([] satisfies BarRow[]),
    writeCache: vi.fn().mockResolvedValue(undefined),
    fetchYahoo: vi.fn().mockResolvedValue([] satisfies BarRow[]),
    ...overrides,
  };
}

describe("getDailyBars", () => {
  it("returns sorted cached bars when cache covers up to `to`", async () => {
    const deps = makeDeps({
      readCache: vi.fn().mockResolvedValue([
        bar("2025-09-03", 102),
        bar("2025-09-01", 100),
        bar("2025-09-02", 101),
      ]),
    });
    const out = await getDailyBars(
      "NVDA",
      new Date("2025-09-01T00:00:00Z"),
      new Date("2025-09-03T00:00:00Z"),
      deps,
    );
    expect(deps.fetchYahoo).not.toHaveBeenCalled();
    expect(out.map((r) => r.close)).toEqual([100, 101, 102]);
  });

  it("calls yahoo and writes to cache when cache is empty", async () => {
    const fresh = [bar("2025-09-01", 100), bar("2025-09-02", 101)];
    const deps = makeDeps({
      readCache: vi.fn().mockResolvedValue([]),
      fetchYahoo: vi.fn().mockResolvedValue(fresh),
    });
    const out = await getDailyBars(
      "NVDA",
      new Date("2025-09-01T00:00:00Z"),
      new Date("2025-09-02T00:00:00Z"),
      deps,
    );
    expect(deps.fetchYahoo).toHaveBeenCalledOnce();
    expect(deps.writeCache).toHaveBeenCalledWith("NVDA", fresh);
    expect(out).toHaveLength(2);
  });

  it("calls yahoo when cache is stale (max cached date is far from `to`)", async () => {
    const deps = makeDeps({
      readCache: vi.fn().mockResolvedValue([bar("2025-09-01", 100)]),
      fetchYahoo: vi.fn().mockResolvedValue([bar("2025-09-15", 110)]),
    });
    await getDailyBars(
      "NVDA",
      new Date("2025-09-01T00:00:00Z"),
      new Date("2025-09-15T00:00:00Z"),
      deps,
    );
    expect(deps.fetchYahoo).toHaveBeenCalledOnce();
  });

  it("does not call writeCache when yahoo returns empty", async () => {
    const deps = makeDeps({
      readCache: vi.fn().mockResolvedValue([]),
      fetchYahoo: vi.fn().mockResolvedValue([]),
    });
    const out = await getDailyBars(
      "ZZZ",
      new Date("2025-09-01T00:00:00Z"),
      new Date("2025-09-02T00:00:00Z"),
      deps,
    );
    expect(deps.fetchYahoo).toHaveBeenCalledOnce();
    expect(deps.writeCache).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it("dedupes cached + fetched bars by date when cache is stale", async () => {
    const deps = makeDeps({
      readCache: vi.fn().mockResolvedValue([bar("2025-09-01", 100)]),
      fetchYahoo: vi.fn().mockResolvedValue([
        bar("2025-09-01", 999),
        bar("2025-09-15", 110),
      ]),
    });
    const out = await getDailyBars(
      "NVDA",
      new Date("2025-09-01T00:00:00Z"),
      new Date("2025-09-15T00:00:00Z"),
      deps,
    );
    expect(out.map((r) => r.close)).toEqual([999, 110]);
  });

  it("preserves OHLCV fields end-to-end", async () => {
    const fresh = [bar("2025-09-12", 102)];
    const deps = makeDeps({
      fetchYahoo: vi.fn().mockResolvedValue(fresh),
    });
    const out = await getDailyBars(
      "NVDA",
      new Date("2025-09-09T00:00:00Z"),
      new Date("2025-09-12T00:00:00Z"),
      deps,
    );
    expect(out[0]).toMatchObject({
      open: 101,
      high: 103,
      low: 100,
      close: 102,
      volume: 102_000,
    });
  });
});

describe("shapeEarningsSnapshot", () => {
  it("extracts next earnings date, call date, EPS estimates, and revenue estimates", () => {
    const out = shapeEarningsSnapshot({
      calendarEvents: {
        earnings: {
          earningsDate: [new Date("2026-06-01T21:00:00Z")],
          earningsCallDate: [new Date("2026-06-01T22:00:00Z")],
          isEarningsDateEstimate: true,
          earningsAverage: 1.25,
          earningsLow: 1.1,
          earningsHigh: 1.4,
          revenueAverage: 12_500_000_000,
          revenueLow: 12_000_000_000,
          revenueHigh: 13_000_000_000,
        },
      },
    });

    expect(out).toEqual({
      earningsDate: new Date("2026-06-01T21:00:00Z"),
      earningsCallDate: new Date("2026-06-01T22:00:00Z"),
      isEstimate: true,
      epsAverage: 1.25,
      epsLow: 1.1,
      epsHigh: 1.4,
      revenueAverage: 12_500_000_000,
      revenueLow: 12_000_000_000,
      revenueHigh: 13_000_000_000,
    });
  });

  it("returns null fields when Yahoo has no calendar event", () => {
    expect(shapeEarningsSnapshot({})).toEqual({
      earningsDate: null,
      earningsCallDate: null,
      isEstimate: true,
      epsAverage: null,
      epsLow: null,
      epsHigh: null,
      revenueAverage: null,
      revenueLow: null,
      revenueHigh: null,
    });
  });
});
