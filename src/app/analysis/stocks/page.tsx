import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, CandlestickChart, Search, TrendingUp } from "lucide-react";

import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getTopTickers, type TopTickerRow } from "@/lib/queries/topTickers";
import { Button } from "@/components/ui/button";
import { WatchlistButton } from "@/components/watchlist-button";
import { cn } from "@/lib/utils";
import { getWatchedTickerSet } from "@/lib/queries/watchlist";

export const metadata = {
  title: "Ticker Intelligence",
  description:
    "Pick a ticker to drill into price overlays, politician activity, data-source coverage, and timeline events.",
};

type SearchParams = { q?: string | string[] };

export default function TickerIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <main className="qq-page">
      <Suspense fallback={<PageFallback />}>
        <TickerIntelligenceContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function TickerIntelligenceContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q } = await searchParams;
  const raw = (Array.isArray(q) ? q[0] : q)?.trim();

  if (raw) {
    // Empty/garbage → fall through to the landing. Anything non-empty is
    // sent through to the detail page; if the ticker doesn't exist the
    // detail page handles the empty state.
    redirect(`/analysis/stocks/${encodeURIComponent(raw.toUpperCase())}`);
  }

  const [topByQuarter, topByMonth] = await Promise.all([
    getTopTickersWithCompany(90, 18),
    getTopTickersWithCompany(30, 12),
  ]);
  const watchedTickers = await getWatchedTickerSet([
    ...topByQuarter.map((row) => row.ticker),
    ...topByMonth.map((row) => row.ticker),
  ]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button nativeButton={false} variant="ghost" render={<Link href="/analysis" />}>
          <ArrowLeft className="size-4" />
          Analysis
        </Button>
      </div>

      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(0,229,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,.05)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute -left-20 top-0 h-44 w-[460px] bg-primary/10 blur-3xl" />

        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="qq-section-subtitle text-primary">
              <CandlestickChart className="mr-1 inline size-3.5" />
              Single stock
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Ticker Intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Pick a ticker to drill into price overlays, congressional and
              executive activity, data-source coverage, and timeline events.
            </p>
          </div>

          <form action="/analysis/stocks" method="get" className="qq-metric p-4">
            <label
              htmlFor="ticker-q"
              className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-primary"
            >
              Jump to ticker
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="ticker-q"
                  name="q"
                  autoComplete="off"
                  placeholder="NVDA"
                  className="h-10 w-full rounded border border-border bg-card pl-9 pr-3 font-mono text-sm uppercase tracking-wider text-foreground outline-none transition focus:border-primary/40"
                />
              </div>
              <Button type="submit" size="sm">
                Open
              </Button>
            </div>
            <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/80">
              Enter any symbol. No company-name lookup yet.
            </p>
          </form>
        </div>
      </section>

      <TickerGrid
        title="Most-disclosed tickers — last 90 days"
        subtitle="Ranked by minimum disclosed dollar volume across congressional disclosures."
        rows={topByQuarter}
        watchedTickers={watchedTickers}
      />

      <TickerGrid
        title="Most-disclosed tickers — last 30 days"
        subtitle="Recent activity. Smaller window, fewer rows."
        rows={topByMonth}
        watchedTickers={watchedTickers}
      />
    </>
  );
}

function TickerGrid({
  title,
  subtitle,
  rows,
  watchedTickers,
}: {
  title: string;
  subtitle: string;
  rows: TopTickerWithCompany[];
  watchedTickers: Set<string>;
}) {
  return (
    <section className="qq-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="qq-section-subtitle text-primary">
            <TrendingUp className="mr-1 inline size-3.5" />
            {title}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
          {rows.length} tickers
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No disclosed activity in this window yet.
        </div>
      ) : (
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.ticker}
              className={cn(
                "group flex items-center justify-between gap-3 rounded border border-border bg-card px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/[0.04]",
              )}
            >
              <Link
                href={`/analysis/stocks/${encodeURIComponent(row.ticker)}`}
                className="min-w-0 flex-1"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-sky-400">
                    ${row.ticker}
                    <ArrowUpRight className="size-3 text-muted-foreground transition group-hover:text-sky-300" />
                  </div>
                  <div className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">
                    {row.companyName ?? "—"}
                  </div>
                </div>
              </Link>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs font-semibold text-foreground">
                  {formatMoney(row.total)}
                </div>
                <div className="font-mono text-[0.62rem] text-muted-foreground">
                  {row.count} {row.count === 1 ? "trade" : "trades"}
                </div>
              </div>
              <WatchlistButton
                ticker={row.ticker}
                watched={watchedTickers.has(row.ticker)}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PageFallback() {
  return (
    <>
      <div className="qq-panel h-44 shimmer" />
      <div className="qq-panel h-72 shimmer" />
      <div className="qq-panel h-56 shimmer" />
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

type TopTickerWithCompany = TopTickerRow & { companyName: string | null };

async function getTopTickersWithCompany(
  daysBack: number,
  limit: number,
): Promise<TopTickerWithCompany[]> {
  "use cache";
  applyCacheLife("minutes");

  const rows = await getTopTickers(daysBack, limit);
  if (rows.length === 0) return [];

  const stocks = await db.stock.findMany({
    where: { ticker: { in: rows.map((r) => r.ticker) } },
    select: { ticker: true, companyName: true },
  });
  const nameByTicker = new Map(stocks.map((s) => [s.ticker, s.companyName]));

  return rows.map((r) => ({
    ...r,
    companyName: nameByTicker.get(r.ticker) ?? null,
  }));
}
