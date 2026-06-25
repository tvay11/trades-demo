import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  type DatasetColumn,
  type DatasetDefinition,
  type DatasetRow,
  formatDatasetValue,
} from "@/lib/datasets/registry";
import { buildDatasetHref, type NormalizedDatasetQuery } from "@/lib/datasets/filters";
import { cn } from "@/lib/utils";

export function DatasetTable({
  definition,
  rows,
  hasActiveFilters = false,
  basePath,
  query,
}: {
  definition: DatasetDefinition;
  rows: DatasetRow[];
  hasActiveFilters?: boolean;
  basePath?: string;
  query?: NormalizedDatasetQuery;
}) {
  if (rows.length === 0) {
    return (
      <div className="ledger-empty relative overflow-hidden p-10">
        <div className="ledger-stamp relative mx-auto flex size-12 items-center justify-center border-sky-900/40 bg-sky-950/20 font-mono text-sm text-sky-400">
          SQL
        </div>
        <h2 className="relative mt-4 text-sm font-semibold">
          {hasActiveFilters ? "No rows match these filters" : "No rows found"}
        </h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Relax one or more trader screens to bring matching records back into view."
            : "This table exists in the schema, but the connected database does not have visible rows here yet."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div data-testid="dataset-table-shell" className="qq-table-shell hidden md:block">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="ledger-section-line sticky top-0 z-10">
              <tr>
                {definition.columns.map((column) => {
                  const isSortable = basePath && query;
                  const isActive = query?.sort.key === column.key;
                  const activeDir = isActive ? query.sort.dir : null;
                  const nextDir = isActive && activeDir === "asc" ? "desc" : isActive && activeDir === "desc" ? "asc" : defaultSortDir(column);

                  if (!isSortable) {
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        className="px-3 py-2.5 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
                      >
                        {column.label}
                      </th>
                    );
                  }

                  const sortHref = buildDatasetHref(basePath, {
                    ...query,
                    sort: { key: column.key, dir: nextDir },
                  }, { page: 1 });

                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className="px-0 py-0 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.15em]"
                    >
                      <Link
                        href={sortHref}
                        scroll={false}
                        className={cn(
                          "group flex items-center gap-1.5 px-3 py-2.5 transition-colors",
                          isActive
                            ? "text-sky-400"
                            : "text-zinc-500 hover:text-zinc-200",
                        )}
                      >
                        {column.label}
                        {isActive ? (
                          activeDir === "asc" ? (
                            <ArrowUp className="size-3 shrink-0" />
                          ) : (
                            <ArrowDown className="size-3 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
                        )}
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowKey(definition.slug, row, rowIndex)}
                  className="border-b border-zinc-800/80 transition-colors hover:bg-zinc-900/45"
                >
                  {definition.columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "max-w-[320px] px-3 py-2 align-middle text-xs text-zinc-300",
                        dataCellClass(column),
                      )}
                    >
                      <DatasetCell column={column} row={row} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row, rowIndex) => (
          <article
            key={rowKey(definition.slug, row, rowIndex)}
            className="ledger-callout p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-mono text-xs uppercase tracking-[0.16em] text-sky-400">
                {definition.tableName}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                #{rowIndex + 1}
              </div>
            </div>
            <dl className="grid gap-2">
              {definition.columns.map((column) => (
                <div key={column.key} className="grid grid-cols-[110px_1fr] gap-3">
                  <dt className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {column.label}
                  </dt>
                  <dd className={cn("min-w-0 text-sm", dataCellClass(column))}>
                    <DatasetCell column={column} row={row} />
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function DatasetCell({
  column,
  row,
}: {
  column: DatasetColumn;
  row: DatasetRow;
}) {
  const value = row[column.key];
  if (column.kind === "ticker" && typeof value === "string" && value.trim()) {
    const ticker = value.trim().toUpperCase();

    return (
      <Link
        href={`/analysis/stocks/${encodeURIComponent(ticker)}`}
        className="font-mono text-xs font-bold text-sky-400 transition hover:text-sky-300"
      >
        {formatDatasetValue(ticker, column)}
      </Link>
    );
  }

  if (column.kind === "politician" && typeof value === "string" && value.trim()) {
    const politicianId = row.politicianId ?? (column.key === "id" ? value : row.id);

    if (politicianId) {
      return (
        <Link
          href={`/politicians/${politicianId}`}
          className="font-medium text-sky-400 transition hover:text-sky-300"
        >
          {String(value)}
        </Link>
      );
    }
  }

  if (column.kind === "official" && typeof value === "string" && value.trim()) {
    // For executive-trades the official's name lives on the flattened row
    // alongside `officialId`. For executive-officials the row's own `id` is
    // the official id. Fall back to `id` so both surfaces link correctly.
    const officialId = row.officialId ?? row.id;

    if (officialId != null) {
      return (
        <Link
          href={`/officials/${officialId}`}
          className="font-medium text-sky-400 transition hover:text-sky-300"
        >
          {String(value)}
        </Link>
      );
    }
  }

  if (column.kind === "url" && typeof value === "string" && value.trim()) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="block truncate text-sky-400 transition hover:text-sky-300"
      >
        {value.replace(/^https?:\/\//, "")}
      </a>
    );
  }

  if (column.key === "party" && typeof value === "string" && value.trim()) {
    const party = value.trim().slice(0, 1).toUpperCase();

    return (
      <span
        className={cn(
          "ledger-stamp inline-flex h-5 min-w-5 items-center justify-center px-1.5 font-mono text-[0.68rem] font-bold",
          party === "D"
            ? "border-zinc-700/70 bg-zinc-950/55 text-zinc-500"
            : party === "R"
              ? "border-zinc-700/70 bg-zinc-950/55 text-zinc-500"
              : "border-zinc-700/70 bg-zinc-950/55 text-zinc-600",
        )}
      >
        [{party}]
      </span>
    );
  }

  return (
    <span title={value ? String(value) : undefined} className="block truncate">
      {formatDatasetValue(value, column)}
    </span>
  );
}

function dataCellClass(column: DatasetColumn) {
  return cn(
    ["ticker", "date", "cents", "number", "percent", "hash"].includes(column.kind ?? "")
      ? "font-mono tabular-nums"
      : "",
    column.kind === "cents" ? "text-foreground" : "",
    column.kind === "hash" ? "text-muted-foreground" : "",
  );
}

function rowKey(slug: string, row: DatasetRow, index: number) {
  const stable = row.id ?? row.ticker ?? row.dataset ?? row.sourceHash;

  if (stable !== undefined && stable !== null) {
    const date = row.date ?? row.transactionDate ?? row.startedAt ?? row.filingDate;
    return `${slug}-${String(stable)}-${date ? String(date) : index}`;
  }

  return `${slug}-${index}`;
}

function defaultSortDir(column: DatasetColumn): "asc" | "desc" {
  if (["date", "cents", "number", "percent"].includes(column.kind ?? "")) {
    return "desc";
  }
  return "asc";
}
