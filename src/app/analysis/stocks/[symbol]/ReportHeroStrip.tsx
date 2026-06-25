import type { ReactNode } from "react";
import Link from "next/link";
import type { Ledger } from "@/lib/ledger/types";

interface ReportHeroStripProps {
  report: Ledger | null;
  now: Date;
  actions?: ReactNode;
}

export function ReportHeroStrip({ report, now, actions }: ReportHeroStripProps) {
  if (!report) return null;

  const { ticker, houseCall, generatedAt } = report;

  // Age in floor days
  const generatedMs = new Date(generatedAt).getTime();
  const ageMs = now.getTime() - generatedMs;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const isStale = ageDays > 7;

  // Rating stamp classes
  const ratingBg =
    houseCall.rating === "BUY"
      ? "bg-profit text-background"
      : houseCall.rating === "SELL"
        ? "bg-destructive text-white"
        : "bg-amber-500 text-background";

  return (
    <div className="qq-panel flex flex-wrap items-center gap-3 px-4 py-3">
      {/* Rating stamp */}
      <span
        className={`inline-flex items-center rounded px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-[0.12em] ${ratingBg}`}
      >
        {houseCall.rating}
      </span>

      {/* Age */}
      <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <span>{ageDays}d old</span>
        {isStale && (
          <span className="inline-flex items-center rounded border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-destructive">
            STALE
          </span>
        )}
      </span>

      {/* View full report link */}
      <Link
        href={`/report/${ticker}`}
        className={actions ? "font-mono text-xs text-primary hover:underline" : "ml-auto font-mono text-xs text-primary hover:underline"}
      >
        View full report →
      </Link>

      {/* Optional action buttons (right-aligned) */}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
