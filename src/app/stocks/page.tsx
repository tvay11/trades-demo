import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Download, Search, TrendingUp } from "lucide-react";

import { WatchlistButton } from "@/components/watchlist-button";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import {
  getStocksList,
  type StockListSortDir,
  type StockListSortKey,
} from "@/lib/queries/stocksList";
import { getWatchedTickerSet } from "@/lib/queries/watchlist";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Stocks",
  description: "Browse every tracked stock with market cap, latest close, and disclosed trade activity (congressional + executive branch).",
};

type SearchParams = {
  q?: string;
  sort?: string;
  dir?: string;
  page?: string;
  sector?: string;
  cap?: string;
  activity?: string;
  exchange?: string;
  industry?: string;
  country?: string;
  profile?: string;
  minTrades90?: string;
};

const SORTABLE: StockListSortKey[] = [
  "ticker",
  "companyName",
  "industry",
  "country",
  "marketCap",
  "tradeCount14",
  "tradeCount30",
  "tradeCount60",
  "tradeCount90",
  "tradeCount365",
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

const CAP_OPTIONS = [
  { label: "All caps", value: "" },
  { label: "Mega cap ($200B+)", value: "mega" },
  { label: "Large cap ($10B-$200B)", value: "large" },
  { label: "Mid cap ($2B-$10B)", value: "mid" },
  { label: "Small cap ($300M-$2B)", value: "small" },
  { label: "Micro cap (<$300M)", value: "micro" },
];

const ACTIVITY_OPTIONS = [
  { label: "Any activity", value: "" },
  { label: "Traded in 90d", value: "active90" },
  { label: "Traded in 1y", value: "active365" },
];

const PROFILE_OPTIONS = [
  { label: "Any profile", value: "" },
  { label: "Has market cap", value: "hasMarketCap" },
  { label: "Missing market cap", value: "missingMarketCap" },
  { label: "Has website", value: "hasWebsite" },
  { label: "Missing website", value: "missingWebsite" },
  { label: "Complete profile", value: "completeProfile" },
];

const MIN_TRADES_OPTIONS = [
  { label: "Any 90d count", value: "" },
  { label: "1+ trades", value: "1" },
  { label: "5+ trades", value: "5" },
  { label: "10+ trades", value: "10" },
  { label: "25+ trades", value: "25" },
];

type StockUrlFilters = {
  q: string;
  sector?: string;
  cap?: string;
  activity?: string;
  exchange?: string;
  industry?: string;
  country?: string;
  profile?: string;
  minTrades90?: string;
};

function parseSearchParams(raw: SearchParams) {
  const sortIn = raw.sort as StockListSortKey | undefined;
  const sort: StockListSortKey =
    sortIn && SORTABLE.includes(sortIn) ? sortIn : "marketCap";
  const dir: StockListSortDir = raw.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(raw.page ?? "1") || 1);
  return {
    q: raw.q?.trim() ?? "",
    sort,
    dir,
    page,
    sector: raw.sector,
    cap: raw.cap,
    activity: raw.activity,
    exchange: raw.exchange?.trim() || undefined,
    industry: raw.industry?.trim() || undefined,
    country: raw.country?.trim() || undefined,
    profile: raw.profile,
    minTrades90: raw.minTrades90,
  };
}

export default function StocksIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<StocksFallback />}>
      {searchParams.then((params) => <StocksContent params={params} />)}
    </Suspense>
  );
}

async function StocksContent({ params }: { params: SearchParams }) {
  const {
    q,
    sort,
    dir,
    page,
    sector,
    cap,
    activity,
    exchange,
    industry,
    country,
    profile,
    minTrades90,
  } = parseSearchParams(params);
  const urlFilters: StockUrlFilters = {
    q,
    sector,
    cap,
    activity,
    exchange,
    industry,
    country,
    profile,
    minTrades90,
  };
  const csvHref = buildStocksExportHref({ sort, dir, filters: urlFilters });
  const result = await getStocksList({
    q,
    sort,
    dir,
    page,
    sector,
    cap,
    activity,
    exchange,
    industry,
    country,
    profile,
    minTrades90,
  });
  const watchedTickers = await getWatchedTickerSet(result.rows.map((row) => row.ticker));

  return (
    <main className="qq-page">
      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div>
          <div>
            <div className="qq-section-subtitle text-sky-500">Stocks universe</div>
            <h1 className="mt-3 flex items-baseline gap-3 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
              <TrendingUp className="size-7 text-sky-500" />
              All Stocks
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Every ticker we track, with the latest market cap from Yahoo, latest close from our
              price cache, and a 365-day window of disclosed trade activity from Congress and the
              executive branch combined.
            </p>
          </div>

          <form action="/stocks" className="mt-6 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(150px,180px))_auto]">
            <label className="sr-only" htmlFor="stocks-search">
              Search
            </label>
            <input
              id="stocks-search"
              name="q"
              defaultValue={q}
              placeholder="Ticker or company"
              className="ledger-field h-9 px-3 uppercase outline-none"
            />
            <AppSelect name="sector" defaultValue={sector ?? ""} options={SECTOR_OPTIONS} />
            <AppSelect name="cap" defaultValue={cap ?? ""} options={CAP_OPTIONS} />
            <AppSelect name="activity" defaultValue={activity ?? ""} options={ACTIVITY_OPTIONS} />
            <AppSelect name="profile" defaultValue={profile ?? ""} options={PROFILE_OPTIONS} />
            <div className="flex items-center justify-end gap-2">
              <Button type="submit" size="sm" className="h-9">
                <Search className="size-4" />
                Filter
              </Button>
              <Link
                href="/stocks"
                className="ledger-stamp inline-flex h-9 items-center border-zinc-700/70 bg-zinc-950/55 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-500/80 hover:text-zinc-100"
              >
                Reset
              </Link>
              <Link
                href={csvHref}
                className="ledger-stamp inline-flex h-9 items-center gap-2 border-zinc-700/70 bg-zinc-950/55 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-500/80 hover:text-zinc-200"
              >
                <Download className="size-4" />
                CSV
              </Link>
            </div>
            <input
              name="exchange"
              defaultValue={exchange}
              placeholder="Exchange"
              className="ledger-field h-9 px-3 uppercase outline-none"
            />
            <input
              name="industry"
              defaultValue={industry}
              placeholder="Industry"
              className="ledger-field h-9 px-3 outline-none"
            />
            <input
              name="country"
              defaultValue={country}
              placeholder="Country"
              className="ledger-field h-9 px-3 uppercase outline-none"
            />
            <AppSelect name="minTrades90" defaultValue={minTrades90 ?? ""} options={MIN_TRADES_OPTIONS} />
            <div className="hidden lg:block" />
          </form>
        </div>
      </section>

      <section className="qq-panel overflow-hidden">
        <div className="qq-section-header">
          <div>
            <h2 className="qq-section-title">
              {result.total.toLocaleString()} stock{result.total === 1 ? "" : "s"}
              {q ? <span className="text-muted-foreground"> matching “{q}”</span> : null}
            </h2>
            <p className="qq-section-subtitle">
              Page {result.page} of {result.totalPages} · sorted by {labelForSort(sort)} {dir}
            </p>
          </div>
        </div>

        {result.rows.length === 0 ? (
          <EmptyPanel q={q} />
        ) : (
          <Table className="text-[0.82rem]">
            <TableHeader>
              <TableRow className="border-zinc-700/70 bg-zinc-950/80 hover:bg-zinc-950/80">
                <SortableHead
                  label="Ticker"
                  current={sort}
                  dir={dir}
                  field="ticker"
                  filters={urlFilters}
                  page={page}
                  defaultDir="asc"
                />
                <SortableHead
                  label="Company"
                  current={sort}
                  dir={dir}
                  field="companyName"
                  filters={urlFilters}
                  page={page}
                  defaultDir="asc"
                />
                <TableHead className="data-label">Sector</TableHead>
                <SortableHead
                  label="Industry"
                  current={sort}
                  dir={dir}
                  field="industry"
                  filters={urlFilters}
                  page={page}
                  defaultDir="asc"
                />
                <SortableHead
                  label="Country"
                  current={sort}
                  dir={dir}
                  field="country"
                  filters={urlFilters}
                  page={page}
                  defaultDir="asc"
                />
                <SortableHead
                  label="Market cap"
                  current={sort}
                  dir={dir}
                  field="marketCap"
                  filters={urlFilters}
                  page={page}
                  defaultDir="desc"
                  align="right"
                />
                <SortableHead
                  label="14d"
                  current={sort}
                  dir={dir}
                  field="tradeCount14"
                  filters={urlFilters}
                  page={page}
                  defaultDir="desc"
                  align="right"
                />
                <SortableHead
                  label="30d"
                  current={sort}
                  dir={dir}
                  field="tradeCount30"
                  filters={urlFilters}
                  page={page}
                  defaultDir="desc"
                  align="right"
                />
                <SortableHead
                  label="60d"
                  current={sort}
                  dir={dir}
                  field="tradeCount60"
                  filters={urlFilters}
                  page={page}
                  defaultDir="desc"
                  align="right"
                />
                <SortableHead
                  label="90d"
                  current={sort}
                  dir={dir}
                  field="tradeCount90"
                  filters={urlFilters}
                  page={page}
                  defaultDir="desc"
                  align="right"
                />
                <SortableHead
                  label="1y"
                  current={sort}
                  dir={dir}
                  field="tradeCount365"
                  filters={urlFilters}
                  page={page}
                  defaultDir="desc"
                  align="right"
                />
                <TableHead className="data-label text-right">Watch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.ticker} className="row-stripe">
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
                  <TableCell className="max-w-[200px] truncate">
                    {row.industry ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {row.country ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.marketCap == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatMoney(row.marketCap)
                    )}
                  </TableCell>
                  <TradeCountCell value={row.tradeCount14} />
                  <TradeCountCell value={row.tradeCount30} />
                  <TradeCountCell value={row.tradeCount60} />
                  <TradeCountCell value={row.tradeCount90} />
                  <TradeCountCell value={row.tradeCount365} />
                  <TableCell className="text-right">
                    <WatchlistButton
                      ticker={row.ticker}
                      watched={watchedTickers.has(row.ticker)}
                      compact
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          sort={sort}
          dir={dir}
          filters={urlFilters}
        />
      </section>
    </main>
  );
}

function labelForSort(s: StockListSortKey) {
  switch (s) {
    case "ticker":
      return "ticker";
    case "companyName":
      return "company";
    case "industry":
      return "industry";
    case "country":
      return "country";
    case "marketCap":
      return "market cap";
    case "tradeCount14":
      return "trades (14d)";
    case "tradeCount30":
      return "trades (30d)";
    case "tradeCount60":
      return "trades (60d)";
    case "tradeCount90":
      return "trades (90d)";
    case "tradeCount365":
      return "trades (1y)";
  }
}

function TradeCountCell({ value }: { value: number }) {
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

function buildHref({
  sort,
  dir,
  page,
  filters,
}: {
  sort: StockListSortKey;
  dir: StockListSortDir;
  page: number;
  filters: StockUrlFilters;
}) {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  sp.set("sort", sort);
  sp.set("dir", dir);
  if (page > 1) sp.set("page", String(page));
  if (filters.sector) sp.set("sector", filters.sector);
  if (filters.cap) sp.set("cap", filters.cap);
  if (filters.activity) sp.set("activity", filters.activity);
  if (filters.exchange) sp.set("exchange", filters.exchange);
  if (filters.industry) sp.set("industry", filters.industry);
  if (filters.country) sp.set("country", filters.country);
  if (filters.profile) sp.set("profile", filters.profile);
  if (filters.minTrades90) sp.set("minTrades90", filters.minTrades90);
  const s = sp.toString();
  return s ? `/stocks?${s}` : "/stocks";
}

function buildStocksExportHref({
  sort,
  dir,
  filters,
}: {
  sort: StockListSortKey;
  dir: StockListSortDir;
  filters: StockUrlFilters;
}) {
  return buildHref({ sort, dir, page: 1, filters }).replace("/stocks?", "/stocks/export?");
}

function SortableHead({
  label,
  current,
  dir,
  field,
  filters,
  page,
  defaultDir,
  align,
}: {
  label: string;
  current: StockListSortKey;
  dir: StockListSortDir;
  field: StockListSortKey;
  filters: StockUrlFilters;
  page: number;
  defaultDir: StockListSortDir;
  align?: "right";
}) {
  const isActive = current === field;
  const nextDir: StockListSortDir = isActive
    ? dir === "asc"
      ? "desc"
      : "asc"
    : defaultDir;
  const arrow = isActive ? (dir === "asc" ? "▲" : "▼") : "↕";
  return (
    <TableHead className={cn("data-label", align === "right" ? "text-right" : undefined)}>
      <Link
        href={buildHref({ sort: field, dir: nextDir, page, filters })}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <span className="font-mono text-[0.6rem] opacity-70">{arrow}</span>
      </Link>
    </TableHead>
  );
}

function Pagination({
  page,
  totalPages,
  sort,
  dir,
  filters,
}: {
  page: number;
  totalPages: number;
  sort: StockListSortKey;
  dir: StockListSortDir;
  filters: StockUrlFilters;
}) {
  if (totalPages <= 1) return null;
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  return (
    <div className="flex items-center justify-between border-t border-zinc-700/70 bg-zinc-950/80 px-4 py-3 text-xs">
      <span className="font-mono text-muted-foreground">
        Page {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        <PaginationLink
          disabled={page <= 1}
          href={buildHref({ sort, dir, page: prevPage, filters })}
          label="Prev"
        />
        <PaginationLink
          disabled={page >= totalPages}
          href={buildHref({ sort, dir, page: nextPage, filters })}
          label="Next"
        />
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  label,
  disabled,
}: {
  href: string;
  label: string;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span className="ledger-stamp border-zinc-700/50 px-2.5 py-1 text-[0.7rem] text-zinc-600">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="ledger-stamp border-zinc-700/70 bg-zinc-950/55 px-2.5 py-1 text-[0.7rem] text-zinc-500 transition-colors hover:border-zinc-500/80 hover:text-zinc-100"
    >
      {label}
    </Link>
  );
}

function EmptyPanel({ q }: { q: string }) {
  return (
    <div className="ledger-empty px-6 py-16">
      <div className="empty-orb mb-4 size-16 rounded-sm" />
      <h3 className="font-semibold">No stocks found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {q ? `Nothing matches “${q}”.` : "No stocks are in the database yet."}
      </p>
    </div>
  );
}

function StocksFallback() {
  return (
    <main className="qq-page">
      <div className="qq-panel h-44 shimmer" />
      <div className="qq-panel h-[640px] shimmer" />
    </main>
  );
}
