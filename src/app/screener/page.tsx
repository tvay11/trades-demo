import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Download, Filter } from "lucide-react";

import { AppSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { getScreenerIdeas } from "@/lib/screener/getScreenerIdeas";
import { getScreenerRationales } from "@/lib/screener/rationale";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Screener",
  description: "Ranked stock ideas by smart-money activity and acceleration.",
};

type SearchParams = {
  cap?: string;
  sector?: string;
  minTrades90?: string;
  activity?: string;
  limit?: string;
};

const CAP_OPTIONS = [
  { label: "All caps", value: "" },
  { label: "Mega cap ($200B+)", value: "mega" },
  { label: "Large cap ($10B–$200B)", value: "large" },
  { label: "Mid cap ($2B–$10B)", value: "mid" },
  { label: "Small cap ($300M–$2B)", value: "small" },
  { label: "Micro cap (<$300M)", value: "micro" },
];

const SECTOR_OPTIONS = [
  { label: "All sectors", value: "" },
  { label: "Technology", value: "Technology" },
  { label: "Healthcare", value: "Healthcare" },
  { label: "Financials", value: "Financial Services" },
  { label: "Consumer Cyclical", value: "Consumer Cyclical" },
  { label: "Industrials", value: "Industrials" },
  { label: "Energy", value: "Energy" },
  { label: "Utilities", value: "Utilities" },
  { label: "Basic Materials", value: "Basic Materials" },
  { label: "Comm. Services", value: "Communication Services" },
  { label: "Real Estate", value: "Real Estate" },
  { label: "Cons. Defensive", value: "Consumer Defensive" },
];

const ACTIVITY_OPTIONS = [
  { label: "Any activity", value: "" },
  { label: "Traded in 90d", value: "active90" },
  { label: "Traded in 1y", value: "active365" },
];

const LIMIT_OPTIONS = [
  { label: "Top 10", value: "10" },
  { label: "Top 25", value: "25" },
  { label: "Top 50", value: "50" },
  { label: "Top 100", value: "100" },
];

function buildScreenerHref(params: SearchParams) {
  const sp = new URLSearchParams();
  if (params.cap) sp.set("cap", params.cap);
  if (params.sector) sp.set("sector", params.sector);
  if (params.minTrades90) sp.set("minTrades90", params.minTrades90);
  if (params.activity) sp.set("activity", params.activity);
  if (params.limit && params.limit !== "25") sp.set("limit", params.limit);
  const s = sp.toString();
  return s ? `/screener?${s}` : "/screener";
}

function buildScreenerExportHref(params: SearchParams) {
  const sp = new URLSearchParams();
  if (params.cap) sp.set("cap", params.cap);
  if (params.sector) sp.set("sector", params.sector);
  if (params.minTrades90) sp.set("minTrades90", params.minTrades90);
  if (params.activity) sp.set("activity", params.activity);
  if (params.limit) sp.set("limit", params.limit);
  const s = sp.toString();
  return s ? `/screener/export?${s}` : "/screener/export";
}

export default function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<ScreenerFallback />}>
      {searchParams.then((params) => <ScreenerContent params={params} />)}
    </Suspense>
  );
}

async function ScreenerContent({ params }: { params: SearchParams }) {
  const cap = params.cap;
  const sector = params.sector;
  const minTrades90 = params.minTrades90;
  const activity = params.activity;
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? "25") || 25));

  const ideas = await getScreenerIdeas({ cap, sector, minTrades90, activity, limit });

  // Rationales are optional — degrade gracefully to {} if DeepSeek is unavailable
  let rationales: Record<string, string> = {};
  try {
    rationales = await getScreenerRationales(ideas);
  } catch {
    // silent — page renders fine without rationales
  }

  const currentParams: SearchParams = { cap, sector, minTrades90, activity, limit: String(limit) };
  const csvHref = buildScreenerExportHref(currentParams);

  return (
    <main className="qq-page">
      {/* ── Masthead ────────────────────────────────────────────────────── */}
      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div>
          <div className="qq-section-subtitle text-sky-500">Smart-money signal</div>
          <h1 className="mt-3 flex items-baseline gap-3 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            <Filter className="size-7 text-sky-500" />
            Stock Screener
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ranked ideas by congressional + executive trade activity and acceleration. Top of the
            list = most interesting signals.
          </p>
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────── */}
        <form action="/screener" className="mt-6 grid gap-3 sm:grid-cols-[repeat(4,minmax(140px,180px))_auto]">
          <AppSelect name="cap" defaultValue={cap ?? ""} options={CAP_OPTIONS} />
          <AppSelect name="sector" defaultValue={sector ?? ""} options={SECTOR_OPTIONS} />
          <AppSelect name="activity" defaultValue={activity ?? ""} options={ACTIVITY_OPTIONS} />
          <AppSelect name="limit" defaultValue={String(limit)} options={LIMIT_OPTIONS} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="h-9">
              <Filter className="size-4" />
              Screen
            </Button>
            <Link
              href="/screener"
              className="ledger-stamp inline-flex h-9 items-center border-zinc-700/70 bg-zinc-950/55 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-500/80 hover:text-zinc-100"
            >
              Reset
            </Link>
            <Link
              href={csvHref}
              download
              className="ledger-stamp inline-flex h-9 items-center gap-2 border-zinc-700/70 bg-zinc-950/55 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-500/80 hover:text-zinc-200"
            >
              <Download className="size-4" />
              CSV
            </Link>
          </div>
          {/* minTrades90 as a small numeric input */}
          <div className="flex items-center gap-2 sm:col-span-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap" htmlFor="screener-min-trades">
              Min 90d trades
            </label>
            <input
              id="screener-min-trades"
              name="minTrades90"
              type="number"
              min="0"
              step="1"
              defaultValue={minTrades90 ?? ""}
              placeholder="e.g. 5"
              className="ledger-field h-9 w-24 px-3 outline-none"
            />
          </div>
        </form>
      </section>

      {/* ── Results table ──────────────────────────────────────────────── */}
      <section className="qq-panel overflow-hidden">
        <div className="qq-section-header">
          <div>
            <h2 className="qq-section-title">
              {ideas.length === 0
                ? "No matches"
                : `${ideas.length} ranked idea${ideas.length === 1 ? "" : "s"}`}
            </h2>
            <p className="qq-section-subtitle">
              Sorted by composite score (activity + acceleration)
            </p>
          </div>
        </div>

        {ideas.length === 0 ? (
          <EmptyPanel />
        ) : (
          <div className="qq-table-shell">
            <Table className="text-[0.82rem]">
              <TableHeader>
                <TableRow className="border-zinc-700/70 bg-zinc-950/80 hover:bg-zinc-950/80">
                  <TableHead className="data-label w-10 text-right">#</TableHead>
                  <TableHead className="data-label">Ticker</TableHead>
                  <TableHead className="data-label text-right">Score</TableHead>
                  <TableHead className="data-label text-right">90d / 14d</TableHead>
                  <TableHead className="data-label text-right">Cap</TableHead>
                  <TableHead className="data-label">Tags</TableHead>
                  <TableHead className="data-label">Why look</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ideas.map((idea, i) => {
                  const blurb = rationales[idea.ticker] ?? null;
                  return (
                    <TableRow key={idea.ticker} className="row-stripe">
                      {/* Rank */}
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {i + 1}
                      </TableCell>

                      {/* Ticker + company */}
                      <TableCell>
                        <Link
                          href={`/report/${encodeURIComponent(idea.ticker)}`}
                          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-sky-400 transition hover:text-sky-300"
                        >
                          ${idea.ticker}
                          <ArrowUpRight className="size-3.5 text-muted-foreground" />
                        </Link>
                        {idea.companyName ? (
                          <div className="mt-0.5 max-w-[160px] truncate text-[0.72rem] text-muted-foreground">
                            {idea.companyName}
                          </div>
                        ) : null}
                      </TableCell>

                      {/* Score */}
                      <TableCell className="text-right tabular-nums">
                        <ScoreBadge score={idea.score} />
                      </TableCell>

                      {/* 90d / 14d */}
                      <TableCell className="text-right font-mono tabular-nums">
                        <span>{idea.tradeCount90}</span>
                        <span className="text-muted-foreground/60"> / </span>
                        <span
                          className={cn(
                            idea.accel > 2 ? "text-emerald-400" : idea.accel < -2 ? "text-rose-400" : "",
                          )}
                        >
                          {idea.tradeCount14}
                        </span>
                      </TableCell>

                      {/* Market cap */}
                      <TableCell className="text-right font-mono tabular-nums">
                        {idea.marketCap == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatMoney(idea.marketCap)
                        )}
                      </TableCell>

                      {/* Tags */}
                      <TableCell>
                        <TagList tags={idea.tags} />
                      </TableCell>

                      {/* Why blurb */}
                      <TableCell className="max-w-[220px] text-[0.75rem] text-muted-foreground">
                        {blurb ?? <span className="opacity-40">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Re-run link with current filters */}
        {ideas.length > 0 ? (
          <div className="flex items-center justify-end border-t border-zinc-700/70 bg-zinc-950/80 px-4 py-3 text-xs text-muted-foreground">
            <Link
              href={buildScreenerHref(currentParams)}
              className="transition hover:text-zinc-300"
            >
              Permalink to these filters →
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "text-emerald-400"
      : score >= 40
        ? "text-sky-300"
        : "text-zinc-400";
  return <span className={cn("font-mono font-semibold", color)}>{score}</span>;
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-muted-foreground/40">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="qq-metric py-0.5 text-[0.68rem]">
          {tag}
        </span>
      ))}
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="ledger-empty px-6 py-16">
      <div className="empty-orb mb-4 size-16 rounded-sm" />
      <h3 className="font-semibold">No matches</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try relaxing the filters (lower min trades, broader cap range, or remove the sector
        filter).
      </p>
    </div>
  );
}

function ScreenerFallback() {
  return (
    <main className="qq-page">
      <div className="qq-panel h-44 shimmer" />
      <div className="qq-panel h-[640px] shimmer" />
    </main>
  );
}
