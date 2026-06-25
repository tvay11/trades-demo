import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, CalendarClock, Search, Star, Trash2 } from "lucide-react";
import { Suspense } from "react";

import { removeFromWatchlist } from "@/app/watchlist/actions";
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
import { getWatchlistRows, type WatchlistRow } from "@/lib/queries/watchlist";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Watchlist",
  description: "Track selected tickers with recent disclosure activity and market context.",
};

export default function WatchlistPage() {
  return (
    <Suspense fallback={<WatchlistFallback />}>
      <WatchlistContent />
    </Suspense>
  );
}

async function WatchlistContent() {
  await connection();
  const rows = await getWatchlistRows();
  const active30 = rows.filter((row) => row.tradeCount30 > 0).length;
  const earningsKnown = rows.filter((row) => row.earningsDate != null).length;

  return (
    <main className="qq-page">
      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="qq-section-subtitle text-primary">
              <Star className="mr-1 inline size-3.5" />
              Personal ticker list
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Watchlist
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Save tickers you care about, then review recent disclosed activity, market cap, latest
              close, and direct links into the ticker intelligence page.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Fact label="Tickers" value={rows.length.toLocaleString()} />
            <Fact label="Active 30d" value={active30.toLocaleString()} />
            <Fact label="Earnings" value={earningsKnown.toLocaleString()} />
          </div>
        </div>
      </section>

      <section className="qq-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="qq-section-title">Saved tickers</h2>
            <p className="qq-section-subtitle">
              Activity counts combine congressional and executive disclosures.
            </p>
          </div>
          <form action="/analysis/stocks" className="flex w-full gap-2 sm:w-auto">
            <label className="sr-only" htmlFor="watchlist-jump">
              Open ticker
            </label>
            <input
              id="watchlist-jump"
              name="q"
              placeholder="NVDA"
              className="h-8 min-w-0 flex-1 rounded border border-border bg-card px-2.5 font-mono text-sm uppercase outline-none transition placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/15 sm:w-36"
            />
            <Button type="submit" size="sm">
              <Search className="size-4" />
              Open
            </Button>
          </form>
        </div>

        {rows.length === 0 ? (
          <EmptyWatchlist />
        ) : (
          <WatchlistTable rows={rows} />
        )}
      </section>
    </main>
  );
}

function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  return (
    <Table className="text-[0.82rem]">
      <TableHeader>
        <TableRow className="border-border bg-muted hover:bg-muted">
          <TableHead className="data-label">Ticker</TableHead>
          <TableHead className="data-label">Company</TableHead>
          <TableHead className="data-label">Sector</TableHead>
          <TableHead className="data-label text-right">Market cap</TableHead>
          <TableHead className="data-label text-right">Close</TableHead>
          <TableHead className="data-label text-right">30d</TableHead>
          <TableHead className="data-label text-right">90d</TableHead>
          <TableHead className="data-label text-right">1y</TableHead>
          <TableHead className="data-label">Earnings</TableHead>
          <TableHead className="data-label text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="row-stripe">
            <TableCell>
              <Link
                href={`/analysis/stocks/${encodeURIComponent(row.ticker)}`}
                className="inline-flex items-center gap-1 font-mono text-xs font-bold text-sky-400 transition hover:text-sky-300"
              >
                ${row.ticker}
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </Link>
            </TableCell>
            <TableCell className="max-w-[280px] truncate">
              {row.companyName ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              {row.sector ? (
                <span className="qq-metric py-0.5 text-[0.7rem]">{row.sector}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">
              {row.marketCap == null ? "—" : formatMoney(row.marketCap)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {row.latestClose == null ? "—" : `$${row.latestClose.toFixed(2)}`}
            </TableCell>
            <CountCell value={row.tradeCount30} />
            <CountCell value={row.tradeCount90} />
            <CountCell value={row.tradeCount365} />
            <TableCell>
              {row.earningsDate ? (
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-3.5 text-primary" />
                  <div>
                    <div className="font-mono text-[0.72rem]">
                      {dateText(row.earningsDate)}
                    </div>
                    <div className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {row.earningsIsEstimate ? "Expected" : "Confirmed"}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <form action={removeFromWatchlist} className="inline-flex">
                <input type="hidden" name="ticker" value={row.ticker} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${row.ticker} from watchlist`}
                  title={`Remove ${row.ticker} from watchlist`}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CountCell({ value }: { value: number }) {
  return (
    <TableCell
      className={cn(
        "text-right font-mono",
        value === 0 ? "text-muted-foreground/60" : undefined,
      )}
    >
      {value === 0 ? "—" : value.toLocaleString()}
    </TableCell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-muted p-3">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</div>
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

function EmptyWatchlist() {
  return (
    <div className="px-4 py-14 text-center">
      <Star className="mx-auto mb-3 size-8 text-primary" />
      <div className="text-sm font-medium">No watched tickers yet.</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Open a ticker page or browse the stock universe, then use the Watch button to save it here.
      </p>
      <Button nativeButton={false} className="mt-4" render={<Link href="/stocks" />}>
        Browse stocks
      </Button>
    </div>
  );
}

function WatchlistFallback() {
  return (
    <main className="qq-page">
      <section className="qq-panel h-44 shimmer" />
      <section className="qq-panel h-96 shimmer" />
    </main>
  );
}
