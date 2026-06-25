import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Suspense } from "react";

import {
  dateText,
  EmptySignal,
  FactStat,
  formatCompactNumber,
  formatSignedMoney,
  SignalPill,
  TickerLink,
} from "@/components/analysis/market-signal-ui";
import { FreshnessChip } from "@/components/analysis/freshness-chip";
import { ConvictionBadge } from "@/components/analysis/ConvictionBadge";
import { DownloadCsvButton } from "@/components/analysis/DownloadCsvButton";
import { ReportChips } from "@/components/analysis/ReportChips";
import { Button } from "@/components/ui/button";
import {
  getCongressTradeScreen,
  type CongressTradeScreenRow,
} from "@/lib/queries/congressTradeScreen";
import { getTickerConviction } from "@/lib/queries/conviction";
import type { TickerConviction } from "@/lib/analysis/convictionRollup";
import { getLatestReportSignals, type ReportSignals } from "@/lib/queries/reportSignals";
import { cn } from "@/lib/utils";

type SearchParams = { sort?: string | string[] };

export const metadata = {
  title: "Congress Trade Screen",
};

function money(value: number): string {
  return formatSignedMoney(value).replace(/^\+/, "");
}

function topBy(
  rows: CongressTradeScreenRow[],
  valueFor: (row: CongressTradeScreenRow) => number,
): CongressTradeScreenRow | null {
  return rows.reduce<CongressTradeScreenRow | null>((best, row) => {
    if (!best) return row;
    return valueFor(row) > valueFor(best) ? row : best;
  }, null);
}

export default function CongressTradesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<CongressTradesFallback />}>
      <CongressTradesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CongressTradesContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { sort } = await searchParams;
  const sortByConviction = (Array.isArray(sort) ? sort[0] : sort) === "conviction";

  const { rows: rawRows, summary, source } = await getCongressTradeScreen();
  const hasError = source === "database-error";
  const isEmpty = rawRows.length === 0;

  const tickers = rawRows.map((r) => r.ticker);
  const [convictionMap, reportSignalsMap] = await Promise.all([
    getTickerConviction(tickers),
    getLatestReportSignals(tickers),
  ]);

  let rows = rawRows;
  if (sortByConviction) {
    rows = [...rows].sort((a, b) => {
      const sa = convictionMap.get(a.ticker)?.score ?? -1;
      const sb = convictionMap.get(b.ticker)?.score ?? -1;
      return sb - sa;
    });
  }

  const mostNetBuying = topBy(rows, (r) => r.netTrades);
  const mostNetSelling = topBy(rows, (r) => -r.netTrades);
  const largestNetUsd = topBy(rows, (r) => Math.abs(r.netUsd));
  const mostBipartisan = topBy(
    rows.filter((r) => r.bipartisanBuying),
    (r) => r.trades,
  );

  const csvRows: (string | number | null)[][] = rows.slice(0, 60).map((r) => [
    r.ticker,
    r.companyName ?? null,
    convictionMap.get(r.ticker)?.score ?? null,
    reportSignalsMap.get(r.ticker)?.rating ?? null,
    r.trades,
    r.buys,
    r.sells,
    r.netTrades,
    r.politicians,
    r.netUsd,
    r.grossUsd,
    r.demBuys,
    r.demSells,
    r.repBuys,
    r.repSells,
    r.houseTrades,
    r.senateTrades,
    r.leadershipTrades,
    r.avgDisclosureLagDays,
    r.latestTransactionDate ? r.latestTransactionDate.toISOString().slice(0, 10) : null,
  ]);

  return (
    <main className="qq-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button nativeButton={false} variant="ghost" render={<Link href="/analysis" />}>
          <ArrowLeft className="size-4" />
          Analysis
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant="outline" render={<Link href="/analysis/long-short" />}>
            <Scale className="size-4" />
            Long / short
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/analysis/dark-flow" />}>
            <ShieldAlert className="size-4" />
            Dark flow
          </Button>
        </div>
      </div>

      <section className="qq-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="qq-section-subtitle text-primary">Analysis / Congress trades</div>
          <FreshnessChip date={summary.latestTransactionDate} />
          <SignalPill tone={hasError ? "negative" : "accent"}>
            {hasError ? "SQL error" : "Live SQL"}
          </SignalPill>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Congress Trade Screen
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Every column is raw disclosed data over the trailing year — trade counts, distinct
          politicians, minimum disclosed dollars, party and chamber splits, committee-leadership
          activity, and filing lag. The Conviction column is a deterministic, explainable rubric
          (hover for the component breakdown) — all other columns are unweighted facts.
        </p>
        {hasError ? (
          <p className="mt-3 text-sm text-destructive">
            Congress trade data failed to load — the screen below may be incomplete.
          </p>
        ) : null}
      </section>

      {isEmpty ? (
        <section className="qq-panel p-4">
          <EmptySignal title="No congress trades" body="No disclosed trades in the trailing year." />
        </section>
      ) : (
        <>
          <SummaryStrip
            tickers={summary.tickers}
            trades={summary.trades}
            buys={summary.buys}
            sells={summary.sells}
            netUsd={summary.netUsd}
            bipartisanTickers={summary.bipartisanTickers}
            avgLagDays={summary.avgDisclosureLagDays}
          />

          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <ScreenTable
              rows={rows}
              convictionMap={convictionMap}
              reportSignalsMap={reportSignalsMap}
              sortByConviction={sortByConviction}
              csvRows={csvRows}
            />
            <aside className="space-y-4">
              <HighlightCard
                label="Most net buying"
                row={mostNetBuying}
                metric={(r) => `+${r.netTrades} trades`}
                tone="positive"
                icon={TrendingUp}
              />
              <HighlightCard
                label="Most net selling"
                row={mostNetSelling}
                metric={(r) => `${r.netTrades} trades`}
                tone="negative"
                icon={TrendingDown}
              />
              <HighlightCard
                label="Largest net dollars"
                row={largestNetUsd}
                metric={(r) => formatSignedMoney(r.netUsd)}
                tone="accent"
                icon={Scale}
              />
              <HighlightCard
                label="Most active bipartisan buy"
                row={mostBipartisan}
                metric={(r) => `${r.trades} trades`}
                tone="accent"
                icon={Users}
              />
              <section className="qq-panel p-4">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Dollars use the minimum disclosed amount of each range. Lag is days between the
                    transaction and its public filing — you could not have acted before then.
                  </p>
                </div>
              </section>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

function SummaryStrip({
  tickers,
  trades,
  buys,
  sells,
  netUsd,
  bipartisanTickers,
  avgLagDays,
}: {
  tickers: number;
  trades: number;
  buys: number;
  sells: number;
  netUsd: number;
  bipartisanTickers: number;
  avgLagDays: number;
}) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      <FactStat label="Tickers" value={formatCompactNumber(tickers)} tone="accent" />
      <FactStat label="Trades" value={formatCompactNumber(trades)} />
      <FactStat label="Buys / sells" value={`${formatCompactNumber(buys)} / ${formatCompactNumber(sells)}`} />
      <FactStat
        label="Net $"
        value={formatSignedMoney(netUsd)}
        tone={netUsd >= 0 ? "positive" : "negative"}
      />
      <FactStat label="Bipartisan buys" value={formatCompactNumber(bipartisanTickers)} tone="accent" />
      <FactStat label="Avg lag" value={`${avgLagDays}d`} />
    </section>
  );
}

const CSV_HEADERS = [
  "Ticker", "Company", "Conviction",
  "Rating",
  "Trades", "Buys", "Sells", "Net Trades", "Politicians",
  "Net $", "Gross $", "Dem Buys", "Dem Sells", "Rep Buys", "Rep Sells",
  "House Trades", "Senate Trades", "Leadership Trades", "Avg Lag (d)", "Latest Transaction",
];

function ScreenTable({
  rows,
  convictionMap,
  reportSignalsMap,
  sortByConviction,
  csvRows,
}: {
  rows: CongressTradeScreenRow[];
  convictionMap: Map<string, TickerConviction>;
  reportSignalsMap: Map<string, ReportSignals>;
  sortByConviction: boolean;
  csvRows: (string | number | null)[][];
}) {
  const convictionSortHref = sortByConviction ? "." : "?sort=conviction";

  return (
    <section className="qq-panel overflow-x-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Screen ({formatCompactNumber(rows.length)} tickers)
        </h2>
        <div className="flex items-center gap-2">
          <DownloadCsvButton filename="congress-trades.csv" headers={CSV_HEADERS} rows={csvRows} />
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            {sortByConviction ? "Top 60 by conviction" : "Top 60 by trade count"}
          </span>
        </div>
      </div>
      <table className="mt-3 w-full min-w-[1020px] text-left text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-1.5">Ticker</th>
            <th className="px-2 py-1.5 text-right">
              <Link
                href={convictionSortHref}
                className={cn(
                  "hover:text-foreground",
                  sortByConviction && "text-primary",
                )}
              >
                Conv
              </Link>
            </th>
            <th className="px-2 py-1.5 text-right">Trades</th>
            <th className="px-2 py-1.5 text-right">Buy / Sell</th>
            <th className="px-2 py-1.5 text-right">Net</th>
            <th className="px-2 py-1.5 text-right">Pols</th>
            <th className="px-2 py-1.5 text-right">Net $</th>
            <th className="px-2 py-1.5 text-right">Gross $</th>
            <th className="px-2 py-1.5 text-right">Dem b/s</th>
            <th className="px-2 py-1.5 text-right">Rep b/s</th>
            <th className="px-2 py-1.5 text-right">H / S</th>
            <th className="px-2 py-1.5 text-right">Lead</th>
            <th className="px-2 py-1.5 text-right">Lag</th>
            <th className="px-2 py-1.5">Latest</th>
            <th className="px-2 py-1.5">Top traders</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((row) => (
            <tr key={row.ticker} className="border-t border-border align-top hover:bg-muted">
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <TickerLink ticker={row.ticker} companyName={row.companyName} />
                  {row.bipartisanBuying ? (
                    <span title="Both parties net buyers" className="text-[0.6rem] text-primary">
                      ◆
                    </span>
                  ) : null}
                  <ReportChips signals={reportSignalsMap.get(row.ticker)} />
                </div>
                {row.sector ? (
                  <div className="mt-0.5 truncate text-[0.62rem] text-muted-foreground">{row.sector}</div>
                ) : null}
              </td>
              <td className="px-2 py-1.5 text-right">
                <ConvictionBadge
                  score={convictionMap.get(row.ticker)?.score ?? null}
                  breakdown={convictionMap.get(row.ticker)?.breakdown ?? []}
                />
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{row.trades}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                <span className="text-profit">{row.buys}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-loss">{row.sells}</span>
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right font-mono tabular-nums font-semibold",
                  row.netTrades > 0 && "text-profit",
                  row.netTrades < 0 && "text-loss",
                )}
              >
                {row.netTrades > 0 ? `+${row.netTrades}` : row.netTrades}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{row.politicians}</td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right font-mono tabular-nums",
                  row.netUsd > 0 && "text-profit",
                  row.netUsd < 0 && "text-loss",
                )}
              >
                {formatSignedMoney(row.netUsd)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{money(row.grossUsd)}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                {row.demBuys}/{row.demSells}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                {row.repBuys}/{row.repSells}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                {row.houseTrades}/{row.senateTrades}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                {row.leadershipTrades > 0 ? (
                  <span className="text-primary">{row.leadershipTrades}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                {row.avgDisclosureLagDays}d
              </td>
              <td className="px-2 py-1.5 font-mono tabular-nums text-muted-foreground">
                {dateText(row.latestTransactionDate)}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {row.topTraders.length > 0 ? row.topTraders.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[0.66rem] text-muted-foreground">
        ◆ = both parties are net buyers. b/s = buy / sell trade counts. H/S = House / Senate trades.
        Lead = trades by committee chairs or ranking members.
      </p>
    </section>
  );
}

function HighlightCard({
  label,
  row,
  metric,
  tone,
  icon: Icon,
}: {
  label: string;
  row: CongressTradeScreenRow | null;
  metric: (row: CongressTradeScreenRow) => string;
  tone: "positive" | "negative" | "accent";
  icon: typeof TrendingUp;
}) {
  return (
    <section className="qq-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="data-label">{label}</div>
        <Icon
          className={cn(
            "size-4",
            tone === "positive" && "text-profit",
            tone === "negative" && "text-loss",
            tone === "accent" && "text-primary",
          )}
        />
      </div>
      {row ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/analysis/stocks/${row.ticker}`}
              className="font-mono text-sm font-bold text-sky-400 hover:underline"
            >
              ${row.ticker}
            </Link>
            <span
              className={cn(
                "font-mono tabular-nums text-sm font-semibold",
                tone === "positive" && "text-profit",
                tone === "negative" && "text-loss",
                tone === "accent" && "text-primary",
              )}
            >
              {metric(row)}
            </span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {row.companyName ?? "Unknown issuer"} · {row.politicians} politicians · {row.trades} trades
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No rows</p>
      )}
    </section>
  );
}

function CongressTradesFallback() {
  return (
    <main className="qq-page">
      <div className="qq-panel h-32 shimmer" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="qq-panel h-20 shimmer" />
        ))}
      </div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="qq-panel h-[640px] shimmer" />
        <div className="qq-panel h-[420px] shimmer" />
      </div>
    </main>
  );
}
