import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Database, Layers3, Table2 } from "lucide-react";

import { DATASET_DEFINITIONS, type DatasetGroup } from "@/lib/datasets/registry";
import { getDatasetSummaries, type DatasetSummary } from "@/lib/datasets/queries";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Datasets",
  description: "Browse the SQL tables powering the terminal.",
};

const GROUP_ORDER: DatasetGroup[] = [
  "Operations",
  "Reference",
  "Congress",
  "Executive",
  "Alternative Data",
];

export default function DatasetsPage() {
  return (
    <main className="min-h-[calc(100dvh-44px)] px-3 py-4 sm:px-5 lg:px-7">
      <Suspense fallback={<DatasetsSkeleton />}>
        <DatasetsContent />
      </Suspense>
    </main>
  );
}

async function DatasetsContent() {
  const summaries = await getDatasetSummaries();
  const totalKnownRows = summaries.reduce(
    (total, dataset) => total + (dataset.rowCount ?? 0),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <section className="relative overflow-hidden rounded border border-border bg-card/80 p-5 shadow-sm">
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgb(26_23_20/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(26_23_20/0.04)_1px,transparent_1px)] [background-size:32px_32px] dark:[background-image:linear-gradient(rgb(236_228_212/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(236_228_212/0.04)_1px,transparent_1px)]" />
        <div className="absolute right-8 top-0 h-28 w-80 bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
              <Database className="size-3.5" />
              SQL Data Explorer
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Live Tables
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              A direct operating view of the tables behind trades, stock profiles, price
              cache rows, ingest runs, and alternative datasets.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <Metric label="Tables" value={DATASET_DEFINITIONS.length.toLocaleString()} />
            <Metric label="Visible Rows" value={formatCompact(totalKnownRows)} />
          </div>
        </div>
      </section>

      <div className="grid gap-5">
        {GROUP_ORDER.map((group) => {
          const groupItems = summaries.filter((dataset) => dataset.group === group);

          return (
            <section key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers3 className="size-4 text-primary" />
                <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group}
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groupItems.map((dataset) => (
                  <DatasetCard key={dataset.slug} dataset={dataset} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DatasetCard({ dataset }: { dataset: DatasetSummary }) {
  return (
    <Link
      href={`/datasets/${dataset.slug}`}
      className={cn(
        "group relative overflow-hidden rounded border border-border bg-card/72 p-4 transition",
        "hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.035]",
      )}
    >
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgb(26_23_20/0.18)_1px,transparent_1px)] [background-size:16px_16px] dark:[background-image:radial-gradient(rgb(236_228_212/0.18)_1px,transparent_1px)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Table2 className="size-4 text-primary" />
            <h3 className="truncate text-sm font-semibold">{dataset.label}</h3>
          </div>
          <div className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            {dataset.tableName}
          </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-sky-300" />
      </div>
      <p className="relative mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
        {dataset.description}
      </p>
      <div className="relative mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
          Rows
        </span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {dataset.rowCount === null ? "Unavailable" : formatCompact(dataset.rowCount)}
        </span>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-muted p-3">
      <div className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DatasetsSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-4">
      <div className="h-44 rounded border border-border bg-muted" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-40 rounded border border-border bg-muted" />
        ))}
      </div>
    </div>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
