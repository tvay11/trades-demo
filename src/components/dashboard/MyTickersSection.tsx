import Link from "next/link";
import { ReportChips } from "@/components/analysis/ReportChips";
import type { MorningBriefRow } from "@/lib/queries/morningBrief";

function formatPrice(price: number): string {
  if (price < 10) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MyTickersSection({ rows }: { rows: MorningBriefRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="qq-panel overflow-hidden">
      <div className="qq-section-header">
        <div>
          <h2 className="qq-section-title">My Tickers</h2>
          <p className="qq-section-subtitle">watchlist + reported · live quotes</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[0.82rem]">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="data-label h-9 px-4 text-left font-medium">Ticker</th>
              <th className="data-label px-4 text-right font-medium">Price</th>
              <th className="data-label px-4 text-right font-medium">Day %</th>
              <th className="data-label px-4 text-right font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MyTickerRow key={row.ticker} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MyTickerRow({ row }: { row: MorningBriefRow }) {
  const { ticker, price, changePct, signals, changed, reportAgeDays } = row;
  const isStale = reportAgeDays !== null && reportAgeDays > 7;

  return (
    <tr className="row-stripe border-b border-border hover:bg-muted">
      {/* Ticker + chips */}
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/report/${ticker}`}
            className="font-mono text-xs font-bold text-primary transition hover:text-primary/80"
          >
            ${ticker}
          </Link>
          <ReportChips signals={signals} />
          {changed !== null && (
            <span
              className="inline-flex rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-primary"
              title={`${changed} changed vs previous report`}
            >
              CHANGED
            </span>
          )}
        </div>
      </td>

      {/* Price */}
      <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
        {price !== null ? formatPrice(price) : "—"}
      </td>

      {/* Day % */}
      <td
        className={[
          "px-4 py-2 text-right font-mono tabular-nums",
          changePct === null
            ? "text-muted-foreground"
            : changePct > 0
              ? "text-profit"
              : changePct < 0
                ? "text-destructive"
                : "text-muted-foreground",
        ].join(" ")}
      >
        {changePct !== null
          ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%`
          : "—"}
      </td>

      {/* Report age */}
      <td className="px-4 py-2 text-right">
        {reportAgeDays !== null ? (
          <span className="inline-flex items-center gap-1">
            <span className="font-mono tabular-nums text-muted-foreground">
              {reportAgeDays}d
            </span>
            {isStale && (
              <span className="inline-flex rounded border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-destructive">
                STALE
              </span>
            )}
          </span>
        ) : (
          <span className="font-mono text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
