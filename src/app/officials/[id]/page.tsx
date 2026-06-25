import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";

import { MetricTile } from "@/components/metric-tile";
import { PartyBadge, TradeTypeBadge } from "@/components/trade-badges";
import { Sparkline } from "@/components/charts/terminal-charts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SignalPanelHeader } from "@/components/analysis/market-signal-ui";
import { applyCacheLife } from "@/lib/cache";
import { compactDate, formatMoney } from "@/lib/format";
import { getOfficialById } from "@/lib/queries/officialDetail";
import type {
  OfficialTradeRow,
  TickerConcentration,
} from "@/lib/queries/officialDetail";
import { cn } from "@/lib/utils";

// ── Metadata ───────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  "use cache";
  applyCacheLife("minutes");

  const { id } = await params;
  const data = await getOfficialById(Number(id));
  if (!data) return { title: "Official Not Found" };
  return {
    title: `${data.profile.name}`,
    description: `Trading profile for ${data.profile.role} ${data.profile.name}. ${data.stats.totalTrades} trades, ${formatMoney(data.stats.totalVolume)} estimated volume.`,
  };
}

// ── Page ────────────────────────────────────────────────────────────────

export default function OfficialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageFallback />}>
      {params.then(({ id }) => (
        <OfficialDetailContent id={id} />
      ))}
    </Suspense>
  );
}

async function OfficialDetailContent({ id }: { id: string }) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const data = await getOfficialById(numericId);
  if (!data) notFound();

  const { profile, stats, trades, topTickers, sparkline } = data;

  return (
    <main className="qq-page">
      <Button nativeButton={false} variant="ghost" render={<Link href="/datasets/executive-officials" />}>
        <ArrowLeft className="size-4" />
        Back to officials
      </Button>

      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div className="absolute -left-20 top-0 h-44 w-[440px] bg-primary/10 blur-3xl" />
        <div className="absolute right-8 top-6 h-28 w-[300px] bg-primary/8 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row">
            <OfficialAvatar name={profile.name} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {profile.party ? <PartyBadge party={profile.party} /> : null}
                {profile.level ? <span className="data-label">{profile.level}</span> : null}
                {profile.agency ? <span className="data-label">{profile.agency}</span> : null}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {profile.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {profile.role}
                {profile.filingType ? ` · ${profile.filingType}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {profile.tookOfficeDate ? (
                  <ProfileFact label="Took office" value={compactDate(profile.tookOfficeDate)} />
                ) : null}
                {profile.departedDate ? (
                  <ProfileFact label="Departed" value={compactDate(profile.departedDate)} />
                ) : null}
                {profile.mostRecentFilingDate ? (
                  <ProfileFact
                    label="Last filing"
                    value={compactDate(profile.mostRecentFilingDate)}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-w-[220px] rounded border border-border bg-muted p-3">
            <div className="data-label">Trading activity</div>
            <Sparkline data={sparkline} color="#22D3EE" />
            <div className="mt-2 flex items-center gap-1.5">
              <CalendarDays className="size-3 text-muted-foreground" />
              <span className="font-mono text-[0.62rem] text-muted-foreground">
                {stats.firstTradeDate
                  ? `${compactDate(stats.firstTradeDate)} — ${compactDate(stats.latestTradeDate!)}`
                  : "No trades"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Total Trades"
          value={stats.totalTrades}
          icon="landmark"
          accent="cyan"
          delta={`${stats.uniqueTickers} unique tickers`}
        />
        <MetricTile
          label="Est. Volume"
          value={stats.totalVolume}
          formatted={formatMoney(stats.totalVolume)}
          icon="dollars"
          accent="positive"
          delta="Minimum disclosed"
        />
        <MetricTile
          label="Buys"
          value={stats.buyCount}
          icon="up"
          accent="positive"
          delta="Purchase disclosures"
        />
        <MetricTile
          label="Sells"
          value={stats.sellCount}
          icon="down"
          accent="red"
          delta="Sale disclosures"
        />
        <MetricTile
          label="Late Filings"
          value={stats.lateFilingCount}
          icon="activity"
          accent={stats.lateFilingCount > 0 ? "red" : "cyan"}
          delta="Past statutory window"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="qq-panel overflow-hidden">
          <SignalPanelHeader
            title="Top Holdings"
            subtitle="Most traded tickers by volume"
            source="database"
          />
          <TopTickersList tickers={topTickers} />
        </div>

        <div className="qq-panel overflow-hidden">
          <SignalPanelHeader
            title="Trade History"
            subtitle={`${trades.length} disclosures, newest first`}
            source="database"
          />
          <TradeHistoryTable trades={trades} />
        </div>
      </section>
    </main>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────

function OfficialAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="grid size-28 place-items-center rounded-lg border border-border bg-gradient-to-br from-primary/30 via-primary/10 to-muted font-mono text-3xl font-extrabold text-foreground">
      {initials}
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em]">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-foreground">{value}</span>
    </span>
  );
}

// ── Top tickers sidebar ────────────────────────────────────────────────

function TopTickersList({ tickers }: { tickers: TickerConcentration[] }) {
  if (!tickers.length) {
    return (
      <div className="grid place-items-center px-6 py-12 text-center">
        <div className="empty-orb mb-4 size-16 rounded-full" />
        <h3 className="font-semibold">No trades</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This official has no recorded trades with a ticker.
        </p>
      </div>
    );
  }

  const maxVolume = tickers[0]?.totalVolume ?? 1;

  return (
    <div className="divide-y divide-border">
      {tickers.map((t, i) => {
        const barPct = Math.max(4, (t.totalVolume / maxVolume) * 100);
        return (
          <div
            key={t.ticker}
            className="relative px-4 py-3 transition hover:bg-muted"
          >
            <div
              className="absolute inset-y-0 left-0 opacity-[0.07]"
              style={{
                width: `${barPct}%`,
                background: "linear-gradient(90deg, #22D3EE, transparent)",
              }}
            />
            <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <span className="qq-rank">{i + 1}</span>
              <div className="min-w-0">
                <Link
                  href={`/analysis/stocks/${t.ticker}`}
                  className="group inline-flex items-center gap-1.5 transition hover:text-sky-300"
                >
                  <span className="font-mono text-sm font-bold text-sky-400">
                    ${t.ticker}
                  </span>
                  <ArrowUpRight className="size-3 text-muted-foreground transition group-hover:text-sky-300" />
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  {t.buyCount > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[0.62rem] text-profit">
                      <TrendingUp className="size-2.5" />
                      {t.buyCount}
                    </span>
                  )}
                  {t.sellCount > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[0.62rem] text-loss">
                      <TrendingDown className="size-2.5" />
                      {t.sellCount}
                    </span>
                  )}
                  <span className="font-mono text-[0.62rem] text-muted-foreground">
                    {t.tradeCount} trades
                  </span>
                </div>
              </div>
              <div className="text-right font-mono text-sm font-semibold">
                {formatMoney(t.totalVolume)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Trade history table ────────────────────────────────────────────────

function TradeHistoryTable({ trades }: { trades: OfficialTradeRow[] }) {
  if (!trades.length) {
    return (
      <div className="grid place-items-center px-6 py-12 text-center">
        <div className="empty-orb mb-4 size-16 rounded-full" />
        <h3 className="font-semibold">No trade history</h3>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-[0.82rem]">
        <TableHeader>
          <TableRow className="border-border bg-muted hover:bg-muted">
            <TableHead className="data-label h-9">Ticker</TableHead>
            <TableHead className="data-label">Type</TableHead>
            <TableHead className="data-label text-right">Amount</TableHead>
            <TableHead className="data-label">Trade Date</TableHead>
            <TableHead className="data-label">Asset</TableHead>
            <TableHead className="data-label text-right">Late</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.id} className="row-stripe">
              <TableCell>
                {trade.ticker ? (
                  <Link
                    href={`/analysis/stocks/${trade.ticker}`}
                    className="group inline-flex items-center gap-1.5 transition hover:text-sky-300"
                  >
                    <span className="font-mono text-xs font-bold text-sky-400">${trade.ticker}</span>
                    <ArrowUpRight className="size-3 shrink-0 text-muted-foreground transition group-hover:text-sky-300" />
                  </Link>
                ) : (
                  <span className="font-mono text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <TradeTypeBadge type={trade.transactionType} />
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {trade.amountRange}
              </TableCell>
              <TableCell className="font-mono text-[0.72rem] text-muted-foreground">
                {compactDate(trade.transactionDate)}
              </TableCell>
              <TableCell
                className="max-w-[280px] truncate text-[0.72rem] text-muted-foreground"
                title={trade.assetDescription}
              >
                {trade.assetDescription}
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-mono text-[0.72rem]",
                    trade.lateFilingFlag ? "text-loss" : "text-muted-foreground/40",
                  )}
                >
                  {trade.lateFilingFlag ? "Late" : "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Fallback ────────────────────────────────────────────────────────────

function PageFallback() {
  return (
    <main className="qq-page">
      <div className="qq-panel h-48 shimmer" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="qq-panel h-24 shimmer" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="qq-panel h-[500px] shimmer" />
        <div className="qq-panel h-[500px] shimmer" />
      </div>
    </main>
  );
}
