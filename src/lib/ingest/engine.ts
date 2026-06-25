import type {
  DatasetSpec,
  FetchPageInput,
  FetchPageResult,
  IngestMode,
  PaginationStrategy,
} from "./types";
import { createRateLimiter, type RateLimiter } from "./rateLimit";

type Fetcher = typeof fetch;

export async function fetchPage<TRaw = unknown>(
  input: FetchPageInput,
  pagination: PaginationStrategy,
  fetcher: Fetcher,
  apiKey: string
): Promise<FetchPageResult<TRaw>> {
  const url = buildUrl(input, pagination);
  const maxAttempts = input.retry?.maxAttempts ?? 3;
  let res: Response | Awaited<ReturnType<Fetcher>>;

  for (let attempt = 1; ; attempt++) {
    res = await fetcher(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    // Retry on 429 (rate limit) and 5xx (server-side transient).
    const transient = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!transient || attempt >= maxAttempts) break;

    await sleepForRetry(res, attempt, input.retry);
  }

  if (!res.ok) throw new Error(`Quiver ${res.status}: ${await res.text()}`);
  const rows = normalizeQuiverRows(await res.json()) as TRaw;
  const nextCursor = computeNextCursor(input, pagination, rows);
  return { rows, nextCursor };
}

export function normalizeQuiverRows(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return raw;
}

async function sleepForRetry(
  res: Response | Awaited<ReturnType<Fetcher>>,
  attempt: number,
  retry: FetchPageInput["retry"],
) {
  const sleep = retry?.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const retryAfterHeader = getHeader(res, "retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  const delay =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
      ? retryAfterSeconds * 1_000
      : (retry?.baseDelayMs ?? 1_000) * 2 ** (attempt - 1);

  await sleep(delay);
}

function getHeader(res: Response | Awaited<ReturnType<Fetcher>>, key: string) {
  const headers = (res as { headers?: { get?: (name: string) => string | null } }).headers;
  return headers?.get?.(key) ?? null;
}

function buildUrl(input: FetchPageInput, p: PaginationStrategy): string {
  const u = new URL(input.baseUrl + input.endpoint);
  switch (p.type) {
    case "none":
      return u.toString();
    case "page": {
      const page = input.cursor ? Number(input.cursor) : 1;
      u.searchParams.set(p.param, String(page));
      if (input.pageSize > 0) u.searchParams.set("page_size", String(input.pageSize));
      return u.toString();
    }
    case "offset": {
      const off = input.cursor ? Number(input.cursor) : 0;
      u.searchParams.set(p.offsetParam, String(off));
      return u.toString();
    }
    case "date-window": {
      const date = input.cursor ?? new Date().toISOString().slice(0, 10);
      u.searchParams.set(p.param, date);
      return u.toString();
    }
    case "cursor": {
      if (input.cursor) u.searchParams.set(p.param, input.cursor);
      return u.toString();
    }
  }
}

function computeNextCursor(
  input: FetchPageInput,
  p: PaginationStrategy,
  rows: unknown
): string | null {
  const len = Array.isArray(rows) ? rows.length : 0;
  switch (p.type) {
    case "none":
      return null;
    case "page": {
      if (len < p.pageSize) return null;
      const cur = input.cursor ? Number(input.cursor) : 1;
      return String(cur + 1);
    }
    case "offset": {
      if (len < p.pageSize) return null;
      const cur = input.cursor ? Number(input.cursor) : 0;
      return String(cur + p.pageSize);
    }
    case "date-window": {
      const cur = input.cursor ? new Date(input.cursor) : new Date();
      cur.setUTCDate(cur.getUTCDate() - p.windowDays);
      const next = cur.toISOString().slice(0, 10);
      if (p.stopDate && next >= p.stopDate) return next;
      if (len === 0) return null;
      return p.stopDate && next < p.stopDate ? null : next;
    }
    case "cursor":
      return null;
  }
}

export type RunOneJob = {
  dataset: string;
  mode: IngestMode;
  cursor: string | null;
  totalIngested: number;
  lastError?: string | null;
  // "active" = in-flight or partial; "complete" = converged backfill or
  // up-to-date live; "error" = last run threw. Written by runAll on each
  // branch so the Data Health dashboard can distinguish stuck vs broken jobs.
  status?: string | null;
};

export type RunOneInput<TRaw, TRow> = {
  spec: DatasetSpec<TRaw, TRow>;
  mode: IngestMode;
  job: RunOneJob;
  persistJob: (patch: Partial<RunOneJob>) => Promise<RunOneJob>;
  fetcher: typeof fetch;
  apiKey: string;
  baseUrl: string;
  rateLimiter: RateLimiter;
  timeBudgetMs: number;
  now: () => number;
};

export type RunOneResult = {
  rowsFetched: number;
  rowsInserted: number;
  timedOut: boolean;
  completed: boolean;
};

export async function runOne<TRaw, TRow>(
  input: RunOneInput<TRaw, TRow>
): Promise<RunOneResult> {
  const { spec, mode, job, persistJob, fetcher, apiKey, baseUrl, rateLimiter, timeBudgetMs, now } = input;

  const endpoint = mode === "backfill" ? spec.endpoints.bulk : spec.endpoints.live;
  if (!endpoint) {
    return { rowsFetched: 0, rowsInserted: 0, timedOut: false, completed: true };
  }

  const pagination =
    mode === "live" && spec.paginationLive ? spec.paginationLive : spec.pagination;

  const startMs = now();
  let cursor = job.cursor;
  let rowsFetched = 0;
  let rowsInserted = 0;

  for (;;) {
    if (now() - startMs >= timeBudgetMs) {
      await persistJob({ cursor });
      return { rowsFetched, rowsInserted, timedOut: true, completed: false };
    }

    await rateLimiter.acquire();

    const page = await fetchPage<TRaw>(
      { baseUrl, endpoint, cursor, pageSize: pageSizeOf(pagination) },
      pagination,
      fetcher,
      apiKey
    );

    const parsed = spec.parse(page.rows);
    rowsFetched += parsed.length;

    if (parsed.length > 0) {
      const { inserted } = await spec.upsert(parsed);
      rowsInserted += inserted;
    }

    // Short-circuit: if we retrieved a batch of raw rows but ALL of them were 
    // filtered out by `parse()` (e.g. because they are older than the cutoff date),
    // we can safely stop paginating rather than scanning the entire database.
    const rawLen = rawRowCount(page.rows);

    if (mode === "live" && rawLen > 0 && parsed.length === 0) {
      cursor = null;
    } else {
      cursor = page.nextCursor;
    }

    await persistJob({ cursor, totalIngested: job.totalIngested + rowsInserted });

    if (cursor === null) {
      return { rowsFetched, rowsInserted, timedOut: false, completed: true };
    }
  }
}

function pageSizeOf(p: PaginationStrategy): number {
  switch (p.type) {
    case "page":
      return p.pageSize;
    case "offset":
      return p.pageSize;
    default:
      return 0;
  }
}

function rawRowCount(rows: unknown): number {
  return Array.isArray(rows) ? rows.length : 0;
}

export type RunAllInput = {
  specs: DatasetSpec<unknown, unknown>[];
  mode: IngestMode;
  readJob: (dataset: string) => Promise<RunOneJob>;
  writeJob: (dataset: string, patch: Partial<RunOneJob>) => Promise<void>;
  fetcher: typeof fetch;
  apiKey: string;
  baseUrl: string;
  ratePerMinute: number;
  totalBudgetMs: number;
  perDatasetBudgetMs: number;
  now?: () => number;
};

export type RunAllPerDatasetResult = {
  dataset: string;
  rowsFetched: number;
  rowsInserted: number;
  timedOut: boolean;
  completed: boolean;
  error?: string;
};

export async function runAll(input: RunAllInput): Promise<RunAllPerDatasetResult[]> {
  const now = input.now ?? (() => Date.now());
  const rateLimiter = createRateLimiter({ ratePerMinute: input.ratePerMinute });
  const start = now();
  const results: RunAllPerDatasetResult[] = [];

  // Pre-pass: read every dataset's persisted job state, then sort specs so
  // datasets with a stored `lastError` (i.e. failed on a previous run) run
  // FIRST. Without this, datasets at the tail of the registry can get starved
  // every run by the total-budget cap and their errors never get retried.
  // Datasets that failed to read (readJob threw) are kept in registry order
  // and surfaced as errored results so the caller can see them.
  type Prepared = {
    spec: DatasetSpec<unknown, unknown>;
    registryIndex: number;
    job: RunOneJob | null;
    readError: string | null;
  };
  const prepared: Prepared[] = await Promise.all(
    input.specs.map(async (spec, registryIndex) => {
      try {
        const job = await input.readJob(spec.name);
        return { spec, registryIndex, job, readError: null };
      } catch (e) {
        return { spec, registryIndex, job: null, readError: String(e) };
      }
    }),
  );
  prepared.sort((a, b) => {
    const aErr = (a.job?.lastError ?? null) != null;
    const bErr = (b.job?.lastError ?? null) != null;
    if (aErr && !bErr) return -1;
    if (!aErr && bErr) return 1;
    return a.registryIndex - b.registryIndex;
  });

  for (const { spec, job: cachedJob, readError } of prepared) {
    const elapsed = now() - start;
    const remaining = input.totalBudgetMs - elapsed;
    if (remaining <= 0) {
      results.push({
        dataset: spec.name,
        rowsFetched: 0,
        rowsInserted: 0,
        timedOut: true,
        completed: false,
      });
      continue;
    }
    const slice = Math.min(input.perDatasetBudgetMs, remaining);

    if (readError != null) {
      results.push({
        dataset: spec.name,
        rowsFetched: 0,
        rowsInserted: 0,
        timedOut: false,
        completed: false,
        error: readError,
      });
      continue;
    }
    // cachedJob is non-null when readError is null.
    const job = cachedJob as RunOneJob;

    if (input.mode === "live" && job.mode === "backfill") {
      results.push({
        dataset: spec.name,
        rowsFetched: 0,
        rowsInserted: 0,
        timedOut: false,
        completed: false,
      });
      continue;
    }

    try {
      const r = await runOne({
        spec,
        mode: input.mode,
        job,
        persistJob: async (patch) => {
          await input.writeJob(spec.name, patch);
          return { ...job, ...patch };
        },
        fetcher: input.fetcher,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
        rateLimiter,
        timeBudgetMs: slice,
        now,
      });

      if (input.mode === "backfill" && r.completed) {
        await input.writeJob(spec.name, {
          mode: "live",
          cursor: null,
          lastError: null,
          status: "complete",
        });
      } else {
        await input.writeJob(spec.name, {
          lastError: null,
          status: r.completed ? "complete" : "active",
        });
      }

      results.push({ dataset: spec.name, ...r });
    } catch (e) {
      const err = String(e);
      await input.writeJob(spec.name, { lastError: err, status: "error" });
      results.push({
        dataset: spec.name,
        rowsFetched: 0,
        rowsInserted: 0,
        timedOut: false,
        completed: false,
        error: err,
      });
    }
  }

  return results;
}
