import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Database, Download, Table2 } from "lucide-react";

import { DatasetFilterBar } from "@/components/datasets/dataset-filter-bar";
import { DatasetTable } from "@/components/datasets/dataset-table";
import {
  buildDatasetHref,
  summarizeActiveFilters,
  type NormalizedDatasetQuery,
} from "@/lib/datasets/filters";
import { DATASET_DEFINITIONS } from "@/lib/datasets/registry";
import type { Trade } from "@/lib/types";
import { getDatasetPage } from "@/lib/datasets/queries";
import { cn } from "@/lib/utils";

type DatasetDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return DATASET_DEFINITIONS.map((dataset) => ({ slug: dataset.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const definition = DATASET_DEFINITIONS.find((dataset) => dataset.slug === slug);

  return {
    title: definition?.label ?? "Dataset",
  };
}

export default function DatasetDetailPage(props: DatasetDetailPageProps) {
  return (
    <main className="min-h-[calc(100dvh-44px)] px-3 py-4 sm:px-5 lg:px-7">
      <Suspense fallback={<DatasetDetailSkeleton />}>
        <DatasetDetailContent {...props} />
      </Suspense>
    </main>
  );
}

async function DatasetDetailContent({ params, searchParams }: DatasetDetailPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const dataset = await getDatasetPage(slug, query);

  if (!dataset) notFound();

  const { definition, rows, page, totalPages, totalRows, pageSize, error, query: normalizedQuery } =
    dataset;
  const firstRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(totalRows, page * pageSize);
  const basePath = `/datasets/${definition.slug}`;
  const chips = summarizeActiveFilters(basePath, definition, normalizedQuery);
  const hasActiveFilters = chips.length > 0;
  const csvHref = buildDatasetHref(`${basePath}/csv`, normalizedQuery, { page: 1 });

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <section className="relative overflow-hidden rounded border border-border bg-card/80 p-5 shadow-sm">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgb(26_23_20/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(26_23_20/0.04)_1px,transparent_1px)] [background-size:30px_30px] dark:[background-image:linear-gradient(rgb(236_228_212/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(236_228_212/0.04)_1px,transparent_1px)]" />
        <div className="absolute right-6 top-0 h-28 w-80 bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/datasets"
              className="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-sky-300"
            >
              <ArrowLeft className="size-3.5" />
              Datasets
            </Link>
            <div className="mt-4 flex items-center gap-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
              <Database className="size-3.5" />
              {definition.group}
            </div>
            <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
              {definition.label}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {definition.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <Metric label="SQL Table" value={definition.tableName} compact />
            <Metric label="Rows" value={totalRows.toLocaleString()} />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded border border-loss/30 bg-loss/10 p-4 text-sm text-loss">
          {error}
        </div>
      ) : null}

      <DatasetFilterBar definition={definition} query={normalizedQuery} chips={chips} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          <Table2 className="size-3.5 text-primary" />
          Showing {firstRow.toLocaleString()}-{lastRow.toLocaleString()} of{" "}
          {totalRows.toLocaleString()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={csvHref}
            className="inline-flex h-8 items-center gap-2 rounded border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-sky-300"
          >
            <Download className="size-3.5" />
            CSV
          </Link>
          <Pagination basePath={basePath} query={normalizedQuery} page={page} totalPages={totalPages} />
        </div>
      </div>

      <DatasetTable definition={definition} rows={rows} hasActiveFilters={hasActiveFilters} basePath={basePath} query={normalizedQuery} />

      <div className="flex justify-end">
        <Pagination basePath={basePath} query={normalizedQuery} page={page} totalPages={totalPages} />
      </div>
    </div>
  );
}

function Pagination({
  basePath,
  query,
  page,
  totalPages,
}: {
  basePath: string;
  query: NormalizedDatasetQuery;
  page: number;
  totalPages: number;
}) {
  const previous = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav className="flex items-center gap-2" aria-label="Dataset pagination">
      <PageLink
        href={buildDatasetHref(basePath, query, { page: previous })}
        disabled={page <= 1}
        label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </PageLink>
      <span className="rounded border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
        Page <span className="text-foreground">{page}</span> / {totalPages}
      </span>
      <PageLink
        href={buildDatasetHref(basePath, query, { page: next })}
        disabled={page >= totalPages}
        label="Next page"
      >
        <ChevronRight className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className="inline-flex size-8 items-center justify-center rounded border border-border bg-muted text-muted-foreground/40"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded border border-border bg-card text-muted-foreground transition hover:border-primary/25 hover:bg-primary/10 hover:text-sky-300"
    >
      {children}
    </Link>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded border border-border bg-muted p-3">
      <div className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 truncate font-mono font-semibold text-foreground",
          compact ? "text-sm" : "text-2xl",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DatasetDetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-4">
      <div className="h-44 rounded border border-border bg-muted" />
      <div className="h-10 rounded border border-border bg-muted" />
      <div className="h-[520px] rounded border border-border bg-muted" />
    </div>
  );
}
