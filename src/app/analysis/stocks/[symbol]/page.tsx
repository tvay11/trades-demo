import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Database,
  LineChart,
  Newspaper,
  Percent,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Suspense } from "react";

import { TickerPriceChart } from "@/components/charts/TickerPriceChart";
import { PartyBadge, TradeTypeBadge } from "@/components/trade-badges";
import { TradeBranchBadge } from "@/components/trade-branch-badge";
import { Button } from "@/components/ui/button";
import { WatchlistButton } from "@/components/watchlist-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DownloadCsvButton } from "@/components/analysis/DownloadCsvButton";
import { formatMoney } from "@/lib/format";
import type { EarningsEvent } from "@/lib/queries/earnings";
import {
  getStockAnalysis,
  type AnalysisTimelineEvent,
  type PoliticianActivity,
  type StockInsiderTrade,
  type StockSourceRows,
} from "@/lib/queries/stockAnalysis";
import { stockTradeFacts, type StockTradeFacts } from "@/lib/queries/factMetrics";
import { isTickerWatched } from "@/lib/queries/watchlist";
import type { TickerCongressTrade } from "@/lib/queries/tickerDetail";
import { getReport } from "@/lib/ledger/getReport";
import { getExcessWindows } from "@/lib/queries/excessWindows";
import { getTrackRecords, type StoredTrackRecord } from "@/lib/queries/trackRecords";
import { getEdgarFundamentals } from "@/lib/queries/edgarFundamentals";
import { cn } from "@/lib/utils";
import { CreateReportButton } from "./CreateReportButton";
import { FundamentalsCard } from "./FundamentalsCard";
import { ReportHeroStrip } from "./ReportHeroStrip";
import { SignalMiniStrips } from "./SignalMiniStrips";
import { createReportAction } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const ticker = symbol.trim().toUpperCase();

  return {
    title: ticker ? `${ticker} Stock Analysis` : "Stock Analysis",
  };
}

export default function StockAnalysisPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  return (
    <Suspense fallback={<StockAnalysisFallback />}>
      {params.then(({ symbol }) => (
        <StockAnalysisContent symbol={symbol} />
      ))}
    </Suspense>
  );
}

async function StockAnalysisContent({
  symbol,
}: {
  symbol: string;
}) {
  const analysis = await getStockAnalysis(symbol);
  const { detail } = analysis;
  const facts = stockTradeFacts(detail.congressTrades);
  const latestClose = detail.congressTrades[0]?.latestClose ?? null;

  const politicianNames = analysis.politicianLeaders.map((l) => l.politicianName);

  const [watched, report, excess, trackRecords, fundamentals] = await Promise.all([
    isTickerWatched(detail.stock.ticker),
    getReport(detail.stock.ticker),
    getExcessWindows(detail.stock.ticker),
    getTrackRecords(politicianNames),
    getEdgarFundamentals(detail.stock.ticker),
  ]);

  return (
    <main className="qq-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant="ghost" render={<Link href="/datasets" />}>
            <ArrowLeft className="size-4" />
            Data tables
          </Button>
          <WatchlistButton ticker={detail.stock.ticker} watched={watched} />
          {!report && (
            <>
              <CreateReportButton ticker={detail.stock.ticker} action={createReportAction} />
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={`/report/${detail.stock.ticker}`} />}
              >
                <Newspaper className="size-4" />
                View Report
              </Button>
            </>
          )}
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a
                href={yahooFinanceHref(detail.stock.ticker)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Yahoo Finance
            <ArrowUpRight className="size-4" />
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a
                href={yahooOptionsHref(detail.stock.ticker)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Options
            <ArrowUpRight className="size-4" />
          </Button>
          <Button nativeButton={false} variant="ghost" render={<a href="#lens-chart" />}>
            Chart
          </Button>
          <Button nativeButton={false} variant="ghost" render={<a href="#lens-trades" />}>
            Trades
          </Button>
          <Button nativeButton={false} variant="ghost" render={<a href="#lens-sources" />}>
            Sources
          </Button>
        </div>
        <form action="/analysis/stocks" className="flex w-full gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="stock-analysis-symbol">
            Ticker
          </label>
          <input
            id="stock-analysis-symbol"
            name="q"
            defaultValue={detail.stock.ticker}
            className="h-8 min-w-0 flex-1 rounded border border-border bg-card px-2.5 font-mono text-sm uppercase outline-none transition placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/15 sm:w-40"
            placeholder="NVDA"
          />
          <Button type="submit" size="sm">
            <Search className="size-4" />
            Analyze
          </Button>
        </form>
      </div>

      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="qq-section-subtitle text-sky-400">Stock intelligence terminal</div>
            <h1 className="mt-3 flex flex-wrap items-baseline gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              <span className="font-mono text-sky-400">${detail.stock.ticker}</span>
            </h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {detail.stock.sector ? <span className="qq-metric py-1">{detail.stock.sector}</span> : null}
              {detail.stock.industry ? <span className="qq-metric py-1">{detail.stock.industry}</span> : null}
              {detail.stock.exchange ? <span className="qq-metric py-1">{detail.stock.exchange}</span> : null}
              <span className="qq-metric py-1">
                Source: {sourceLabel(detail.source)}
              </span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Latest close" value={priceText(latestClose)} />
              <Metric
                label="Market cap"
                value={detail.stock.marketCap == null ? "-" : formatMoney(detail.stock.marketCap)}
              />
              <Metric label="Next earnings" value={earningsDateText(analysis.earnings)} />
              <Metric label="Congress trades" value={detail.summary.tradeCount.toLocaleString()} />
              <Metric label="Buy / sell" value={`${detail.summary.buyCount}/${detail.summary.sellCount}`} />
            </div>
          </div>
          <TickerFactSummary facts={facts} />
        </div>
      </section>

      <ReportHeroStrip
        report={report}
        now={new Date()}
        actions={
          report ? (
            <>
              <CreateReportButton ticker={detail.stock.ticker} action={createReportAction} />
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={`/report/${detail.stock.ticker}`} />}
              >
                <Newspaper className="size-4" />
                View Report
              </Button>
            </>
          ) : undefined
        }
      />
      <SignalMiniStrips report={report} />

      <EarningsPanel earnings={analysis.earnings} />

      <FundamentalsCard fundamentals={fundamentals} />

      <section id="lens-chart" className="qq-panel">
        <PanelHeader
          icon={<LineChart className="size-4 text-primary" />}
          title="Price Chart With Political Trade Markers"
          subtitle="Daily OHLCV from TickerPriceCache/Yahoo with congressional trade overlays"
        />
        <div className="p-3">
          <TickerPriceChart
            bars={detail.bars}
            trades={analysis.overlays}
            ticker={detail.stock.ticker}
          />
        </div>
      </section>

      <section className="qq-panel">
        <PanelHeader
          icon={<Percent className="size-4 text-primary" />}
          title="Disclosure Return Windows"
          subtitle={
            excess.avgExcess30 != null
              ? "Average excess return vs SPY after the public filing date"
              : "Average returns measured after the public filing date"
          }
        />
        <div className="grid gap-2 p-3 sm:grid-cols-3 xl:grid-cols-6">
          {excess.avgExcess30 != null ? (
            <>
              <ReturnMetric
                label="7d avg (excess)"
                value={excess.avgExcess7}
                title={facts.averageReturn7d != null ? `Raw: ${percentText(facts.averageReturn7d)}` : undefined}
              />
              <ReturnMetric
                label="30d avg (excess)"
                value={excess.avgExcess30}
                title={facts.averageReturn30d != null ? `Raw: ${percentText(facts.averageReturn30d)}` : undefined}
              />
              <ReturnMetric
                label="90d avg (excess)"
                value={excess.avgExcess90}
                title={facts.averageReturn90d != null ? `Raw: ${percentText(facts.averageReturn90d)}` : undefined}
              />
              <MiniFact
                label="30d positive (excess)"
                value={excess.positive30Pct != null ? plainPercentText(excess.positive30Pct) : "-"}
              />
              <MiniFact label="30d samples" value={excess.samples30.toLocaleString()} />
            </>
          ) : (
            <>
              <ReturnMetric label="7d avg" value={facts.averageReturn7d} />
              <ReturnMetric label="30d avg" value={facts.averageReturn30d} />
              <ReturnMetric label="90d avg" value={facts.averageReturn90d} />
              <MiniFact label="30d positive" value={plainPercentText(facts.positiveReturn30dPercent)} />
              <MiniFact
                label="Committee rows"
                value={`${facts.committeeRelevantTradeCount}/${facts.tradeCount}`}
              />
            </>
          )}
          <div className="rounded border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground sm:col-span-3 xl:col-span-1">
            Return windows use the close on or after the disclosure date.
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <PoliticianLeaderboard leaders={analysis.politicianLeaders} trackRecords={trackRecords} />
        <ActivityTimeline events={analysis.timeline} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <CoveragePanel rows={detail.alternativeData} politicalBeta={analysis.politicalBeta} />
        <CongressTradeTable trades={detail.congressTrades} ticker={detail.stock.ticker} id="lens-trades" />
      </section>

      <InsiderTradeTable trades={analysis.insiderTrades} ticker={detail.stock.ticker} />

      <div id="lens-sources">
        <SourceDataPanels rows={analysis.sourceRows} ticker={detail.stock.ticker} />
      </div>

      <section className="qq-panel p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 text-primary" />
          <p className="text-sm leading-6 text-muted-foreground">
            The trade price is estimated from the daily close on or before the transaction date.
            Congressional filings disclose ranges and dates, not exact fills, so this page is
            designed for research triage rather than execution-grade attribution.
          </p>
        </div>
      </section>
    </main>
  );
}

function EarningsPanel({
  earnings,
}: {
  earnings: EarningsEvent | null;
}) {
  return (
    <section className="qq-panel overflow-hidden">
      <PanelHeader
        icon={<CalendarClock className="size-4 text-primary" />}
        title="Earnings Calendar"
        subtitle="Yahoo calendar events cached in SQL; upcoming dates may be estimates"
      />
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="Report date" value={earningsDateText(earnings)} />
        <MiniFact label="Call date" value={earnings?.earningsCallDate ? dateText(earnings.earningsCallDate) : "-"} />
        <MiniFact label="Status" value={earnings?.earningsDate ? (earnings.isEstimate ? "Expected" : "Confirmed") : "-"} />
        <MiniFact label="EPS estimate" value={epsEstimateText(earnings)} />
        <MiniFact label="Revenue estimate" value={revenueEstimateText(earnings)} />
      </div>
    </section>
  );
}

function TickerFactSummary({ facts }: { facts: StockTradeFacts }) {
  return (
    <div className="qq-metric p-4">
      <div className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
        Raw trade mix
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniFact label="Buy rows" value={`${facts.buyCount}/${facts.tradeCount}`} />
        <MiniFact label="Sell rows" value={`${facts.sellCount}/${facts.tradeCount}`} />
        <MiniFact label="Buy #" value={plainPercentText(facts.buyCountPercent)} />
        <MiniFact label="Buy $" value={plainPercentText(facts.buyDollarPercent)} />
        <MiniFact label="Total $" value={formatMoney(facts.estimatedVolume)} />
        <MiniFact
          label="Committee"
          value={plainPercentText(facts.committeeRelevantTradePercent)}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        These are raw SQL summaries for the ticker, not a weighted rating.
      </p>
    </div>
  );
}

function PoliticianLeaderboard({
  leaders,
  trackRecords,
}: {
  leaders: PoliticianActivity[];
  trackRecords: Map<string, StoredTrackRecord>;
}) {
  return (
    <section className="qq-panel overflow-hidden">
      <PanelHeader
        icon={<Users className="size-4 text-primary" />}
        title="Who Is Trading It"
        subtitle="Ranked by minimum disclosed volume"
      />
      {leaders.length ? (
        <Table className="text-[0.82rem]">
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead className="data-label h-9">Politician</TableHead>
              <TableHead className="data-label text-right">Trades</TableHead>
              <TableHead className="data-label">Flow</TableHead>
              <TableHead className="data-label text-right">Volume</TableHead>
              <TableHead className="data-label text-right">Avg return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.map((leader) => {
              const rec = trackRecords.get(leader.politicianName);
              return (
                <TableRow key={leader.politicianName} className="row-stripe">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{leader.politicianName}</span>
                      {leader.party === "D" || leader.party === "R" ? (
                        <PartyBadge party={leader.party} />
                      ) : null}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.68rem] text-muted-foreground">
                      {leader.state ?? "-"} · latest filing {dateText(leader.latestDisclosureDate)}
                    </div>
                    {rec ? (
                      <div className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground/70">
                        {rec.hitRate30.toFixed(0)}% hit · {rec.avgExcess30 >= 0 ? "+" : ""}
                        {rec.avgExcess30.toFixed(1)}% x30 · n={rec.samples}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums text-right font-mono">{leader.tradeCount}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded border px-2 py-1 font-mono text-[0.66rem]",
                        leader.netFlowLabel === "Buying"
                          ? "border-profit/25 bg-profit/10 text-profit"
                          : leader.netFlowLabel === "Selling"
                            ? "border-loss/25 bg-loss/10 text-loss"
                            : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {leader.netFlowLabel}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-right font-mono">
                    {formatMoney(leader.totalEstimatedVolume)}
                  </TableCell>
                  <TableCell className={cn("tabular-nums text-right font-mono", returnClass(leader.averageReturn))}>
                    {percentText(leader.averageReturn)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyPanel title="No politician activity" body="No congressional rows exist for this ticker." />
      )}
    </section>
  );
}

function ActivityTimeline({ events }: { events: AnalysisTimelineEvent[] }) {
  return (
    <section className="qq-panel">
      <PanelHeader
        icon={<Activity className="size-4 text-primary" />}
        title="Alternative Data Timeline"
        subtitle="Latest events joined across the SQL tables"
      />
      <div className="max-h-[430px] space-y-2 overflow-y-auto p-3">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="qq-metric flex gap-3">
              <div
                className={cn(
                  "mt-1 size-2.5 shrink-0 rounded-full shadow-[0_0_18px_currentColor]",
                  event.tone === "buy"
                    ? "bg-profit text-profit"
                    : event.tone === "sell"
                      ? "bg-loss text-loss"
                      : event.tone === "positive"
                        ? "bg-primary text-primary"
                        : "bg-muted-foreground text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-medium">{event.label}</div>
                  <div className="font-mono text-[0.68rem] text-muted-foreground">
                    {dateText(event.date)}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono uppercase">
                    {event.source}
                  </span>
                  <span className="truncate">{event.detail}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyPanel title="No events yet" body="Backfill more sources to populate this timeline." />
        )}
      </div>
    </section>
  );
}

function CoveragePanel({
  rows,
  politicalBeta,
}: {
  rows: Array<{ label: string; count: number }>;
  politicalBeta: number | null;
}) {
  return (
    <section className="qq-panel">
      <PanelHeader
        icon={<Database className="size-4 text-primary" />}
        title="Source Coverage"
        subtitle="Rows found for this ticker"
      />
      <div className="grid grid-cols-2 gap-2 p-3">
        {rows.map((row) => (
          <Link
            key={row.label}
            href={datasetHref(row.label)}
            className="qq-metric transition hover:border-primary/25 hover:bg-primary/[0.035]"
          >
            <div className="data-label">{row.label}</div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="font-mono tabular-nums text-lg font-semibold">{row.count}</span>
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
        <div className="qq-metric col-span-2">
          <div className="data-label">Latest political beta</div>
          <div className="mt-1 font-mono tabular-nums text-lg font-semibold">
            {politicalBeta == null ? "-" : politicalBeta.toFixed(2)}
          </div>
        </div>
      </div>
    </section>
  );
}

function CongressTradeTable({
  trades,
  ticker,
  id,
}: {
  trades: TickerCongressTrade[];
  ticker: string;
  id?: string;
}) {
  const ROW_LIMIT = 14;
  const visible = trades.slice(0, ROW_LIMIT);
  const hiddenCount = Math.max(0, trades.length - ROW_LIMIT);
  const csvRows: (string | number | null)[][] = visible.map((t) => [
    t.politicianName,
    t.party ?? null,
    t.state ?? null,
    t.action,
    t.transactionDate ? t.transactionDate.toISOString().slice(0, 10) : null,
    t.amountRangeRaw ?? t.amountMinimum,
    t.priceAtTrade,
    t.returnSinceTrade,
  ]);
  return (
    <section id={id} className="qq-panel overflow-hidden">
      <div className="flex items-start justify-between gap-2 pr-3">
        <PanelHeader
          icon={<BarChart3 className="size-4 text-primary" />}
          title={`Disclosed Trades In $${ticker}`}
          subtitle={
            hiddenCount > 0
              ? `Most recent ${ROW_LIMIT} of ${trades.length} — estimated trade price and current return`
              : "Estimated trade price and current return"
          }
        />
        {trades.length > 0 && (
          <DownloadCsvButton
            filename={`${ticker}-congress-trades.csv`}
            headers={["Politician", "Party", "State", "Action", "Transaction Date", "Amount", "Est. Price", "Return"]}
            rows={csvRows}
          />
        )}
      </div>
      {trades.length ? (
        <Table className="text-[0.82rem]">
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead className="data-label h-9">Politician</TableHead>
              <TableHead className="data-label">Type</TableHead>
              <TableHead className="data-label">Transaction</TableHead>
              <TableHead className="data-label text-right">Amount</TableHead>
              <TableHead className="data-label text-right">Est. price</TableHead>
              <TableHead className="data-label text-right">Return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((trade) => (
              <TableRow key={trade.id} className="row-stripe">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{trade.politicianName}</span>
                    {trade.party === "D" || trade.party === "R" ? (
                      <PartyBadge party={trade.party} />
                    ) : null}
                    <TradeBranchBadge branch={trade.branch} />
                  </div>
                  <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                    {trade.branch === "executive"
                      ? trade.agency ?? "Executive Branch"
                      : trade.state ?? "-"}
                  </div>
                </TableCell>
                <TableCell>
                  <TradeTypeBadge
                    type={
                      trade.action === "buy"
                        ? "Buy"
                        : trade.action === "sell"
                          ? "Sell"
                          : "Exchange"
                    }
                  />
                </TableCell>
                <TableCell className="font-mono text-[0.72rem] text-muted-foreground">
                  {dateText(trade.transactionDate)}
                </TableCell>
                <TableCell className="tabular-nums text-right font-mono">
                  {trade.amountRangeRaw ?? formatMoney(trade.amountMinimum)}
                </TableCell>
                <TableCell className="tabular-nums text-right font-mono">{priceText(trade.priceAtTrade)}</TableCell>
                <TableCell className={cn("tabular-nums text-right font-mono", returnClass(trade.returnSinceTrade))}>
                  {percentText(trade.returnSinceTrade)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyPanel title="No congressional trades" body="This ticker has no congressional trade rows." />
      )}
    </section>
  );
}

type SourceListItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  value?: string;
};

function SourceDataPanels({
  rows,
  ticker,
}: {
  rows: StockSourceRows;
  ticker: string;
}) {
  const sections = [
    {
      title: "Lobbying",
      subtitle: "Latest lobbying disclosures tied to the ticker",
      emptyTitle: "No lobbying rows",
      emptyBody: `No LobbyingDisclosure rows exist for $${ticker}.`,
      items: rows.lobbying.map<SourceListItem>((row) => ({
        id: `lobbying-${row.id}`,
        title: row.client,
        subtitle: row.issue ?? row.registrant,
        meta: [row.filingPeriod, row.filedAt ? `filed ${dateText(row.filedAt)}` : null]
          .filter(Boolean)
          .join(" · "),
        value: moneyOrDash(row.amount),
      })),
    },
    {
      title: "Government Contracts",
      subtitle: "Federal contract rows connected to the ticker",
      emptyTitle: "No contract rows",
      emptyBody: `No GovContract rows exist for $${ticker}.`,
      items: rows.govContracts.map<SourceListItem>((row) => ({
        id: `contract-${row.id}`,
        title: row.agency ?? "Government contract",
        subtitle: row.description ?? row.contractId ?? "Federal award",
        meta: row.awardedAt ? dateText(row.awardedAt) : row.contractId ?? "-",
        value: moneyOrDash(row.amount),
      })),
    },
    {
      title: "Patents",
      subtitle: "Patent filings and grants stored for this ticker",
      emptyTitle: "No patent rows",
      emptyBody: `No Patent rows exist for $${ticker}.`,
      items: rows.patents.map<SourceListItem>((row) => ({
        id: `patent-${row.id}`,
        title: row.title ?? row.patentNumber ?? "Patent activity",
        subtitle: row.inventors ?? row.patentNumber ?? "Patent filing/grant",
        meta: [
          row.filedAt ? `filed ${dateText(row.filedAt)}` : null,
          row.grantedAt ? `granted ${dateText(row.grantedAt)}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "-",
      })),
    },
    {
      title: "13F Holdings",
      subtitle: "Institutional holder rows and reported position size",
      emptyTitle: "No 13F rows",
      emptyBody: `No ThirteenFHolding rows exist for $${ticker}.`,
      items: rows.holdings.map<SourceListItem>((row) => ({
        id: `13f-${row.id}`,
        title: row.filer,
        subtitle: `${numberOrDash(row.shares)} shares · report ${dateText(row.reportDate)}`,
        meta: `filed ${dateText(row.filingDate)}`,
        value: [moneyOrDash(row.value), row.changeShares == null ? null : `${signedNumber(row.changeShares)} sh`]
          .filter(Boolean)
          .join(" · "),
      })),
    },
    {
      title: "Off-Exchange Tape",
      subtitle: "Latest off-exchange and short-volume snapshots",
      emptyTitle: "No tape rows",
      emptyBody: `No OffExchangeActivity rows exist for $${ticker}.`,
      items: rows.offExchange.map<SourceListItem>((row) => ({
        id: `off-${row.id}`,
        title: dateText(row.date),
        subtitle: `dark ${percentOrDash(row.darkPoolPercent)} · short ${percentOrDash(row.shortVolumePercent)}`,
        meta: `short ${numberOrDash(row.shortVolume)} / total ${numberOrDash(row.totalVolume)}`,
      })),
    },
    {
      title: "Attention",
      subtitle: "WSB, Twitter, and Wikipedia rows",
      emptyTitle: "No attention rows",
      emptyBody: `No attention rows exist for $${ticker}.`,
      items: rows.attention.map<SourceListItem>((row) => ({
        id: row.id,
        title: row.source,
        subtitle: row.detail ?? "attention count",
        meta: dateText(row.date),
        value: row.count.toLocaleString(),
      })),
    },
    {
      title: "Political Beta",
      subtitle: "Latest ticker political-beta rows",
      emptyTitle: "No beta rows",
      emptyBody: `No PoliticalBeta rows exist for $${ticker}.`,
      items: rows.politicalBeta.map<SourceListItem>((row) => ({
        id: `beta-${row.id}`,
        title: "Political beta",
        subtitle: row.asOfDate ? dateText(row.asOfDate) : "latest row",
        meta: "Quiver political sensitivity metric",
        value: row.beta.toFixed(2),
      })),
    },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {sections.map((section) => (
        <SourceListCard
          key={section.title}
          title={section.title}
          subtitle={section.subtitle}
          items={section.items}
          emptyTitle={section.emptyTitle}
          emptyBody={section.emptyBody}
        />
      ))}
    </section>
  );
}

function SourceListCard({
  title,
  subtitle,
  items,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  subtitle: string;
  items: SourceListItem[];
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <section className="qq-panel overflow-hidden">
      <PanelHeader
        icon={<Database className="size-4 text-primary" />}
        title={title}
        subtitle={subtitle}
      />
      {items.length ? (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{item.subtitle}</div>
                <div className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground/80">
                  {item.meta}
                </div>
              </div>
              {item.value ? (
                <div className="self-center tabular-nums text-right font-mono text-sm font-semibold">
                  {item.value}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel title={emptyTitle} body={emptyBody} />
      )}
    </section>
  );
}

function InsiderTradeTable({
  trades,
  ticker,
}: {
  trades: StockInsiderTrade[];
  ticker: string;
}) {
  return (
    <section className="qq-panel overflow-hidden">
      <PanelHeader
        icon={<Users className="size-4 text-primary" />}
        title={`Corporate Insider Trades In $${ticker}`}
        subtitle="Latest InsiderTrade rows for this ticker, using Form 4-style fields stored in SQL"
      />
      {trades.length ? (
        <Table className="text-[0.82rem]">
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead className="data-label h-9">Insider</TableHead>
              <TableHead className="data-label">Type</TableHead>
              <TableHead className="data-label">Transaction</TableHead>
              <TableHead className="data-label">Filed</TableHead>
              <TableHead className="data-label text-right">Shares</TableHead>
              <TableHead className="data-label text-right">Price</TableHead>
              <TableHead className="data-label text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id} className="row-stripe">
                <TableCell>
                  <div className="font-medium">{trade.insiderName}</div>
                  <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                    {trade.insiderTitle ?? "Corporate insider"}
                  </div>
                </TableCell>
                <TableCell>
                  <TradeTypeBadge type={insiderBadgeType(trade.action)} />
                </TableCell>
                <TableCell className="font-mono text-[0.72rem] text-muted-foreground">
                  {dateText(trade.transactionDate)}
                </TableCell>
                <TableCell className="font-mono text-[0.72rem] text-muted-foreground">
                  {trade.filingDate ? dateText(trade.filingDate) : "-"}
                </TableCell>
                <TableCell className="tabular-nums text-right font-mono">
                  {trade.shares == null ? "-" : trade.shares.toLocaleString()}
                  {trade.sharesOwnedAfter == null ? null : (
                    <div className="text-[0.68rem] text-muted-foreground">
                      after {trade.sharesOwnedAfter.toLocaleString()}
                    </div>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-right font-mono">{priceText(trade.pricePerShare)}</TableCell>
                <TableCell className="tabular-nums text-right font-mono">
                  {trade.totalValue == null ? "-" : formatMoney(trade.totalValue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyPanel title="No corporate insider trades" body="This ticker has no InsiderTrade rows yet." />
      )}
    </section>
  );
}

function insiderBadgeType(action: StockInsiderTrade["action"]) {
  if (action === "buy") return "Buy";
  if (action === "sell") return "Sell";
  return "Exchange";
}

function PanelHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="qq-section-header">
      <div>
        <h2 className="qq-section-title">{title}</h2>
        <p className="qq-section-subtitle">{subtitle}</p>
      </div>
      {icon}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="qq-metric min-w-0">
      <div className="data-label">{label}</div>
      <div className="mt-1 truncate font-mono tabular-nums text-base font-semibold">{value}</div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card px-2.5 py-2">
      <div className="data-label">{label}</div>
      <div className="mt-1 truncate font-mono tabular-nums text-sm font-semibold">{value}</div>
    </div>
  );
}

function ReturnMetric({ label, value, title }: { label: string; value: number | null; title?: string }) {
  return (
    <div className="rounded border border-border bg-card px-2.5 py-2" title={title}>
      <div className="data-label">{label}</div>
      <div className={cn("mt-1 truncate font-mono tabular-nums text-sm font-semibold", returnClass(value))}>
        {percentText(value)}
      </div>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div className="empty-orb mb-4 size-16 rounded-sm" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function dateText(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function priceText(value: number | null) {
  return value == null ? "-" : `$${value.toFixed(2)}`;
}

function moneyOrDash(value: number | null) {
  return value == null ? "-" : formatMoney(value);
}

function numberOrDash(value: number | null) {
  return value == null ? "-" : value.toLocaleString();
}

function signedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function percentOrDash(value: number | null) {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

function earningsDateText(earnings: EarningsEvent | null) {
  return earnings?.earningsDate ? dateText(earnings.earningsDate) : "-";
}

function epsEstimateText(earnings: EarningsEvent | null) {
  if (!earnings || earnings.epsAverage == null) return "-";
  const avg = `$${earnings.epsAverage.toFixed(2)}`;
  if (earnings.epsLow == null || earnings.epsHigh == null) return avg;
  return `${avg} ($${earnings.epsLow.toFixed(2)}-$${earnings.epsHigh.toFixed(2)})`;
}

function revenueEstimateText(earnings: EarningsEvent | null) {
  if (!earnings || earnings.revenueAverage == null) return "-";
  const avg = formatMoney(earnings.revenueAverage);
  if (earnings.revenueLow == null || earnings.revenueHigh == null) return avg;
  return `${avg} (${formatMoney(earnings.revenueLow)}-${formatMoney(earnings.revenueHigh)})`;
}

function percentText(value: number | null) {
  if (value == null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function plainPercentText(value: number) {
  return `${value.toFixed(1)}%`;
}

function returnClass(value: number | null) {
  if (value == null) return "text-muted-foreground";
  return value >= 0 ? "text-profit" : "text-loss";
}

function datasetHref(label: string) {
  const map: Record<string, string> = {
    "Congress trades": "/datasets/congress-trades",
    "Insider trades": "/datasets/insider-trades",
    Lobbying: "/datasets/lobbying-disclosures",
    "Gov contracts": "/datasets/gov-contracts",
    Patents: "/datasets/patents",
    "Off-exchange": "/datasets/off-exchange-activity",
    "13F holdings": "/datasets/thirteen-f-holdings",
    "Social mentions": "/datasets/twitter-mentions",
    "Wikipedia views": "/datasets/wikipedia-views",
    "Political beta": "/datasets/political-beta",
  };

  return map[label] ?? "/datasets";
}

function sourceLabel(source: "database" | "database-error" | "empty") {
  if (source === "database") return "SQL + price cache";
  if (source === "database-error") return "SQL error";
  return "No SQL rows";
}

function yahooTickerSlug(ticker: string) {
  // Yahoo uses dashes where exchanges use dots (e.g. BRK.B → BRK-B).
  return encodeURIComponent(ticker.trim().toUpperCase().replace(/\./g, "-"));
}

function yahooFinanceHref(ticker: string) {
  return `https://finance.yahoo.com/quote/${yahooTickerSlug(ticker)}`;
}

function yahooOptionsHref(ticker: string) {
  return `https://finance.yahoo.com/quote/${yahooTickerSlug(ticker)}/options`;
}

function StockAnalysisFallback() {
  return (
    <main className="qq-page">
      <div className="qq-panel h-52 shimmer" />
      <div className="qq-panel h-[640px] shimmer" />
      <div className="qq-panel h-32 shimmer" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="qq-panel h-[430px] shimmer" />
        <div className="qq-panel h-[430px] shimmer" />
      </div>
    </main>
  );
}
