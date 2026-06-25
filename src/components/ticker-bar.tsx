"use client";

import { use } from "react";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

function TickerItem({ trade }: { trade: Trade }) {
  const age = formatDistanceToNowStrict(new Date(trade.filedDate), {
    addSuffix: true,
  });

  return (
    <span className="mx-3 inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-medium text-zinc-300">{trade.politicianName}</span>
      <Badge
        className={cn(
          "h-5 px-1.5 font-mono text-[10px] font-medium",
          trade.party === "D" || trade.party === "R"
            ? "border-zinc-800/70 bg-zinc-950/30 text-zinc-500"
            : "border-zinc-800/70 bg-zinc-950/30 text-zinc-600",
        )}
        variant="outline"
      >
        {trade.party === "D" || trade.party === "R" ? `[${trade.party}]` : "-"}
      </Badge>
      <span
        className={cn(
          "font-mono text-[0.68rem] font-semibold",
          // TradeType is Buy | Sell | Exchange — the binary ternary used to
          // paint Exchange filings sell-red.
          trade.tradeType === "Buy"
            ? "text-sky-500"
            : trade.tradeType === "Sell"
              ? "text-rose-500"
              : "text-zinc-500",
        )}
      >
        {trade.tradeType.toUpperCase()}
      </span>
      <span className="font-mono text-xs font-bold text-sky-400">${trade.ticker}</span>
      <span className="font-mono text-zinc-500">{trade.amount}</span>
      <span className="text-zinc-600">/ {age}</span>
    </span>
  );
}

export function TickerBar({ tradesPromise }: { tradesPromise: Promise<Trade[]> }) {
  const trades = use(tradesPromise);
  const duplicated = [...trades, ...trades];

  return (
    <div className="scroll-fade border-t border-zinc-700/70 bg-zinc-950/85">
      <div className="flex h-8 items-center overflow-hidden">
        <div className="hidden h-full shrink-0 items-center border-r border-zinc-700/70 bg-zinc-950/70 px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sky-400 sm:flex">
          Recent trades
        </div>
        <div
          className="flex min-w-max items-center text-[0.72rem]"
          style={{ animation: "ticker-scroll 42s linear infinite" }}
        >
          {duplicated.map((trade, index) => (
            <TickerItem key={`${trade.id}-${index}`} trade={trade} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TickerBarFallback() {
  return (
    <div className="border-t border-zinc-700/70 bg-zinc-950/85">
      <div className="h-8 px-5 py-2">
        <div className="h-4 w-full rounded bg-zinc-900 shimmer" />
      </div>
    </div>
  );
}
