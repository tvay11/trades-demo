import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Database,
  GitCompareArrows,
  Landmark,
  Radio,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

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
import type { Party, TradeType } from "@/lib/types";

export const metadata = {
  title: "Demo",
  description: "A mock-data preview of the congressional and executive trade tracker.",
};

const metrics = [
  { label: "Demo filings", value: "1,284", detail: "Congress + executive sample" },
  { label: "Min disclosed", value: "$148.2M", detail: "Conservative lower bound" },
  { label: "Active tickers", value: "214", detail: "Mock 30d universe" },
  { label: "High relevance", value: "42", detail: "Committee or agency overlap" },
];

const trades: Array<{
  id: string;
  filed: string;
  actor: string;
  party: Party | null;
  branch: "congress" | "executive";
  ticker: string;
  issuer: string;
  action: TradeType;
  range: string;
  minDisclosed: string;
}> = [
  {
    id: "demo-1",
    filed: "May 18",
    actor: "Nancy Pelosi",
    party: "D",
    branch: "congress",
    ticker: "NVDA",
    issuer: "NVIDIA Corporation",
    action: "Buy",
    range: "$1M-$5M",
    minDisclosed: "$1.0M",
  },
  {
    id: "demo-2",
    filed: "May 17",
    actor: "Debbie Wasserman Schultz",
    party: "D",
    branch: "congress",
    ticker: "XOM",
    issuer: "Exxon Mobil Corporation",
    action: "Sell",
    range: "$250K-$500K",
    minDisclosed: "$250K",
  },
  {
    id: "demo-3",
    filed: "May 16",
    actor: "Senior Treasury Official",
    party: null,
    branch: "executive",
    ticker: "JPM",
    issuer: "JPMorgan Chase & Co.",
    action: "Buy",
    range: "$500K-$1M",
    minDisclosed: "$500K",
  },
  {
    id: "demo-4",
    filed: "May 16",
    actor: "Tommy Tuberville",
    party: "R",
    branch: "congress",
    ticker: "BA",
    issuer: "The Boeing Company",
    action: "Buy",
    range: "$100K-$250K",
    minDisclosed: "$100K",
  },
  {
    id: "demo-5",
    filed: "May 15",
    actor: "Commerce Department Official",
    party: null,
    branch: "executive",
    ticker: "MSFT",
    issuer: "Microsoft Corporation",
    action: "Sell",
    range: "$50K-$100K",
    minDisclosed: "$50K",
  },
];

const sectors = [
  { name: "Technology", net: 18.6, buys: "$42.4M", sells: "$23.8M" },
  { name: "Energy", net: 11.2, buys: "$19.4M", sells: "$8.2M" },
  { name: "Industrials", net: 4.8, buys: "$11.6M", sells: "$6.8M" },
  { name: "Healthcare", net: -6.1, buys: "$7.3M", sells: "$13.4M" },
  { name: "Financials", net: -9.7, buys: "$18.0M", sells: "$27.7M" },
];

const edgeCards = [
  {
    icon: GitCompareArrows,
    title: "Committee-linked trades",
    value: "18",
    detail: "Armed Services, Energy, Commerce overlaps",
    tone: "primary",
  },
  {
    icon: ShieldCheck,
    title: "Spouse or dependent owner",
    value: "7",
    detail: "Owner field contains spouse, child, or dependent",
    tone: "profit",
  },
  {
    icon: Zap,
    title: "Dark-flow intersection",
    value: "12",
    detail: "Congress flow plus high off-exchange activity",
    tone: "warning",
  },
];

const watchlist = [
  { ticker: "NVDA", issuer: "Semiconductors", signal: "5 buys, 1 sell", value: "$3.4M min" },
  { ticker: "XOM", issuer: "Energy", signal: "Agency + committee overlap", value: "$1.2M min" },
  { ticker: "BA", issuer: "Defense and aerospace", signal: "Armed Services link", value: "$640K min" },
];

export default function DemoPage() {
  return (
    <main className="min-h-[calc(100dvh-44px)] bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden border-b border-border px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgb(26_23_20/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(26_23_20/0.045)_1px,transparent_1px)] [background-size:32px_32px] dark:[background-image:linear-gradient(rgb(236_228_212/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(236_228_212/0.045)_1px,transparent_1px)]" />
        <div className="absolute right-[-8rem] top-[-10rem] h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
        <div className="relative mx-auto flex max-w-[1500px] flex-col gap-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
                <Radio className="size-3.5" />
                Demo data
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                Trade intelligence preview without touching SQL.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                A fast mock-data workspace for showing congressional and executive disclosure
                workflows while the live ingest, Turso reads, or API keys are being worked on.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href="/" />}>
                Open live app
                <ArrowUpRight className="size-4" />
              </Button>
              <Button nativeButton={false} variant="outline" render={<Link href="/about" />}>
                About
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded border border-border bg-card/80 p-4">
                <div className="data-label">{metric.label}</div>
                <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                  {metric.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{metric.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="qq-panel overflow-hidden">
            <SectionHeader
              icon={Activity}
              title="Fresh Disclosure Tape"
              subtitle="Mock filings sorted by public disclosure date"
            />
            <Table className="text-[0.82rem]">
              <TableHeader>
                <TableRow className="border-border bg-muted hover:bg-muted">
                  <TableHead className="data-label h-9">Filed</TableHead>
                  <TableHead className="data-label">Ticker</TableHead>
                  <TableHead className="data-label">Action</TableHead>
                  <TableHead className="data-label">Actor</TableHead>
                  <TableHead className="data-label text-right">Min disclosed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id} className="row-stripe">
                    <TableCell className="font-mono text-[0.72rem] text-muted-foreground">
                      {trade.filed}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-sky-400">${trade.ticker}</div>
                      <div className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">
                        {trade.issuer}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TradeTypeBadge type={trade.action} />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="max-w-[230px] truncate">{trade.actor}</span>
                        {trade.party ? <PartyBadge party={trade.party} /> : null}
                        <TradeBranchBadge branch={trade.branch} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-semibold">{trade.minDisclosed}</div>
                      <div className="mt-0.5 font-mono text-[0.68rem] text-muted-foreground">
                        Range {trade.range}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="qq-panel">
            <SectionHeader
              icon={TrendingUp}
              title="Congress Sector Flow"
              subtitle="Mock 60d buy minus sell using minimum disclosed dollars"
            />
            <div className="space-y-4 p-4">
              {sectors.map((sector) => (
                <SectorBar key={sector.name} sector={sector} />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {edgeCards.map((card) => (
            <div key={card.title} className="qq-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="data-label">{card.title}</div>
                  <div className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                    {card.value}
                  </div>
                </div>
                <div className={edgeIconClass(card.tone)}>
                  <card.icon className="size-5" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{card.detail}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="qq-panel p-4">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              <h2 className="qq-section-title">Why this page exists</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The demo route uses local mock arrays only. It avoids Prisma, Turso,
              upstream APIs, Yahoo, and cached server queries, so it remains useful while live
              data work is in progress.
            </p>
            <div className="mt-4 grid gap-2">
              <DemoBadge icon={Landmark} label="Congress sample" />
              <DemoBadge icon={Building2} label="Executive branch sample" />
              <DemoBadge icon={TrendingDown} label="Minimum disclosed dollars" />
            </div>
          </div>

          <div className="qq-panel overflow-hidden">
            <SectionHeader
              icon={ShieldCheck}
              title="Trader Watchlist Preview"
              subtitle="Mock ticker cards using factual-count style signals"
            />
            <div className="grid gap-3 p-4 md:grid-cols-3">
              {watchlist.map((item) => (
                <div key={item.ticker} className="rounded border border-border bg-muted p-3">
                  <div className="font-mono text-lg font-semibold text-primary">
                    ${item.ticker}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.issuer}</div>
                  <div className="mt-4 rounded border border-border bg-card p-2">
                    <div className="data-label">Signal</div>
                    <div className="mt-1 text-sm">{item.signal}</div>
                  </div>
                  <div className="mt-3 font-mono text-sm font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Activity;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="qq-section-header">
      <div>
        <h2 className="qq-section-title">{title}</h2>
        <p className="qq-section-subtitle">{subtitle}</p>
      </div>
      <Icon className="size-4 text-primary" />
    </div>
  );
}

function SectorBar({ sector }: { sector: (typeof sectors)[number] }) {
  const magnitude = Math.min(100, Math.abs(sector.net) * 4);
  const isPositive = sector.net >= 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{sector.name}</div>
          <div className="mt-0.5 font-mono text-[0.68rem] text-muted-foreground">
            Buys {sector.buys} / Sells {sector.sells}
          </div>
        </div>
        <div className={isPositive ? "font-mono text-sm font-semibold text-profit" : "font-mono text-sm font-semibold text-destructive"}>
          {isPositive ? "+" : "-"}${Math.abs(sector.net).toFixed(1)}M
        </div>
      </div>
      <div className="grid h-3 grid-cols-2 overflow-hidden rounded bg-muted">
        <div className="flex justify-end border-r border-border">
          {!isPositive ? (
            <div className="h-full bg-destructive/80" style={{ width: `${magnitude}%` }} />
          ) : null}
        </div>
        <div>
          {isPositive ? (
            <div className="h-full bg-profit/80" style={{ width: `${magnitude}%` }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DemoBadge({ icon: Icon, label }: { icon: typeof Activity; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm">
      <Icon className="size-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}

function edgeIconClass(tone: string) {
  if (tone === "profit") return "rounded border border-profit/20 bg-profit/10 p-2 text-profit";
  if (tone === "warning") return "rounded border border-rose-900/40 bg-rose-950/20 p-2 text-rose-300";
  return "rounded border border-primary/20 bg-primary/10 p-2 text-primary";
}
