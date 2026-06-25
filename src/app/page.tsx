import Link from "next/link";
import { connection } from "next/server";
import {
  Clock3,
  Database,
  Landmark,
  Search,
  TrendingUp,
} from "lucide-react";

import { SectorMomentumChart } from "@/components/charts/sector-momentum-chart";
import { PartyBadge, TradeTypeBadge } from "@/components/trade-badges";
import { TradeBranchBadge } from "@/components/trade-branch-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { getSqlFirstDashboardData } from "@/lib/queries/appData";

export const metadata = {
  title: {
    absolute: "Dashboard",
  },
};

export default async function DashboardPage() {
  await connection();

  const data = await getSqlFirstDashboardData();

  return (
    <main className="qq-page">
      {/* Disclaimer Banner */}
      <section className="rounded border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
        <div className="flex items-center gap-2 font-medium">
          <span>⚠️</span>
          <span className="font-mono text-xs uppercase tracking-wider font-semibold">Demo Mode: Mock Data Only</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This platform is a simulated preview. All data points, trade logs, figures, and dates are entirely fictionalized mock values. 
          None of the information presented on this site constitutes financial, investment, tax, or legal advice.
        </p>
      </section>

      {/* 1. Market Pulse / Hero */}
      <section className="qq-panel overflow-hidden">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
          <div>
            <div className="ledger-stamp inline-flex h-6 items-center border-primary/40 bg-primary/10 px-2 text-[0.62rem] font-semibold text-primary">
              Live Market Pulse
            </div>
            <h1 className="ledger-page-title mt-2">
              U.S. Congressional Trade Signals
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              Monitor public congressional and executive trade disclosures. A simplified factual database preview.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href="/analysis/congress-trades" />}>
                All disclosures
              </Button>
              <Button nativeButton={false} variant="outline" render={<Link href="/analysis/stocks" />}>
                Stocks List
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            <CompactMetric label="New Filings Today" value={data.alerts.newFilingsToday.toLocaleString()} />
            <CompactMetric label="Last Sync" value={formatSyncTime(data.freshness.lastRunAt)} />
            <CompactMetric label="30d Filings" value={data.recentTradesCount.toLocaleString()} />
            <CompactMetric label="30d Vol" value={formatMoney(data.recentVolume)} />
          </div>
        </div>
      </section>

      {/* Congress Flow group header */}
      <div className="ledger-section-line mt-2 pb-2">
        <div className="flex items-center gap-2 px-1">
          <Landmark className="size-5 text-primary" />
          <h2 className="text-base font-semibold tracking-tight text-foreground">Congress Flow</h2>
        </div>
      </div>

      {/* Trader Command Center */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="qq-panel overflow-hidden">
          <div className="qq-section-header">
            <div>
              <h2 className="qq-section-title">Fresh Disclosure Tape</h2>
              <p className="qq-section-subtitle">Sorted by public filing date</p>
            </div>
            <Clock3 className="size-4 text-primary" />
          </div>
          <Table className="text-[0.82rem]">
            <TableHeader>
              <TableRow className="border-border bg-muted hover:bg-muted">
                <TableHead className="data-label h-9">Filed</TableHead>
                <TableHead className="data-label">Ticker</TableHead>
                <TableHead className="data-label">Action</TableHead>
                <TableHead className="data-label">Politician</TableHead>
                <TableHead className="data-label text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.latestTrades.length === 0 ? (
                <EmptyTableRow colSpan={5} label="No fresh disclosures found." />
              ) : data.latestTrades.slice(0, 10).map((trade) => (
                <TableRow key={trade.id} className="row-stripe border-border hover:bg-muted">
                  <TableCell className="font-mono text-[0.72rem] text-muted-foreground">
                    {formatDate(trade.filedDate)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/report/${trade.ticker.toLowerCase()}`} className="font-mono text-xs font-bold text-primary transition hover:text-primary/80">
                      ${trade.ticker}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TradeTypeBadge type={trade.tradeType} />
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-2">
                      <span className="max-w-[190px] truncate">{trade.politicianName}</span>
                      <PartyBadge party={trade.party} />
                      <TradeBranchBadge branch={trade.branch} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{trade.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Sector Momentum */}
        <div className="qq-panel">
          <div className="qq-section-header">
            <div>
              <h2 className="qq-section-title">Congress Sector Flow</h2>
              <p className="qq-section-subtitle">Buy minus sell using minimum disclosed dollars</p>
            </div>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="p-4">
            <SectorMomentumChart data={data.sectorMomentum} />
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SearchPanel
          icon={Search}
          title="Politician Search"
          description="View congressional trading activity by member name."
          placeholder="Enter name..."
          action="/trades"
        />
        <SearchPanel
          icon={Database}
          title="Stock Search"
          description="View congressional trading activity by ticker or company."
          placeholder="Enter ticker..."
          action="/analysis/stocks"
        />
      </section>
    </main>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="qq-metric p-3">
      <div className="text-[0.68rem] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center font-mono text-xs text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function SearchPanel({
  icon: Icon,
  title,
  description,
  placeholder,
  action,
}: {
  icon: typeof Search;
  title: string;
  description: string;
  placeholder: string;
  action: string;
}) {
  return (
    <div className="qq-panel p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="qq-section-title">{title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <form action={action} method="GET" className="mt-4 flex gap-2">
        <input
          name="q"
          type="text"
          placeholder={placeholder}
          className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <Button nativeButton type="submit">
          Search
        </Button>
      </form>
    </div>
  );
}

function formatSyncTime(date: Date | null | string): string {
  if (!date) return "never";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "never";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string | null | Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
