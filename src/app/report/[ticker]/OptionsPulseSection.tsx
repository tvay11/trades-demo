import { earningsInsideWindow } from "@/lib/ledger/earningsWindow";
import type { NextEarnings, OptionsLean, OptionsSignal } from "@/lib/ledger/types";

import { MetricTile, type MetricTone } from "./primitives";

function leanColor(lean: OptionsLean): string {
  return lean === "bullish" ? "var(--bull-fill)" : lean === "bearish" ? "var(--bear-fill)" : "var(--warn-fill)";
}

export function OptionsPulseSection({
  options,
  nextEarnings,
}: {
  options: OptionsSignal | null;
  nextEarnings?: NextEarnings | null;
}) {
  if (!options) return null;

  const badgeColor = leanColor(options.lean);

  const pcrVolStatus: { text: string; tone: MetricTone } | null =
    options.putCallVolume == null
      ? null
      : options.putCallVolume > 1.1
      ? { text: "put dominated", tone: "bad" }
      : options.putCallVolume < 0.7
      ? { text: "call dominated", tone: "good" }
      : { text: "balanced", tone: "neutral" };

  const skewStatus: { text: string; tone: MetricTone } | null =
    options.ivSkewPct == null
      ? null
      : options.ivSkewPct > 0
      ? { text: "downside fear", tone: "bad" }
      : { text: "upside demand", tone: "good" };

  const ivRankStatus: { text: string; tone: MetricTone } | null =
    options.ivRankPct == null
      ? null
      : options.ivRankPct < 25
      ? { text: "cheap", tone: "good" }
      : options.ivRankPct > 75
      ? { text: "rich", tone: "bad" }
      : { text: "mid", tone: "neutral" };

  return (
    <div className="sec">
      <div className="secline">
        <h3>Options Pulse</h3>
        <span className="meta">
          yahoo-finance2 · expiry {options.expiration}{options.daysToExp != null ? ` (${options.daysToExp}d)` : ""} · as of {options.asOf}
        </span>
      </div>

      <p style={{ fontSize: "15px", marginBottom: "12px" }}>
        Options market sentiment:{" "}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#fff",
            background: badgeColor,
            padding: "2px 8px",
            marginLeft: "4px",
          }}
        >
          {options.lean.toUpperCase()}
        </span>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px" }}>
        {options.putCallVolume != null && (
          <MetricTile
            label="Put / Call volume"
            value={options.putCallVolume.toFixed(2)}
            status={pcrVolStatus}
            gaugePct={(options.putCallVolume / 2) * 100}
          />
        )}
        {options.putCallOI != null && (
          <MetricTile
            label="Put / Call open interest"
            value={options.putCallOI.toFixed(2)}
            gaugePct={(options.putCallOI / 2) * 100}
          />
        )}
        {options.atmIvPct != null && (
          <MetricTile label="ATM implied vol" value={`${options.atmIvPct.toFixed(2)}%`} caption="annualized" />
        )}
        {options.ivSkewPct != null && (
          <MetricTile label="IV skew (put − call)" value={`${options.ivSkewPct.toFixed(2)} pp`} status={skewStatus} />
        )}
        {options.expectedMovePct != null && (
          <MetricTile
            label={`Expected move${options.daysToExp != null ? ` (${options.daysToExp}d)` : ""}`}
            value={`±${options.expectedMovePct.toFixed(1)}%`}
            caption={`by ${options.expiration}`}
          />
        )}
        {options.expectedMove60dPct != null && options.expiration60d != null && (
          <MetricTile
            label="Expected move (~60d)"
            value={`±${options.expectedMove60dPct.toFixed(1)}%`}
            caption={`by ${options.expiration60d}`}
          />
        )}
        {options.ivRankPct != null && (
          <MetricTile
            label="IV rank (own history)"
            value={`${options.ivRankPct}%`}
            status={ivRankStatus}
            gaugePct={options.ivRankPct}
          />
        )}
      </div>

      {earningsInsideWindow(nextEarnings?.daysUntil ?? null, options.daysToExp) && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--warn)", fontWeight: 700, marginTop: "10px" }}>
          ⚑ Earnings ≈{nextEarnings!.date} falls inside this expiry window — IV-crush / binary-event risk for premium buyers.
        </p>
      )}

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--muted-foreground)",
          marginTop: "8px",
        }}
      >
        Data via Yahoo Finance options chain · implied vol reflects market pricing of uncertainty only.
      </p>
    </div>
  );
}
