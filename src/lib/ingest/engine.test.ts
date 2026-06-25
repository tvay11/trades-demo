import { describe, it, expect, vi } from "vitest";
import { fetchPage, runOne, runAll } from "./engine";
import type { RunOneJob } from "./engine";
import type { DatasetSpec } from "./types";

describe("fetchPage", () => {
  it("paginates page-based, returns next cursor when full page", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => Array.from({ length: 100 }, (_, i) => ({ id: i })),
      text: async () => "",
    }));

    const res = await fetchPage(
      { baseUrl: "https://api.test", endpoint: "/foo", cursor: null, pageSize: 100 },
      { type: "page", pageSize: 100, param: "page" },
      fetcher as unknown as typeof fetch,
      "key"
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.test/foo?page=1&page_size=100",
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(Array.isArray(res.rows)).toBe(true);
    expect((res.rows as unknown[]).length).toBe(100);
    expect(res.nextCursor).toBe("2");
  });

  it("normalizes Quiver data envelopes before parser pagination logic", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 1 }, { id: 2 }] }),
      text: async () => "",
    }));

    const res = await fetchPage(
      { baseUrl: "https://api.test", endpoint: "/foo", cursor: null, pageSize: 2 },
      { type: "page", pageSize: 2, param: "page" },
      fetcher as unknown as typeof fetch,
      "key",
    );

    expect(res.rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(res.nextCursor).toBe("2");
  });

  it("retries 429 responses with retry-after before failing the page", async () => {
    const sleep = vi.fn(async () => {});
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (key: string) => (key.toLowerCase() === "retry-after" ? "2" : null) },
        text: async () => "rate limited",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: 1 }],
        text: async () => "",
      });

    const res = await fetchPage(
      {
        baseUrl: "https://api.test",
        endpoint: "/foo",
        cursor: null,
        pageSize: 100,
        retry: { maxAttempts: 2, sleep },
      },
      { type: "page", pageSize: 100, param: "page" },
      fetcher as unknown as typeof fetch,
      "key",
    );

    expect(res.rows).toEqual([{ id: 1 }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("continues explicit date-window backfills across empty windows until stop date", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    }));

    const res = await fetchPage(
      { baseUrl: "https://api.test", endpoint: "/dark", cursor: "2026-05-09", pageSize: 0 },
      { type: "date-window", param: "date", windowDays: 7, stopDate: "2026-05-01" },
      fetcher as unknown as typeof fetch,
      "key",
    );

    expect(res.nextCursor).toBe("2026-05-02");
  });

  it("preserves base URL path prefix (e.g. /beta) when endpoint starts with /", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    }));

    await fetchPage(
      {
        baseUrl: "https://api.quiverquant.com/beta",
        endpoint: "/bulk/congresstrading",
        cursor: null,
        pageSize: 0,
      },
      { type: "none" },
      fetcher as unknown as typeof fetch,
      "key"
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.quiverquant.com/beta/bulk/congresstrading",
      expect.any(Object)
    );
  });

  it("returns null cursor when page is short", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => Array.from({ length: 3 }, (_, i) => ({ id: i })),
      text: async () => "",
    }));

    const res = await fetchPage(
      { baseUrl: "https://api.test", endpoint: "/foo", cursor: "5", pageSize: 100 },
      { type: "page", pageSize: 100, param: "page" },
      fetcher as unknown as typeof fetch,
      "key"
    );

    expect(res.nextCursor).toBeNull();
  });
});

describe("runOne", () => {
  it("paginates until cursor null, dedupes by sourceHash, persists cursor", async () => {
    const pages: Array<Array<{ id: number }>> = [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 4 }, { id: 5 }],
      [],
    ];
    let pageIdx = 0;
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => pages[pageIdx++] ?? [],
      text: async () => "",
    }));

    const upserted: Array<{ id: number }> = [];
    const spec: DatasetSpec<Array<{ id: number }>, { id: number }> = {
      name: "Test",
      endpoints: { bulk: "/bulk/test", live: "/live/test" },
      pagination: { type: "page", pageSize: 3, param: "page" },
      parse: (raw) => raw,
      dedup: (r) => `t-${r.id}`,
      upsert: async (rows) => {
        upserted.push(...rows);
        return { inserted: rows.length };
      },
    };

    const job: RunOneJob = { dataset: "Test", mode: "backfill", cursor: null, totalIngested: 0 };
    const persistJob = vi.fn(async (patch: Partial<RunOneJob>) => Object.assign(job, patch));

    const result = await runOne({
      spec,
      mode: "backfill",
      job,
      persistJob,
      fetcher: fetcher as unknown as typeof fetch,
      apiKey: "key",
      baseUrl: "https://api.test",
      rateLimiter: { acquire: async () => {} },
      timeBudgetMs: 60_000,
      now: () => 0,
    });

    expect(upserted.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(result.rowsFetched).toBe(5);
    expect(result.rowsInserted).toBe(5);
    expect(job.cursor).toBeNull();
  });

  it("uses paginationLive override when mode is live", async () => {
    let callCount = 0;
    const fetcher = vi.fn(async (url: string) => {
      callCount++;
      return {
        ok: true,
        status: 200,
        url,
        json: async () => [],
        text: async () => "",
      };
    });

    const spec: DatasetSpec<Array<{ id: number }>, { id: number }> = {
      name: "Test",
      endpoints: { bulk: "/bulk/test", live: "/live/test" },
      pagination: { type: "date-window", param: "date", windowDays: 7 },
      paginationLive: { type: "none" },
      parse: (raw) => raw,
      dedup: (r) => `t-${r.id}`,
      upsert: async (rows) => ({ inserted: rows.length }),
    };

    const job: RunOneJob = { dataset: "Test", mode: "live", cursor: null, totalIngested: 0 };
    const persistJob = vi.fn(async (patch: Partial<RunOneJob>) => Object.assign(job, patch));

    await runOne({
      spec,
      mode: "live",
      job,
      persistJob,
      fetcher: fetcher as unknown as typeof fetch,
      apiKey: "k",
      baseUrl: "https://api.test",
      rateLimiter: { acquire: async () => {} },
      timeBudgetMs: 60_000,
      now: () => 0,
    });

    expect(callCount).toBe(1);
    const calledUrl = fetcher.mock.calls[0][0];
    expect(calledUrl).toBe("https://api.test/live/test");
  });

  it("respects time budget and persists cursor for resumption", async () => {
    let pageIdx = 0;

    const t = { ms: 0 };
    const fetcherWithTime = vi.fn(async () => {
      t.ms += 30_000;
      pageIdx++;
      return {
        ok: true,
        status: 200,
        json: async () => Array.from({ length: 3 }, (_, i) => ({ id: pageIdx * 3 + i })),
        text: async () => "",
      };
    });

    const spec: DatasetSpec<Array<{ id: number }>, { id: number }> = {
      name: "Test",
      endpoints: { bulk: "/bulk/test", live: "/live/test" },
      pagination: { type: "page", pageSize: 3, param: "page" },
      parse: (raw) => raw,
      dedup: (r) => `t-${r.id}`,
      upsert: async (rows) => { return { inserted: rows.length }; },
    };

    const job: RunOneJob = { dataset: "Test", mode: "backfill", cursor: null, totalIngested: 0 };
    const persistJob = vi.fn(async (patch: Partial<RunOneJob>) => Object.assign(job, patch));

    const result = await runOne({
      spec,
      mode: "backfill",
      job,
      persistJob,
      fetcher: fetcherWithTime as unknown as typeof fetch,
      apiKey: "key",
      baseUrl: "https://api.test",
      rateLimiter: { acquire: async () => {} },
      timeBudgetMs: 60_000,
      now: () => t.ms,
    });

    expect(result.timedOut).toBe(true);
    expect(job.cursor).not.toBeNull();
  });
});

describe("runAll", () => {
  it("loops every dataset, allocates per-dataset slice of total budget", async () => {
    const calls: string[] = [];
    const spec = (name: string): DatasetSpec<Array<{ id: number }>, { id: number }> => ({
      name,
      endpoints: { bulk: `/bulk/${name}`, live: `/live/${name}` },
      pagination: { type: "page", pageSize: 1, param: "page" },
      parse: (r) => r,
      dedup: (r) => `${name}-${r.id}`,
      upsert: async (rows) => {
        calls.push(`upsert:${name}:${rows.length}`);
        return { inserted: rows.length };
      },
    });

    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    }));

    const result = await runAll({
      specs: [spec("A"), spec("B"), spec("C")] as unknown as DatasetSpec<unknown, unknown>[],
      mode: "live",
      readJob: async (name) => ({ dataset: name, mode: "live", cursor: null, totalIngested: 0 }),
      writeJob: async () => {},
      fetcher: fetcher as unknown as typeof fetch,
      apiKey: "k",
      baseUrl: "https://api.test",
      ratePerMinute: 60,
      totalBudgetMs: 30_000,
      perDatasetBudgetMs: 10_000,
      now: () => 0,
    });

    expect(result.length).toBe(3);
    expect(result.map((r) => r.dataset)).toEqual(["A", "B", "C"]);
  });

  it("runs datasets with a stored lastError before clean ones (priority rotation)", async () => {
    const spec = (name: string): DatasetSpec<Array<{ id: number }>, { id: number }> => ({
      name,
      endpoints: { bulk: `/bulk/${name}`, live: `/live/${name}` },
      pagination: { type: "page", pageSize: 1, param: "page" },
      parse: (r) => r,
      dedup: (r) => `${name}-${r.id}`,
      upsert: async () => ({ inserted: 0 }),
    });

    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    }));

    // Registry order is A, B, C, D. B and D have a stored lastError. They
    // should run first in that order (preserving registry order among errored
    // datasets), followed by A and C in registry order.
    const errored = new Set(["B", "D"]);
    const result = await runAll({
      specs: [spec("A"), spec("B"), spec("C"), spec("D")] as unknown as DatasetSpec<
        unknown,
        unknown
      >[],
      mode: "live",
      readJob: async (name) => ({
        dataset: name,
        mode: "live",
        cursor: null,
        totalIngested: 0,
        lastError: errored.has(name) ? "TypeError: fetch failed" : null,
      }),
      writeJob: async () => {},
      fetcher: fetcher as unknown as typeof fetch,
      apiKey: "k",
      baseUrl: "https://api.test",
      ratePerMinute: 60,
      totalBudgetMs: 30_000,
      perDatasetBudgetMs: 10_000,
      now: () => 0,
    });

    expect(result.map((r) => r.dataset)).toEqual(["B", "D", "A", "C"]);
  });

  it("starvation (total budget exhausted) still places the dataset in results without clearing lastError state", async () => {
    const spec = (name: string): DatasetSpec<Array<{ id: number }>, { id: number }> => ({
      name,
      endpoints: { bulk: `/bulk/${name}`, live: `/live/${name}` },
      pagination: { type: "page", pageSize: 1, param: "page" },
      parse: (r) => r,
      dedup: (r) => `${name}-${r.id}`,
      upsert: async () => ({ inserted: 0 }),
    });

    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    }));

    const writes: Array<{ name: string; patch: unknown }> = [];
    // Simulate budget already exhausted by setting now()=Infinity after start.
    let tick = 0;
    const result = await runAll({
      specs: [spec("A"), spec("B")] as unknown as DatasetSpec<unknown, unknown>[],
      mode: "live",
      readJob: async (name) => ({ dataset: name, mode: "live", cursor: null, totalIngested: 0 }),
      writeJob: async (name, patch) => {
        writes.push({ name, patch });
      },
      fetcher: fetcher as unknown as typeof fetch,
      apiKey: "k",
      baseUrl: "https://api.test",
      ratePerMinute: 60,
      totalBudgetMs: 1, // immediate budget exhaustion after the first tick
      perDatasetBudgetMs: 1,
      now: () => {
        tick += 1;
        return tick === 1 ? 0 : 1_000_000;
      },
    });

    expect(result.length).toBe(2);
    expect(result.every((r) => r.timedOut)).toBe(true);
    // Critical: starved datasets must NOT have writeJob called (which would
    // otherwise clobber the stored lastError).
    expect(writes).toEqual([]);
  });
});
