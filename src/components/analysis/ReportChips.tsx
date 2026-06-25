import type { ReportSignals } from "@/lib/queries/reportSignals";

interface ReportChipsProps {
  signals: ReportSignals | undefined | null;
}

export function ReportChips({ signals }: ReportChipsProps) {
  if (!signals) return null;

  const { rating } = signals;

  const ratingClass =
    rating === "BUY"
      ? "border-profit/25 bg-profit/10 text-profit"
      : rating === "SELL"
        ? "border-destructive/25 bg-destructive/10 text-destructive"
        : "border-amber-400/25 bg-amber-400/10 text-amber-700 dark:text-amber-400";

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] ${ratingClass}`}
      >
        {rating}
      </span>
    </span>
  );
}
