"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Landmark, Search, Table2 } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SearchResult = {
  politicians: Array<{
    id: string;
    name: string;
    party: "D" | "R";
    state: string;
    chamber: string;
  }>;
  trades: Array<{
    id: string;
    politicianName: string;
    ticker: string;
    companyName: string;
    tradeType: string;
  }>;
  tickers: Array<{
    ticker: string;
    companyName: string;
  }>;
};

const EMPTY: SearchResult = {
  politicians: [],
  trades: [],
  tickers: [],
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function CommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    const value = query.trim();
    if (!value) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted && response.ok) {
          setResults((await response.json()) as SearchResult);
        }
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }

        console.error("Command search failed", error);
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    setResults(EMPTY);
    router.push(href);
  }

  const hasResults =
    results.politicians.length > 0 ||
    results.trades.length > 0 ||
    results.tickers.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global search"
      description="Search congressional trades, politicians, and tickers."
      className="border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-[0_20px_70px_rgb(0_0_0/0.55)] sm:max-w-2xl"
    >
      <div className="border-b border-zinc-900 px-2 py-2">
        <CommandInput
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            if (!value.trim()) setResults(EMPTY);
          }}
          placeholder="Search Pelosi, NVDA, healthcare..."
          className="font-mono"
        />
      </div>
      <CommandList className="max-h-[520px] p-2">
        {!query.trim() ? (
          <div className="px-3 py-8 text-center">
            <Search className="mx-auto mb-3 size-8 text-sky-500" />
            <p className="text-sm font-medium">Start typing to scan the terminal.</p>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              Politicians, stock tickers, company names, and disclosure IDs.
            </p>
          </div>
        ) : null}
        {query.trim() && !hasResults ? (
          <CommandEmpty className="py-10 text-muted-foreground">
            No matching disclosures.
          </CommandEmpty>
        ) : null}

        {results.politicians.length ? (
          <CommandGroup heading="Politicians">
            {results.politicians.map((politician) => (
              <CommandItem
                key={politician.id}
                value={`politician-${politician.name}`}
                onSelect={() => go(`/politicians/${politician.id}`)}
                className="gap-3"
              >
                <Landmark className="size-4 text-zinc-500" />
                <span>{politician.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto rounded px-1.5 font-mono text-[10px]",
                    politician.party === "D"
                      ? "border-zinc-800/70 bg-zinc-950/30 text-zinc-500"
                      : "border-zinc-800/70 bg-zinc-950/30 text-zinc-500",
                  )}
                >
                  [{politician.party}]
                </Badge>
                <CommandShortcut>{politician.state}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.politicians.length && (results.trades.length || results.tickers.length) ? (
          <CommandSeparator />
        ) : null}

        {results.trades.length ? (
          <CommandGroup heading="Trades">
            {results.trades.map((trade) => (
              <CommandItem
                key={trade.id}
                value={`trade-${trade.id}-${trade.ticker}-${trade.politicianName}`}
                onSelect={() => go(`/trades/${trade.id}`)}
                className="gap-3"
              >
                <Table2 className="size-4 text-zinc-500" />
                <span className="font-mono text-xs font-bold text-sky-400">${trade.ticker}</span>
                <span className="truncate text-muted-foreground">
                  {trade.politicianName} · {trade.tradeType}
                </span>
                <CommandShortcut>{trade.id}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.trades.length && results.tickers.length ? <CommandSeparator /> : null}

        {results.tickers.length ? (
          <CommandGroup heading="Tickers">
            {results.tickers.map((ticker) => (
              <CommandItem
                key={ticker.ticker}
                value={`ticker-${ticker.ticker}-${ticker.companyName}`}
                onSelect={() => go(`/analysis/stocks/${ticker.ticker}`)}
                className="gap-3"
              >
                <Building2 className="size-4 text-zinc-500" />
                <span className="font-mono text-xs font-bold text-sky-400">${ticker.ticker}</span>
                <span className="truncate text-muted-foreground">{ticker.companyName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
