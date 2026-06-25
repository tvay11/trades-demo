"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useMemo } from "react";

import { PartyBadge, TradeTypeBadge } from "@/components/trade-badges";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { AppSelect } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Party, SortDir, SortKey, Trade, TradeType } from "@/lib/types";
import { amountMinimum, compactDate, formatMoney } from "@/lib/format";

const sortKeys = [
  "politician",
  "ticker",
  "company",
  "type",
  "amount",
  "filedDate",
  "transactionDate",
] as const satisfies readonly SortKey[];

const tradeTypes = ["all", "Buy", "Sell", "Exchange"] as const;
const parties = ["all", "D", "R"] as const;

const queryParsers = {
  q: parseAsString.withDefault(""),
  party: parseAsStringLiteral(parties).withDefault("all"),
  type: parseAsStringLiteral(tradeTypes).withDefault("all"),
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(12),
  sort: parseAsStringLiteral(sortKeys).withDefault("filedDate"),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};

function sortValue(trade: Trade, key: SortKey) {
  switch (key) {
    case "politician":
      return trade.politicianName;
    case "ticker":
      return trade.ticker;
    case "company":
      return trade.companyName;
    case "type":
      return trade.tradeType;
    case "amount":
      return amountMinimum(trade.amount);
    case "transactionDate":
      return trade.transactionDate;
    case "filedDate":
    default:
      return trade.filedDate;
  }
}

function HeaderButton({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  // Mirror sortBy() in the parent: clicking flips from desc→asc when already
  // sorted desc on this key; otherwise the next state is desc. The previous
  // label announced "ascending" even when the click would actually sort desc.
  const nextDir = active && dir === "desc" ? "asc" : "desc";

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-left"
      aria-label={`Sort by ${label} ${nextDir === "asc" ? "ascending" : "descending"}`}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="size-3 text-sky-400" />
        ) : (
          <ArrowDown className="size-3 text-sky-400" />
        )
      ) : (
        <span className="size-3" />
      )}
    </button>
  );
}

function FilterControls({
  party,
  type,
  from,
  to,
  onPatch,
}: {
  party: (typeof parties)[number];
  type: (typeof tradeTypes)[number];
  from: string;
  to: string;
  onPatch: (patch: Partial<QueryState>) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <label className="space-y-1">
        <span className="data-label">Party</span>
        <AppSelect
          value={party}
          onValueChange={(next) => onPatch({ party: next as Party | "all", page: 1 })}
          options={[
            { label: "All parties", value: "all" },
            { label: "Democrat", value: "D" },
            { label: "Republican", value: "R" },
          ]}
        />
      </label>
      <label className="space-y-1">
        <span className="data-label">Type</span>
        <AppSelect
          value={type}
          onValueChange={(next) => onPatch({ type: next as TradeType | "all", page: 1 })}
          options={[
            { label: "All types", value: "all" },
            { label: "Buy", value: "Buy" },
            { label: "Sell", value: "Sell" },
            { label: "Exchange", value: "Exchange" },
          ]}
        />
      </label>
      <label className="space-y-1">
        <span className="data-label">Filed after</span>
        <DatePicker
          value={from}
          placeholder="From"
          onValueChange={(next) => onPatch({ from: next, page: 1 })}
        />
      </label>
      <label className="space-y-1">
        <span className="data-label">Filed before</span>
        <DatePicker
          value={to}
          placeholder="To"
          onValueChange={(next) => onPatch({ to: next, page: 1 })}
        />
      </label>
    </div>
  );
}

type QueryState = {
  q: string;
  party: (typeof parties)[number];
  type: (typeof tradeTypes)[number];
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sort: SortKey;
  dir: SortDir;
};

export function TradesTable({
  trades,
  politicianId,
  compact = false,
}: {
  trades: Trade[];
  politicianId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useQueryStates(queryParsers, {
    shallow: true,
    history: "push",
  });

  const filtered = useMemo(() => {
    const normalized = query.q.trim().toLowerCase();
    const rows = trades.filter((trade) => {
      const matchesQuery =
        !normalized ||
        trade.politicianName.toLowerCase().includes(normalized) ||
        trade.ticker.toLowerCase().includes(normalized) ||
        trade.companyName.toLowerCase().includes(normalized);
      const matchesParty = query.party === "all" || trade.party === query.party;
      const matchesType = query.type === "all" || trade.tradeType === query.type;
      const matchesFrom = !query.from || trade.filedDate >= query.from;
      const matchesTo = !query.to || trade.filedDate <= query.to;
      const matchesPolitician = !politicianId || trade.politicianId === politicianId;

      return (
        matchesQuery &&
        matchesParty &&
        matchesType &&
        matchesFrom &&
        matchesTo &&
        matchesPolitician
      );
    });

    rows.sort((a, b) => {
      const direction = query.dir === "asc" ? 1 : -1;
      const aValue = sortValue(a, query.sort);
      const bValue = sortValue(b, query.sort);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue)) * direction;
    });

    return rows;
  }, [politicianId, query, trades]);

  const pages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(query.page, pages);
  const visible = filtered.slice((page - 1) * query.pageSize, page * query.pageSize);
  const totalVolume = filtered.reduce((sum, trade) => sum + amountMinimum(trade.amount), 0);

  function patch(patchValue: Partial<QueryState>) {
    void setQuery(patchValue);
  }

  function sortBy(key: SortKey) {
    patch({
      sort: key,
      dir: query.sort === key && query.dir === "desc" ? "asc" : "desc",
      page: 1,
    });
  }

  function clearFilters() {
    void setQuery({
      q: "",
      party: "all",
      type: "all",
      from: "",
      to: "",
      page: 1,
      pageSize: query.pageSize,
      sort: "filedDate",
      dir: "desc",
    });
  }

  return (
    <div className="space-y-3">
      <div className="qq-panel p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="data-label">Search disclosures</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query.q}
                onChange={(event) => patch({ q: event.target.value, page: 1 })}
                placeholder="Politician, ticker, company..."
                className="h-9 pl-8"
              />
            </div>
          </label>

          <div className="hidden flex-1 lg:block">
            <FilterControls
              party={query.party}
              type={query.type}
              from={query.from}
              to={query.to}
              onPatch={patch}
            />
          </div>

          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" className="lg:hidden" />}>
                <Filter className="size-4" />
                Filters
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-sm">
                <SheetHeader className="pr-8">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Narrow disclosures by party, type, and filing window.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-5">
                  <FilterControls
                    party={query.party}
                    type={query.type}
                    from={query.from}
                    to={query.to}
                    onPatch={patch}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <SlidersHorizontal className="size-4" />
                View
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Rows per page</DropdownMenuLabel>
                {[8, 12, 20, 40].map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => patch({ pageSize: size, page: 1 })}
                  >
                    <span className="font-mono">{size}</span>
                    {query.pageSize === size ? (
                      <span className="ml-auto text-sky-400">Active</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="font-mono text-xs text-muted-foreground">
          {filtered.length.toLocaleString()} trades · {formatMoney(totalVolume)} min-disclosed volume
        </div>
        <Pagination
          page={page}
          pages={pages}
          onPageChange={(nextPage) => patch({ page: nextPage })}
        />
      </div>

      <div className="qq-table-shell hidden lg:block">
        <LayoutGroup>
          <Table className="text-[0.82rem]">
            <TableHeader>
              <TableRow className="border-zinc-700/70 bg-zinc-950/80 hover:bg-zinc-950/80">
                <TableHead className="data-label h-9">
                  <HeaderButton
                    label="Politician"
                    sortKey="politician"
                    current={query.sort}
                    dir={query.dir}
                    onSort={sortBy}
                  />
                </TableHead>
                <TableHead className="data-label">
                  <HeaderButton
                    label="Ticker"
                    sortKey="ticker"
                    current={query.sort}
                    dir={query.dir}
                    onSort={sortBy}
                  />
                </TableHead>
                <TableHead className="data-label">
                  <HeaderButton
                    label="Company"
                    sortKey="company"
                    current={query.sort}
                    dir={query.dir}
                    onSort={sortBy}
                  />
                </TableHead>
                <TableHead className="data-label">
                  <HeaderButton
                    label="Type"
                    sortKey="type"
                    current={query.sort}
                    dir={query.dir}
                    onSort={sortBy}
                  />
                </TableHead>
                <TableHead className="data-label text-right">
                  <HeaderButton
                    label="Amount"
                    sortKey="amount"
                    current={query.sort}
                    dir={query.dir}
                    onSort={sortBy}
                  />
                </TableHead>
                <TableHead className="data-label">
                  <HeaderButton
                    label="Filed"
                    sortKey="filedDate"
                    current={query.sort}
                    dir={query.dir}
                    onSort={sortBy}
                  />
                </TableHead>
                {!compact ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {visible.map((trade) => (
                  <motion.tr
                    layout
                    key={trade.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="row-stripe h-9 cursor-pointer border-b border-zinc-800/80 transition-colors hover:bg-zinc-900/45"
                    onClick={() => router.push(`/trades/${trade.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{trade.politicianName}</span>
                        <PartyBadge party={trade.party} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-sky-400">${trade.ticker}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {trade.companyName}
                    </TableCell>
                    <TableCell>
                      <TradeTypeBadge type={trade.tradeType} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {trade.amount}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {compactDate(trade.filedDate)}
                    </TableCell>
                    {!compact ? (
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    ) : null}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </LayoutGroup>
        {!visible.length ? <EmptyState /> : null}
      </div>

      <div className="grid gap-3 lg:hidden">
        {visible.map((trade) => (
          <button
            key={trade.id}
            type="button"
            onClick={() => router.push(`/trades/${trade.id}`)}
            className="qq-panel p-3 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{trade.politicianName}</span>
                  <PartyBadge party={trade.party} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{trade.companyName}</div>
              </div>
              <div className="font-mono text-xs font-bold text-sky-400">${trade.ticker}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="data-label">Type</div>
                <div className="mt-1">
                  <TradeTypeBadge type={trade.tradeType} />
                </div>
              </div>
              <div>
                <div className="data-label">Amount</div>
                <div className="mt-1 font-mono">{trade.amount}</div>
              </div>
              <div>
                <div className="data-label">Filed</div>
                <div className="mt-1 font-mono">{compactDate(trade.filedDate)}</div>
              </div>
            </div>
          </button>
        ))}
        {!visible.length ? <EmptyState /> : null}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="ledger-empty px-6 py-16">
      <div className="empty-orb mb-4 size-16 rounded-sm" />
      <h3 className="text-lg font-semibold">No trades found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Adjust the search terms or loosen filters to widen the disclosure scan.
      </p>
    </div>
  );
}
