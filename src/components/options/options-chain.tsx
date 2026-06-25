import Link from "next/link";

import { fetchYahooOptions, type OptionContract } from "@/lib/options/yahoo";
import { cn } from "@/lib/utils";

// Render-only — server component. Fetch happens inline so the chain caches
// with the surrounding page. Expiration is driven by a search param on the
// stock page (no client interactivity needed).

export async function OptionsChain({
  ticker,
  expiration,
}: {
  ticker: string;
  expiration?: string;
}) {
  const result = await fetchYahooOptions(ticker, expiration);

  if (!result.ok) {
    return <OptionsChainEmpty ticker={ticker} reason={result.reason} message={result.message} />;
  }

  const { chain } = result;
  const { calls, puts, spot, selectedExpiration, expirations } = chain;
  const strikes = mergeStrikes(calls, puts);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
            Spot
          </span>
          <span className="font-mono font-semibold text-foreground">
            {spot != null ? formatPrice(spot) : "—"}
          </span>
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
            Exp
          </span>
          <span className="font-mono text-xs font-bold text-sky-400">{selectedExpiration}</span>
          <span className="font-mono text-[0.62rem] text-muted-foreground">
            ({Math.round(calls[0]?.dte ?? puts[0]?.dte ?? 0)}d)
          </span>
        </div>
        <ExpirationPicker
          ticker={ticker}
          expirations={expirations}
          selected={selectedExpiration}
        />
      </div>

      <div className="overflow-x-auto rounded border border-border bg-card">
        <table className="w-full min-w-[1100px] border-collapse text-[0.74rem]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              <th className="data-label py-2 text-center" colSpan={9}>
                <span className="text-profit">Calls</span>
              </th>
              <th className="data-label py-2 text-center">Strike</th>
              <th className="data-label py-2 text-center" colSpan={9}>
                <span className="text-loss">Puts</span>
              </th>
            </tr>
            <tr className="border-b border-border bg-muted/30">
              <Col label="Δ" />
              <Col label="Γ" />
              <Col label="Θ" />
              <Col label="V" />
              <Col label="IV" />
              <Col label="OI" />
              <Col label="Vol" />
              <Col label="Last" />
              <Col label="Bid/Ask" />
              <th className="px-2 py-1.5 text-center font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-foreground">
                $
              </th>
              <Col label="Bid/Ask" />
              <Col label="Last" />
              <Col label="Vol" />
              <Col label="OI" />
              <Col label="IV" />
              <Col label="V" />
              <Col label="Θ" />
              <Col label="Γ" />
              <Col label="Δ" />
            </tr>
          </thead>
          <tbody>
            {strikes.length === 0 ? (
              <tr>
                <td colSpan={19} className="py-8 text-center text-sm text-muted-foreground">
                  No strikes available for this expiration.
                </td>
              </tr>
            ) : (
              strikes.map((strike) => {
                const call = calls.find((c) => c.strike === strike) ?? null;
                const put = puts.find((p) => p.strike === strike) ?? null;
                const atm =
                  spot != null &&
                  Math.abs(strike - spot) <=
                    Math.abs((strikes[1] ?? strikes[0] ?? 0) - (strikes[0] ?? 0)) / 2 + 0.01;

                return (
                  <tr
                    key={strike}
                    className={cn(
                      "border-b border-border hover:bg-muted/40",
                      atm && "bg-primary/[0.06]",
                    )}
                  >
                    {/* Calls */}
                    <CallCell value={call?.delta} format={formatGreek} dim={!call?.inTheMoney} />
                    <CallCell value={call?.gamma} format={formatGreek} dim={!call?.inTheMoney} />
                    <CallCell value={call?.theta} format={formatGreek} dim={!call?.inTheMoney} />
                    <CallCell value={call?.vega} format={formatGreek} dim={!call?.inTheMoney} />
                    <CallCell value={call?.impliedVolatility} format={formatIV} dim={!call?.inTheMoney} />
                    <CallCell value={call?.openInterest} format={formatInt} dim={!call?.inTheMoney} />
                    <CallCell value={call?.volume} format={formatInt} dim={!call?.inTheMoney} />
                    <CallCell value={call?.lastPrice} format={formatPrice} dim={!call?.inTheMoney} />
                    <td
                      className={cn(
                        "px-2 py-1 text-right font-mono text-[0.7rem] tabular-nums",
                        call?.inTheMoney ? "text-profit" : "text-muted-foreground",
                      )}
                    >
                      {formatBidAsk(call?.bid, call?.ask)}
                    </td>

                    {/* Strike */}
                    <td
                      className={cn(
                        "border-x border-border px-2 py-1 text-center font-mono text-[0.78rem] font-semibold",
                        atm ? "text-primary" : "text-foreground",
                      )}
                    >
                      {formatStrike(strike)}
                    </td>

                    {/* Puts */}
                    <td
                      className={cn(
                        "px-2 py-1 text-right font-mono text-[0.7rem] tabular-nums",
                        put?.inTheMoney ? "text-loss" : "text-muted-foreground",
                      )}
                    >
                      {formatBidAsk(put?.bid, put?.ask)}
                    </td>
                    <PutCell value={put?.lastPrice} format={formatPrice} dim={!put?.inTheMoney} />
                    <PutCell value={put?.volume} format={formatInt} dim={!put?.inTheMoney} />
                    <PutCell value={put?.openInterest} format={formatInt} dim={!put?.inTheMoney} />
                    <PutCell value={put?.impliedVolatility} format={formatIV} dim={!put?.inTheMoney} />
                    <PutCell value={put?.vega} format={formatGreek} dim={!put?.inTheMoney} />
                    <PutCell value={put?.theta} format={formatGreek} dim={!put?.inTheMoney} />
                    <PutCell value={put?.gamma} format={formatGreek} dim={!put?.inTheMoney} />
                    <PutCell value={put?.delta} format={formatGreek} dim={!put?.inTheMoney} />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-[0.66rem] text-muted-foreground">
        Greeks (Δ Γ Θ V) computed locally via Black-Scholes from spot, IV, and DTE
        — assumes 5% risk-free rate, dividend yield from Yahoo quote. Theta is
        per calendar day; vega is per 1 vol point. American-exercise premium is
        not modeled. Data via Yahoo Finance.
      </p>
    </div>
  );
}

function OptionsChainEmpty({
  ticker,
  reason,
  message,
}: {
  ticker: string;
  reason: "no-options" | "fetch-failed" | "parse-failed";
  message?: string;
}) {
  const title =
    reason === "no-options"
      ? "No options listed"
      : reason === "fetch-failed"
        ? "Could not fetch options"
        : "Could not parse options response";
  const body =
    reason === "no-options"
      ? `${ticker} has no exchange-listed options chain on Yahoo Finance.`
      : `Yahoo's unofficial endpoint refused or timed out${message ? ` (${message})` : ""}. This is expected from cloud IPs; refresh from your local browser or try again later.`;

  return (
    <div className="rounded border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function ExpirationPicker({
  ticker,
  expirations,
  selected,
}: {
  ticker: string;
  expirations: string[];
  selected: string;
}) {
  if (expirations.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {expirations.slice(0, 8).map((exp) => (
        <Link
          key={exp}
          href={`/analysis/stocks/${encodeURIComponent(ticker)}?exp=${exp}`}
          scroll={false}
          className={cn(
            "rounded border px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] transition",
            exp === selected
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted text-muted-foreground hover:border-primary/25 hover:text-foreground",
          )}
        >
          {exp.slice(5)}
        </Link>
      ))}
    </div>
  );
}

function Col({ label }: { label: string }) {
  return (
    <th className="px-2 py-1.5 text-right font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </th>
  );
}

function CallCell({
  value,
  format,
  dim,
}: {
  value: number | null | undefined;
  format: (n: number) => string;
  dim: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-1 text-right font-mono text-[0.7rem] tabular-nums",
        dim ? "text-muted-foreground" : "text-profit",
      )}
    >
      {value == null ? "—" : format(value)}
    </td>
  );
}

function PutCell({
  value,
  format,
  dim,
}: {
  value: number | null | undefined;
  format: (n: number) => string;
  dim: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-1 text-right font-mono text-[0.7rem] tabular-nums",
        dim ? "text-muted-foreground" : "text-loss",
      )}
    >
      {value == null ? "—" : format(value)}
    </td>
  );
}

function mergeStrikes(calls: OptionContract[], puts: OptionContract[]): number[] {
  const set = new Set<number>();
  for (const c of calls) set.add(c.strike);
  for (const p of puts) set.add(p.strike);
  return [...set].sort((a, b) => a - b);
}

function formatStrike(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 2,
  });
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value < 1
    ? value.toFixed(3)
    : value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatBidAsk(bid: number | null | undefined, ask: number | null | undefined): string {
  if (bid == null && ask == null) return "—";
  return `${bid == null ? "—" : formatPrice(bid)} / ${ask == null ? "—" : formatPrice(ask)}`;
}

function formatInt(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

function formatIV(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatGreek(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1) return value.toFixed(2);
  if (Math.abs(value) >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}
