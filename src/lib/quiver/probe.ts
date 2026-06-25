import type { DatasetSpec, PaginationStrategy } from "@/lib/ingest/types";

export type ProbeMode = "bulk" | "live";
export type ProbeColor = "green" | "yellow" | "red";
export type ProbeAccess =
  | "ok"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "http-error"
  | "network-error"
  | "not-implemented";
export type ProbeEnvelopeShape =
  | "array"
  | "data-array"
  | "results-array"
  | "object"
  | "null"
  | "primitive"
  | "invalid-json";
export type ProbeParserStatus = "ok" | "failed" | "skipped";

export type NormalizedQuiverResponse = {
  envelopeShape: ProbeEnvelopeShape;
  rows: unknown[];
  warnings: string[];
};

export type ProbeEndpointInput = {
  spec: DatasetSpec<unknown, unknown>;
  mode: ProbeMode;
  baseUrl: string;
  apiKey: string;
  fetcher?: typeof fetch;
  now?: () => Date;
};

export type ProbeEndpointResult = {
  dataset: string;
  mode: ProbeMode;
  endpoint: string | null;
  url: string | null;
  status: number | null;
  access: ProbeAccess;
  color: ProbeColor;
  envelopeShape: ProbeEnvelopeShape | null;
  rowCount: number;
  sampleFields: string[];
  parser: ProbeParserStatus;
  parserError?: string;
  pagination: string;
  warnings: string[];
  bodyExcerpt?: string;
};

export type DatasetCoverageSummary = {
  implemented: string[];
  missing: string[];
};

const PUBLIC_DATASET_COVERAGE: Array<{
  label: string;
  specNames: string[];
}> = [
  { label: "Senate Trading", specNames: ["SenateTrade", "CongressTrade"] },
  { label: "House Trading", specNames: ["HouseTrade", "CongressTrade"] },
  { label: "Insider Trading", specNames: ["InsiderTrade"] },
  { label: "Politician Net Worth", specNames: [] },
  { label: "Government Contracts", specNames: ["GovContract"] },
  { label: "Corporate Lobbying", specNames: ["LobbyingDisclosure"] },
  { label: "Corporate Donors", specNames: [] },
  { label: "Corporate Patents", specNames: ["Patent"] },
  { label: "Executive Compensation", specNames: [] },
  { label: "Hedge Fund Activity", specNames: ["ThirteenFHolding"] },
  { label: "ETF Holdings", specNames: [] },
  { label: "Top Shareholders", specNames: [] },
  { label: "Quiver Newsfeed", specNames: [] },
  { label: "Off-Exchange Trading", specNames: ["OffExchangeActivity"] },
  { label: "App Ratings", specNames: [] },
];

export function normalizeQuiverResponse(raw: unknown): NormalizedQuiverResponse {
  if (Array.isArray(raw)) {
    return { envelopeShape: "array", rows: raw, warnings: [] };
  }

  if (raw === null) {
    return { envelopeShape: "null", rows: [], warnings: ["Response was null."] };
  }

  if (typeof raw !== "object") {
    return {
      envelopeShape: "primitive",
      rows: [],
      warnings: ["Response was not an object or array."],
    };
  }

  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.data)) {
    return { envelopeShape: "data-array", rows: record.data, warnings: [] };
  }
  if (Array.isArray(record.results)) {
    return { envelopeShape: "results-array", rows: record.results, warnings: [] };
  }

  return {
    envelopeShape: "object",
    rows: [],
    warnings: ["Response was an object without a data array."],
  };
}

export function buildProbeUrl(input: {
  baseUrl: string;
  endpoint: string;
  pagination: PaginationStrategy;
  cursor?: string | null;
  now?: () => Date;
}) {
  const url = new URL(input.baseUrl.replace(/\/$/, "") + input.endpoint);
  const cursor = input.cursor ?? null;

  switch (input.pagination.type) {
    case "none":
      break;
    case "page":
      url.searchParams.set(input.pagination.param, cursor ?? "1");
      url.searchParams.set("page_size", String(Math.min(input.pagination.pageSize, 5)));
      break;
    case "offset":
      url.searchParams.set(input.pagination.offsetParam, cursor ?? "0");
      url.searchParams.set("page_size", String(Math.min(input.pagination.pageSize, 5)));
      break;
    case "date-window": {
      const date = cursor ?? (input.now?.() ?? new Date()).toISOString().slice(0, 10);
      url.searchParams.set(input.pagination.param, date);
      break;
    }
    case "cursor":
      if (cursor) url.searchParams.set(input.pagination.param, cursor);
      break;
  }

  return url.toString();
}

export async function probeEndpoint(input: ProbeEndpointInput): Promise<ProbeEndpointResult> {
  const endpoint = input.mode === "bulk" ? input.spec.endpoints.bulk : input.spec.endpoints.live;
  const pagination =
    input.mode === "live" && input.spec.paginationLive
      ? input.spec.paginationLive
      : input.spec.pagination;

  if (!endpoint) {
    return {
      dataset: input.spec.name,
      mode: input.mode,
      endpoint: null,
      url: null,
      status: null,
      access: "not-implemented",
      color: "yellow",
      envelopeShape: null,
      rowCount: 0,
      sampleFields: [],
      parser: "skipped",
      pagination: paginationLabel(pagination),
      warnings: [`${input.mode} endpoint is not implemented for this dataset.`],
    };
  }

  const url = buildProbeUrl({
    baseUrl: input.baseUrl,
    endpoint,
    pagination,
    now: input.now,
  });

  try {
    const response = await (input.fetcher ?? fetch)(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      return {
        dataset: input.spec.name,
        mode: input.mode,
        endpoint,
        url,
        status: response.status,
        access: accessFromStatus(response.status),
        color: "red",
        envelopeShape: body.envelopeShape,
        rowCount: body.rows.length,
        sampleFields: sampleFields(body.rows),
        parser: "skipped",
        pagination: paginationLabel(pagination),
        warnings: body.warnings,
        bodyExcerpt: body.excerpt,
      };
    }

    const parserResult = runParser(input.spec, body.rows);
    const warnings = [...body.warnings];
    if (body.rows.length === 0) {
      warnings.push("Response returned zero rows; verify with another page or date if expected.");
    }
    if (body.envelopeShape !== "array") {
      warnings.push(`Response envelope is ${body.envelopeShape}; ingest currently assumes raw arrays.`);
    }

    return {
      dataset: input.spec.name,
      mode: input.mode,
      endpoint,
      url,
      status: response.status,
      access: "ok",
      color: colorForSuccessfulProbe(body, parserResult.parser),
      envelopeShape: body.envelopeShape,
      rowCount: body.rows.length,
      sampleFields: sampleFields(body.rows),
      parser: parserResult.parser,
      parserError: parserResult.parserError,
      pagination: paginationLabel(pagination),
      warnings,
      bodyExcerpt: body.excerpt,
    };
  } catch (error) {
    return {
      dataset: input.spec.name,
      mode: input.mode,
      endpoint,
      url,
      status: null,
      access: "network-error",
      color: "red",
      envelopeShape: null,
      rowCount: 0,
      sampleFields: [],
      parser: "skipped",
      pagination: paginationLabel(pagination),
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function summarizeDatasetCoverage(implementedSpecNames: string[]): DatasetCoverageSummary {
  const implemented = [...implementedSpecNames].sort();
  const missing = PUBLIC_DATASET_COVERAGE.filter(
    (dataset) => !dataset.specNames.some((name) => implementedSpecNames.includes(name)),
  ).map((dataset) => dataset.label);

  return { implemented, missing };
}

async function readResponseBody(response: Response): Promise<
  NormalizedQuiverResponse & {
    excerpt: string;
  }
> {
  const text = await response.text();
  const excerpt = text.slice(0, 500);

  if (!text.trim()) {
    return {
      envelopeShape: "null",
      rows: [],
      warnings: ["Response body was empty."],
      excerpt,
    };
  }

  try {
    return {
      ...normalizeQuiverResponse(JSON.parse(text)),
      excerpt,
    };
  } catch {
    return {
      envelopeShape: "invalid-json",
      rows: [],
      warnings: ["Response body was not valid JSON."],
      excerpt,
    };
  }
}

function runParser(
  spec: DatasetSpec<unknown, unknown>,
  rows: unknown[],
): {
  parser: ProbeParserStatus;
  parserError?: string;
} {
  try {
    const parsed = spec.parse(rows);
    return Array.isArray(parsed)
      ? { parser: "ok" }
      : { parser: "failed", parserError: "Parser did not return an array." };
  } catch (error) {
    return {
      parser: "failed",
      parserError: error instanceof Error ? error.message : String(error),
    };
  }
}

function sampleFields(rows: unknown[]) {
  const keys = new Set<string>();

  for (const row of rows.slice(0, 3)) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      for (const key of Object.keys(row)) keys.add(key);
    }
  }

  return [...keys].sort();
}

function colorForSuccessfulProbe(
  body: NormalizedQuiverResponse,
  parser: ProbeParserStatus,
): ProbeColor {
  if (parser === "failed") return "yellow";
  if (body.envelopeShape !== "array") return "yellow";
  if (body.rows.length === 0) return "yellow";
  if (body.warnings.length > 0) return "yellow";
  return "green";
}

function accessFromStatus(status: number): ProbeAccess {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return "http-error";
}

function paginationLabel(pagination: PaginationStrategy) {
  switch (pagination.type) {
    case "none":
      return "none";
    case "page":
      return `page:${pagination.param}`;
    case "offset":
      return `offset:${pagination.offsetParam}`;
    case "date-window":
      return `date-window:${pagination.param}:${pagination.windowDays}d`;
    case "cursor":
      return `cursor:${pagination.param}`;
  }
}
