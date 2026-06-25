"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TopTraderRow } from "@/lib/queries/topTraders";

type SortKey = "total" | "count" | "name";

function formatDollar(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function partyColor(p: string | null) {
  if (p === "D" || p === "R") return "border-zinc-700/70 bg-zinc-950/55 text-zinc-500";
  return "border-zinc-700/70 bg-zinc-950/55 text-zinc-600";
}

function SortHeader({
  label,
  sortKey,
  active,
  direction,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  direction: "asc" | "desc";
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = active === sortKey;
  const arrow = isActive ? (direction === "desc" ? "↓" : "↑") : "";
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {label} <span className="text-[10px]">{arrow}</span>
    </button>
  );
}

export function TopTraders({ data }: { data: TopTraderRow[] }) {
  const [sort, setSort] = useState<SortKey>("total");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const av = sort === "name" ? a.name : a[sort];
      const bv = sort === "name" ? b.name : b[sort];
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
      else cmp = Number(av) - Number(bv);
      return dir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [data, sort, dir]);

  const max = useMemo(() => Math.max(1, ...data.map((r) => r.total)), [data]);

  function onClick(k: SortKey) {
    if (k === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="grid h-32 place-items-center font-mono text-xs text-zinc-500">
        <div className="text-center">
          <div className="empty-orb mx-auto mb-3 size-16 rounded-sm border border-zinc-700/70" />
          No trades in this window.
        </div>
      </div>
    );
  }

  return (
    <div className="qq-table-shell">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-700/70 hover:bg-transparent">
            <TableHead>
              <SortHeader label="Politician" sortKey="name" active={sort} direction={dir} onClick={onClick} />
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Party</TableHead>
            <TableHead className="text-right">
              <SortHeader label="Trades" sortKey="count" active={sort} direction={dir} onClick={onClick} className="ml-auto" />
            </TableHead>
            <TableHead className="text-right">
              <SortHeader label="Total $" sortKey="total" active={sort} direction={dir} onClick={onClick} className="ml-auto" />
            </TableHead>
            <TableHead className="w-32">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.politicianId} className="group border-zinc-800/80 transition-colors hover:bg-zinc-900/45">
              <TableCell>
                <Link
                  href={`/politicians/${encodeURIComponent(r.name)}`}
                  className="link-underline text-sm font-medium"
                >
                  {r.name}
                </Link>
              </TableCell>
              <TableCell>
                {r.party ? (
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${partyColor(r.party)}`}>
                    [{r.party}]
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{r.count}</TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{formatDollar(r.total)}</TableCell>
              <TableCell>
                <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-900">
                  <div
                    className="h-full rounded bg-sky-500/70 transition-all duration-500"
                    style={{ width: `${(r.total / max) * 100}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
