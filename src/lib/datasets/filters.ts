import type {
  DatasetDefaultSort,
  DatasetDefinition,
  DatasetFilterDefinition,
  DatasetSortDirection,
} from "./registry";

type RawSearchParams = Record<string, string | string[] | undefined>;

export type NormalizedFilterValue =
  | { kind: "text"; value: string }
  | { kind: "enum"; value: string }
  | { kind: "date-range"; from?: Date; to?: Date }
  | { kind: "number-range"; min?: number; max?: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "presence"; state: "empty" | "filled" };

export type NormalizedDatasetQuery = {
  page: number;
  search: string;
  sort: DatasetDefaultSort;
  filters: Record<string, NormalizedFilterValue>;
};

export type ActiveDatasetFilterChip = {
  key: string;
  label: string;
  value: string;
  href: string;
};

export function parseDatasetQuery(
  definition: DatasetDefinition,
  raw: RawSearchParams,
): NormalizedDatasetQuery {
  const search = getString(raw.q).trim();
  const page = normalizePage(raw.page);
  const sort = normalizeSort(definition, raw.sort, raw.dir);
  const filters: Record<string, NormalizedFilterValue> = {};

  for (const filter of definition.filters) {
    const value = parseFilterValue(filter, raw);
    if (value) filters[filter.key] = value;
  }

  return { page, search, sort, filters };
}

export function buildDatasetWhere(
  definition: DatasetDefinition,
  query: NormalizedDatasetQuery,
) {
  const clauses: Record<string, unknown>[] = [];

  if (query.search) {
    clauses.push({
      OR: definition.searchableColumns.map((key) => ({
        [key]: { contains: query.search },
      })),
    });
  }

  for (const definitionFilter of definition.filters) {
    if (definitionFilter.virtual) continue;

    const key = definitionFilter.key;
    const filter = query.filters[key];
    if (!filter) continue;

    switch (filter.kind) {
      case "text":
        clauses.push({ [key]: { contains: filter.value } });
        break;
      case "enum":
        if (key === "transactionType" && filter.value === "Sale") {
          clauses.push({
            OR: [{ [key]: "Sale" }, { [key]: "Sale (Full)" }],
          });
        } else {
          clauses.push({ [key]: filter.value });
        }
        break;
      case "date-range": {
        const range: Record<string, Date> = {};
        if (filter.from) range.gte = filter.from;
        if (filter.to) range.lte = filter.to;
        if (Object.keys(range).length > 0) clauses.push({ [key]: range });
        break;
      }
      case "number-range": {
        const range: Record<string, number> = {};
        if (filter.min !== undefined) range.gte = filter.min;
        if (filter.max !== undefined) range.lte = filter.max;
        if (Object.keys(range).length > 0) clauses.push({ [key]: range });
        break;
      }
      case "boolean":
        clauses.push({ [key]: filter.value });
        break;
      case "presence":
        clauses.push({ [key]: filter.state === "empty" ? null : { not: null } });
        break;
    }
  }

  return clauses.length === 0 ? {} : { AND: clauses };
}

export function buildDatasetOrderBy(
  _definition: DatasetDefinition,
  query: NormalizedDatasetQuery,
) {
  return { [query.sort.key]: query.sort.dir };
}

export function buildDatasetHref(
  basePath: string,
  query: NormalizedDatasetQuery,
  overrides?: { page?: number },
) {
  const params = new URLSearchParams();

  if (query.search) params.set("q", query.search);
  params.set("sort", query.sort.key);
  params.set("dir", query.sort.dir);

  for (const [key, filter] of Object.entries(query.filters)) {
    appendFilterParam(params, key, filter);
  }

  const page = overrides?.page ?? query.page;
  if (page > 1) params.set("page", String(page));

  const serialized = params.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function summarizeActiveFilters(
  basePath: string,
  definition: DatasetDefinition,
  query: NormalizedDatasetQuery,
): ActiveDatasetFilterChip[] {
  const chips: ActiveDatasetFilterChip[] = [];

  if (query.search) {
    chips.push({
      key: "search",
      label: "Search",
      value: query.search,
      href: buildDatasetHref(
        basePath,
        {
          ...query,
          page: 1,
          search: "",
        },
        { page: 1 },
      ),
    });
  }

  for (const filter of definition.filters) {
    const active = query.filters[filter.key];
    if (!active) continue;

    const remainingFilters = { ...query.filters };
    delete remainingFilters[filter.key];

    chips.push({
      key: filter.key,
      label: filter.label,
      value: formatChipValue(filter, active),
      href: buildDatasetHref(
        basePath,
        {
          ...query,
          page: 1,
          filters: remainingFilters,
        },
        { page: 1 },
      ),
    });
  }

  return chips;
}

function normalizePage(value: string | string[] | undefined) {
  const page = Number.parseInt(getString(value) || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeSort(
  definition: DatasetDefinition,
  rawSort: string | string[] | undefined,
  rawDir: string | string[] | undefined,
) {
  const sortKey = getString(rawSort);
  const validSort =
    definition.columns.some((column) => column.key === sortKey) ||
    definition.filters.some((filter) => filter.key === sortKey);
  const dir = getString(rawDir) as DatasetSortDirection;
  const validDir = dir === "asc" || dir === "desc";

  if (!validSort) return definition.defaultSort;

  return {
    key: sortKey,
    dir: validDir ? dir : definition.defaultSort.dir,
  };
}

function parseFilterValue(
  filter: DatasetFilterDefinition,
  raw: RawSearchParams,
): NormalizedFilterValue | null {
  switch (filter.kind) {
    case "text": {
      const value = getString(raw[`f_${filter.key}`]).trim();
      return value ? { kind: "text", value } : null;
    }
    case "enum": {
      const value = getString(raw[`f_${filter.key}`]).trim();
      const isAllowed = filter.options?.some((option) => option.value === value);
      return value && isAllowed ? { kind: "enum", value } : null;
    }
    case "date-range": {
      const from = toValidDate(getString(raw[`f_${filter.key}_from`]));
      const to = toValidDate(getString(raw[`f_${filter.key}_to`]));
      return from || to ? { kind: "date-range", ...(from ? { from } : {}), ...(to ? { to } : {}) } : null;
    }
    case "number-range": {
      const min = toValidNumber(getString(raw[`f_${filter.key}_min`]));
      const max = toValidNumber(getString(raw[`f_${filter.key}_max`]));
      return min !== undefined || max !== undefined
        ? {
            kind: "number-range",
            ...(min !== undefined ? { min } : {}),
            ...(max !== undefined ? { max } : {}),
          }
        : null;
    }
    case "boolean": {
      const value = getString(raw[`f_${filter.key}`]).trim();
      if (value === "true") return { kind: "boolean", value: true };
      if (value === "false") return { kind: "boolean", value: false };
      return null;
    }
    case "presence": {
      const value = getString(raw[`f_${filter.key}_state`]).trim();
      return value === "empty" || value === "filled"
        ? { kind: "presence", state: value }
        : null;
    }
  }
}

function appendFilterParam(
  params: URLSearchParams,
  key: string,
  filter: NormalizedFilterValue,
) {
  switch (filter.kind) {
    case "text":
    case "enum":
      params.set(`f_${key}`, filter.value);
      break;
    case "date-range":
      if (filter.from) params.set(`f_${key}_from`, formatDateValue(filter.from));
      if (filter.to) params.set(`f_${key}_to`, formatDateValue(filter.to));
      break;
    case "number-range":
      if (filter.min !== undefined) params.set(`f_${key}_min`, String(filter.min));
      if (filter.max !== undefined) params.set(`f_${key}_max`, String(filter.max));
      break;
    case "boolean":
      params.set(`f_${key}`, String(filter.value));
      break;
    case "presence":
      params.set(`f_${key}_state`, filter.state);
      break;
  }
}

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function toValidDate(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toValidNumber(value: string) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function formatDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatChipValue(
  definition: DatasetFilterDefinition,
  filter: NormalizedFilterValue,
) {
  switch (filter.kind) {
    case "text":
      return filter.value;
    case "enum":
      return definition.options?.find((option) => option.value === filter.value)?.label ?? filter.value;
    case "date-range":
      return formatRangeValue(
        filter.from ? formatDateValue(filter.from) : undefined,
        filter.to ? formatDateValue(filter.to) : undefined,
      );
    case "number-range":
      return formatRangeValue(
        filter.min !== undefined ? formatNumberBound(filter.min, "min") : undefined,
        filter.max !== undefined ? formatNumberBound(filter.max, "max") : undefined,
      );
    case "boolean":
      return filter.value ? "Yes" : "No";
    case "presence":
      return filter.state === "filled" ? "Present" : "Empty";
  }
}

function formatRangeValue(from?: string, to?: string) {
  if (from && to) return `${from} to ${to}`;
  if (from) return from;
  return to ?? "";
}

function formatNumberBound(value: number, kind: "min" | "max") {
  const formatted = new Intl.NumberFormat("en-US").format(value);
  return kind === "min" ? `>= ${formatted}` : `<= ${formatted}`;
}
