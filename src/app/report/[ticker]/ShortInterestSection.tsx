import type { ShortInterest } from "@/lib/ledger/types";

import { MetricTile, type MetricTone, Stamp } from "./primitives";

function fmtShares(n: number | null): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString("en-US");
}

export function ShortInterestSection({ shortInterest }: { shortInterest: ShortInterest | null }) {
  if (!shortInterest) return null;

  const { percentOfFloat, daysToCover, sharesShort, changePct } = shortInterest;

  // Hide section if all numeric fields are null
  if (percentOfFloat == null && daysToCover == null && sharesShort == null) return null;

  const isCrowded = percentOfFloat != null && percentOfFloat > 15;

  const floatStatus: { text: string; tone: MetricTone } | null =
    percentOfFloat == null
      ? null
      : percentOfFloat > 20
      ? { text: "very high", tone: "bad" }
      : percentOfFloat > 10
      ? { text: "elevated", tone: "warn" }
      : { text: "normal", tone: "good" };

  const dtcStatus: { text: string; tone: MetricTone } | null =
    daysToCover == null
      ? null
      : daysToCover > 5
      ? { text: "squeeze prone", tone: "bad" }
      : daysToCover > 2
      ? { text: "moderate", tone: "warn" }
      : { text: "low", tone: "good" };

  return (
    <div className="sec">
      <div className="secline">
        <h3>Short Interest</h3>
        <span className="meta">Yahoo Finance · as of last settlement</span>
      </div>

      {isCrowded && (
        <p style={{ fontSize: "14px", marginBottom: "12px" }}>
          <Stamp tone="warn" inline>CROWDED SHORT</Stamp>
          {percentOfFloat!.toFixed(1)}% of float sold short — elevated squeeze risk alongside bearish positioning.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px" }}>
        {percentOfFloat != null && (
          <MetricTile
            label="Short % of float"
            value={`${percentOfFloat.toFixed(1)}%`}
            status={floatStatus}
            gaugePct={(percentOfFloat / 30) * 100}
          />
        )}
        {daysToCover != null && (
          <MetricTile
            label="Days to cover"
            value={`${daysToCover.toFixed(1)} days`}
            status={dtcStatus}
            gaugePct={(daysToCover / 8) * 100}
          />
        )}
        {sharesShort != null && (
          <MetricTile
            label="Shares short"
            value={fmtShares(sharesShort)}
            caption={
              changePct != null
                ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% MoM (${changePct >= 0 ? "rising" : "falling"} SI)`
                : "total sold short"
            }
          />
        )}
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--muted-foreground)",
          marginTop: "8px",
        }}
      >
        High short interest cuts both ways: bearish positioning, but a catalyst can trigger a squeeze. No house-call tilt applied.
      </p>
    </div>
  );
}
