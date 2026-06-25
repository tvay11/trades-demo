import Link from "next/link";
import type { AltFlowMovers, DarkShortSpike, GovContractMover, WsbSurgeRow } from "@/lib/queries/altFlowMovers";

function formatUsd(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

function truncate(str: string | null, maxLen: number): string {
  if (!str) return "—";
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

function TickerLink({ ticker }: { ticker: string }) {
  return (
    <Link
      href={`/analysis/stocks/${ticker}`}
      className="font-mono text-xs font-bold text-primary transition hover:text-primary/80"
    >
      ${ticker}
    </Link>
  );
}

function WsbSurgesColumn({ rows }: { rows: WsbSurgeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="border-b border-border bg-muted px-4 py-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          WSB Surges
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div
            key={row.ticker}
            className="flex items-center justify-between gap-2 px-4 py-1.5 hover:bg-muted/40"
          >
            <TickerLink ticker={row.ticker} />
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono tabular-nums text-xs text-profit">
                ×{row.surgeRatio.toFixed(1)}
              </span>
              <span className="font-mono tabular-nums text-[0.68rem] text-muted-foreground">
                {row.mentions7d.toLocaleString()}m
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DarkShortSpikesColumn({ rows }: { rows: DarkShortSpike[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="border-b border-border bg-muted px-4 py-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          Dark Short Spikes
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div
            key={row.ticker}
            className="flex items-center justify-between gap-2 px-4 py-1.5 hover:bg-muted/40"
          >
            <TickerLink ticker={row.ticker} />
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono tabular-nums text-xs text-destructive">
                +{row.excessPp.toFixed(1)}pp
              </span>
              <span className="font-mono tabular-nums text-[0.68rem] text-muted-foreground">
                {row.latestShortVolPct.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GovContractsColumn({ rows }: { rows: GovContractMover[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="border-b border-border bg-muted px-4 py-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          Gov Contracts
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row, i) => (
          <div
            key={`${row.ticker}-${i}`}
            className="flex items-center justify-between gap-2 px-4 py-1.5 hover:bg-muted/40"
          >
            <div className="min-w-0">
              <TickerLink ticker={row.ticker} />
              <div className="mt-0.5 truncate font-mono text-[0.65rem] text-muted-foreground">
                {truncate(row.agency, 28)}
              </div>
            </div>
            <span className="font-mono tabular-nums text-xs text-foreground shrink-0">
              {formatUsd(row.amountUsd)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AltFlowMoversSection({ movers }: { movers: AltFlowMovers }) {
  const { wsbSurges, darkShortSpikes, govContracts } = movers;
  const hasWsb = wsbSurges.length > 0;
  const hasDark = darkShortSpikes.length > 0;
  const hasGov = govContracts.length > 0;

  if (!hasWsb && !hasDark && !hasGov) return null;

  return (
    <section className="qq-panel overflow-hidden">
      <div className="qq-section-header">
        <div>
          <h2 className="qq-section-title">Alt-Flow Movers</h2>
          <p className="qq-section-subtitle">WSB surges · dark short spikes · gov contracts</p>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <WsbSurgesColumn rows={wsbSurges} />
        <DarkShortSpikesColumn rows={darkShortSpikes} />
        <GovContractsColumn rows={govContracts} />
      </div>
    </section>
  );
}
