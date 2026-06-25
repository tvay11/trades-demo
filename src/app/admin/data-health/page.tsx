import { connection } from "next/server";
import { Suspense } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Landmark,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";

import { getDataHealth, type DataHealthRow } from "@/lib/queries/dataHealth";
import { compactDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = {
  title: "Data Health",
};

export default function DataHealthPage() {
  return (
    <Suspense fallback={<DataHealthFallback />}>
      <DataHealthContent />
    </Suspense>
  );
}

async function DataHealthContent() {
  await connection();
  const health = await getDataHealth();
  const visibleTables = health.tableCounts.filter((row) => row.rowCount !== null);

  return (
    <main className="qq-page">
      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="qq-section-subtitle text-primary">Operational monitor</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Data Health
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Check SQL population, ingest freshness, missing price coverage, unmatched
              politicians, stale jobs, and empty SQL-state risk before trusting analysis.
            </p>
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            Generated {compactDate(health.generatedAt.toISOString().slice(0, 10))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {health.metrics.map((metric) => (
          <HealthMetric key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="qq-panel overflow-hidden">
          <div className="qq-section-header">
            <div>
              <h2 className="qq-section-title">Control Checks</h2>
              <p className="qq-section-subtitle">
                Required tables before analysis should be trusted
              </p>
            </div>
            <ShieldAlert className="size-4 text-primary" />
          </div>
          <div className="grid gap-2 p-3 md:grid-cols-2">
            {health.coreChecks.map((check) => (
              <div key={check.label} className="qq-metric p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="data-label">{check.label}</div>
                  <ToneDot tone={check.tone} />
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold">{check.value}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="qq-panel p-4">
          <div className="flex items-center gap-2 text-primary">
            <Clock3 className="size-4" />
            <span className="font-mono text-xs uppercase tracking-[0.16em]">
              External ingest last run
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStatus label="Dataset" value={health.latestMarketDataIngest.dataset ?? "-"} />
            <MiniStatus label="Mode" value={health.latestMarketDataIngest.mode ?? "-"} />
            <MiniStatus label="Started" value={health.latestMarketDataIngest.value} />
            <MiniStatus
              label="Rows"
              value={`${health.latestMarketDataIngest.rowsInserted.toLocaleString()}/${health.latestMarketDataIngest.rowsFetched.toLocaleString()}`}
            />
          </div>
          {health.latestMarketDataIngest.error ? (
            <div className="mt-3 rounded border border-loss/25 bg-loss/10 p-3 text-sm text-loss">
              {health.latestMarketDataIngest.error}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="qq-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="qq-section-title">TickerPriceCache Coverage</h2>
              <p className="qq-section-subtitle">
                Congress tickers with cached prices for disclosure return windows
              </p>
            </div>
            <ToneBadge tone={health.priceCoverage.tone}>
              {health.priceCoverage.coveragePercent.toFixed(1)}%
            </ToneBadge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStatus label="Trade tickers" value={health.priceCoverage.congressTickerCount.toLocaleString()} />
            <MiniStatus label="Price tickers" value={health.priceCoverage.priceTickerCount.toLocaleString()} />
            <MiniStatus label="Covered" value={health.priceCoverage.coveredTickerCount.toLocaleString()} />
            <MiniStatus label="Missing" value={health.priceCoverage.missingTickerCount.toLocaleString()} />
          </div>
          {health.priceCoverage.missingTickers.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {health.priceCoverage.missingTickers.map((ticker) => (
                <span key={ticker} className="rounded border border-zinc-800/70 bg-zinc-950/40 px-2 py-1 font-mono text-[0.68rem] text-zinc-400">
                  ${ticker}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="qq-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="qq-section-title">Committee Sync Status</h2>
              <p className="qq-section-subtitle">
                Synced committee rows and politician assignment coverage
              </p>
            </div>
            <ToneBadge tone={health.committeeSync.tone}>
              {health.committeeSync.assignmentCoveragePercent.toFixed(1)}%
            </ToneBadge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStatus label="Committees" value={health.committeeSync.committeeRows.toLocaleString()} />
            <MiniStatus label="Assignments" value={health.committeeSync.assignmentRows.toLocaleString()} />
            <MiniStatus label="With committees" value={health.committeeSync.politiciansWithCommittees.toLocaleString()} />
            <MiniStatus label="Bioguide" value={`${health.committeeSync.bioguideCoveragePercent.toFixed(1)}%`} />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Latest assignment sync:{" "}
            <span className="font-mono text-foreground">
              {health.committeeSync.latestAssignmentSync
                ? compactDate(health.committeeSync.latestAssignmentSync.toISOString().slice(0, 10))
                : "Never"}
            </span>
          </p>
        </div>
      </section>

      {health.readWarnings.length ? (
        <section className="qq-panel border-rose-900/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-400" />
            <h2 className="qq-section-title">Live Read Warnings</h2>
          </div>
          <div className="space-y-2">
            {health.readWarnings.map((warning) => (
              <div key={warning} className="rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
                {warning}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {health.fallbackWarnings.length ? (
        <section className="qq-panel border-rose-900/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-400" />
            <h2 className="qq-section-title">Mock Fallback Warnings</h2>
          </div>
          <div className="space-y-2">
            {health.fallbackWarnings.map((warning) => (
              <div key={warning} className="rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
                {warning}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="qq-table-shell">
          <div className="qq-section-header">
            <div>
              <h2 className="qq-section-title">Table Row Counts</h2>
              <p className="qq-section-subtitle">Every registered SQL table in the explorer</p>
            </div>
            <Database className="size-4 text-primary" />
          </div>
          <Table className="text-[0.82rem]">
            <TableHeader>
              <TableRow className="border-border bg-muted hover:bg-muted">
                <TableHead className="data-label h-9">Table</TableHead>
                <TableHead className="data-label">Model</TableHead>
                <TableHead className="data-label text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTables.map((row) => (
                <TableRow key={`${row.tableName}-${row.label}`} className="row-stripe">
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{row.tableName}</TableCell>
                  <TableCell className="text-right font-mono">{row.rowCount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="qq-table-shell">
          <div className="qq-section-header">
            <div>
              <h2 className="qq-section-title">Ingest Jobs</h2>
              <p className="qq-section-subtitle">Cursor and error state by dataset</p>
            </div>
            <RefreshCcw className="size-4 text-primary" />
          </div>
          <Table className="text-[0.82rem]">
            <TableHeader>
              <TableRow className="border-border bg-muted hover:bg-muted">
                <TableHead className="data-label h-9">Dataset</TableHead>
                <TableHead className="data-label">Mode</TableHead>
                <TableHead className="data-label text-right">Rows</TableHead>
                <TableHead className="data-label">Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.ingestJobs.map((job) => (
                <TableRow key={job.dataset} className="row-stripe">
                  <TableCell>
                    <div className="font-medium">{job.dataset}</div>
                    {job.lastError ? (
                      <div className="mt-0.5 max-w-64 truncate text-[0.7rem] text-loss">{job.lastError}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{job.mode}</TableCell>
                  <TableCell className="text-right font-mono">{job.totalIngested.toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded border px-2 py-1 font-mono text-[0.66rem]",
                        job.healthTone === "bad" && "border-loss/25 bg-loss/10 text-loss",
                        job.healthTone === "warn" && "border-rose-900/40 bg-rose-950/20 text-rose-300",
                        job.healthTone === "good" && "border-profit/25 bg-profit/10 text-profit",
                        job.healthTone === "neutral" && "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {job.healthLabel}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {!health.ingestJobs.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No ingest jobs exist yet. Run the API probe and backfill after adding the key.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="qq-table-shell">
        <div className="qq-section-header">
          <div>
            <h2 className="qq-section-title">Unmatched Politicians</h2>
            <p className="qq-section-subtitle">
              Politician rows without `bioguideId`, which blocks reliable committee matching
            </p>
          </div>
          <Landmark className="size-4 text-primary" />
        </div>
        <Table className="text-[0.82rem]">
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead className="data-label h-9">Politician</TableHead>
              <TableHead className="data-label">Party</TableHead>
              <TableHead className="data-label">State</TableHead>
              <TableHead className="data-label">Chamber</TableHead>
              <TableHead className="data-label text-right">Trades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {health.unmatchedPoliticians.map((politician) => (
              <TableRow key={`${politician.name}-${politician.state}`} className="row-stripe">
                <TableCell className="font-medium">{politician.name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{politician.party ?? "-"}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{politician.state ?? "-"}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{politician.chamber ?? "-"}</TableCell>
                <TableCell className="text-right font-mono">{politician.tradeCount.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {!health.unmatchedPoliticians.length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No unmatched politicians in the first check window.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}

function HealthMetric({ metric }: { metric: DataHealthRow }) {
  return (
    <div className="qq-metric p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="data-label">{metric.label}</div>
        <CheckCircle2
          className={cn(
            "size-3.5",
            metric.tone === "good"
              ? "text-profit"
              : metric.tone === "bad"
                ? "text-loss"
                : metric.tone === "warn"
                  ? "text-rose-400"
                  : "text-muted-foreground",
          )}
        />
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold">{metric.value}</div>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card px-2.5 py-2">
      <div className="data-label">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function ToneBadge({
  tone,
  children,
}: {
  tone: DataHealthRow["tone"];
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded border px-2.5 py-1 font-mono text-xs font-semibold",
        tone === "good" && "border-profit/25 bg-profit/10 text-profit",
        tone === "warn" && "border-rose-900/40 bg-rose-950/20 text-rose-300",
        tone === "bad" && "border-loss/25 bg-loss/10 text-loss",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function ToneDot({ tone }: { tone: DataHealthRow["tone"] }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full shadow-[0_0_14px_currentColor]",
        tone === "good" && "bg-profit text-profit",
        tone === "warn" && "bg-rose-400 text-rose-400",
        tone === "bad" && "bg-loss text-loss",
        tone === "neutral" && "bg-muted-foreground text-muted-foreground",
      )}
    />
  );
}

function DataHealthFallback() {
  return (
    <main className="qq-page">
      <div className="qq-panel h-40 shimmer" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="qq-panel h-24 shimmer" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="qq-panel h-96 shimmer" />
        <div className="qq-panel h-96 shimmer" />
      </div>
    </main>
  );
}
