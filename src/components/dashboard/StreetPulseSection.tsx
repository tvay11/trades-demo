import Link from "next/link";
import type { MoverRow, SectorCell, StreetPulse } from "@/lib/queries/streetPulse";

function formatPrice(price: number): string {
  if (price < 10) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function changePctClass(pct: number): string {
  if (pct > 0) return "text-profit";
  if (pct < 0) return "text-destructive";
  return "text-muted-foreground";
}

function formatChangePct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function sectorCellClass(pct: number | null): string {
  if (pct === null) return "";
  const abs = Math.abs(pct);
  if (pct > 0) return abs > 1.5 ? "bg-profit/20" : "bg-profit/10";
  if (pct < 0) return abs > 1.5 ? "bg-destructive/20" : "bg-destructive/10";
  return "";
}

function MoverColumn({ label, rows }: { label: string; rows: MoverRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="border-b border-border bg-muted px-4 py-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div
            key={row.ticker}
            className="flex items-center justify-between gap-2 px-4 py-1.5 hover:bg-muted/40"
          >
            <Link
              href={`/analysis/stocks/${row.ticker}`}
              className="min-w-0 font-mono text-xs font-bold text-primary transition hover:text-primary/80"
            >
              ${row.ticker}
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono tabular-nums text-xs text-muted-foreground">
                {formatPrice(row.price)}
              </span>
              <span className={`font-mono tabular-nums text-xs ${changePctClass(row.changePct)}`}>
                {formatChangePct(row.changePct)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorHeatStrip({ sectors }: { sectors: SectorCell[] }) {
  if (sectors.length === 0) return null;
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
        Sector ETFs
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sectors.map((cell) => (
          <div
            key={cell.symbol}
            className={[
              "inline-flex flex-col items-center rounded border border-border px-2 py-1",
              sectorCellClass(cell.changePct),
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="font-mono text-[0.65rem] font-semibold text-foreground">
              {cell.symbol}
            </span>
            <span
              className={`font-mono tabular-nums text-[0.62rem] ${
                cell.changePct === null
                  ? "text-muted-foreground"
                  : changePctClass(cell.changePct)
              }`}
            >
              {cell.changePct === null ? "—" : formatChangePct(cell.changePct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StreetPulseSection({ pulse }: { pulse: StreetPulse }) {
  const { gainers, losers, actives, sectors } = pulse;
  const hasMovers = gainers.length > 0 || losers.length > 0 || actives.length > 0;
  const hasSectors = sectors.length > 0;

  if (!hasMovers && !hasSectors) return null;

  return (
    <section className="qq-panel overflow-hidden">
      <div className="qq-section-header">
        <div>
          <h2 className="qq-section-title">Street Pulse</h2>
          <p className="qq-section-subtitle">movers + sector heat · live</p>
        </div>
      </div>

      {hasMovers && (
        <div className="grid gap-0 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <MoverColumn label="Gainers" rows={gainers} />
          <MoverColumn label="Losers" rows={losers} />
          <MoverColumn label="Most Active" rows={actives} />
        </div>
      )}

      <SectorHeatStrip sectors={sectors} />
    </section>
  );
}
