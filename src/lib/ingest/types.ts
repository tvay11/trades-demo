export type IngestMode = "backfill" | "live";

export type PaginationStrategy =
  | { type: "none" }
  | { type: "page"; pageSize: number; param: string }
  | { type: "offset"; pageSize: number; offsetParam: string }
  | { type: "date-window"; param: string; windowDays: number; stopDate?: string }
  | { type: "cursor"; param: string };

export type FetchPageInput = {
  baseUrl: string;
  endpoint: string;
  cursor: string | null;
  pageSize: number;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  };
};

export type FetchPageResult<TRaw> = {
  rows: TRaw;
  nextCursor: string | null;
};

export type DatasetSpec<TRaw, TRow> = {
  name: string;
  endpoints: {
    bulk?: string;
    live?: string;
  };
  pagination: PaginationStrategy;
  paginationLive?: PaginationStrategy;
  parse: (raw: TRaw) => TRow[];
  dedup: (row: TRow) => string;
  upsert: (rows: TRow[]) => Promise<{ inserted: number }>;
};
