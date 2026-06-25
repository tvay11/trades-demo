import type { AnalystConsensus } from "@/lib/ledger/types";

import { HeroBand, HeroCell } from "./primitives";

function pct(n: number | null, sign = true): string {
  if (n == null) return "—";
  const s = sign && n > 0 ? "+" : n < 0 ? "" : "";
  return `${s}${n.toFixed(1)}%`;
}

function usd(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function upsideColor(up: number | null): string {
  if (up == null) return "var(--muted-foreground)";
  if (up > 15) return "var(--bull)";
  if (up < -10) return "var(--bear)";
  return "var(--warn)";
}

export function AnalystConsensusSection({ analyst }: { analyst: AnalystConsensus | null }) {
  if (!analyst) return null;

  const { targetMean, targetHigh, targetLow, numAnalysts, recommendationKey, recommendationMean, upsidePct, counts } = analyst;

  const totalCounts = counts
    ? counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell
    : 0;

  const upColor = upsideColor(upsidePct);

  return (
    <div className="sec">
      <div className="secline">
        <h3>Street View — Analyst Consensus</h3>
        <span className="meta">
          {numAnalysts != null ? `${numAnalysts} price targets` : ""}
          {recommendationKey ? ` · ${recommendationKey.toUpperCase()}` : ""}
          {recommendationMean != null ? ` · mean ${recommendationMean.toFixed(2)}` : ""}
        </span>
      </div>

      {/* Upside / target */}
      <HeroBand>
        <HeroCell label="Upside to Target">
          <span style={{ fontSize: "32px", color: upColor }}>{upsidePct != null ? pct(upsidePct) : "—"}</span>
        </HeroCell>
        <HeroCell label="Mean Target">{usd(targetMean)}</HeroCell>
        <HeroCell align="left" label="Range">
          <span style={{ fontSize: "13px", fontWeight: 400 }}>
            {usd(targetLow)} — {usd(targetHigh)}
          </span>
        </HeroCell>
      </HeroBand>

      {/* Stacked bar of buy/hold/sell counts */}
      {counts != null && totalCounts > 0 && (
        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--muted-foreground)",
              marginBottom: "6px",
            }}
          >
            Rating distribution ({totalCounts} ratings)
          </div>
          {/* Stacked bar */}
          <div
            style={{
              display: "flex",
              height: "20px",
              border: "1px solid var(--foreground)",
              overflow: "hidden",
              fontFamily: "var(--font-mono)",
              fontSize: "9.5px",
            }}
          >
            {counts.strongBuy > 0 && (
              <div
                title={`Strong Buy: ${counts.strongBuy}`}
                style={{
                  flex: counts.strongBuy,
                  background: "var(--bull-deep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {counts.strongBuy}
              </div>
            )}
            {counts.buy > 0 && (
              <div
                title={`Buy: ${counts.buy}`}
                style={{
                  flex: counts.buy,
                  background: "var(--bull-fill)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {counts.buy}
              </div>
            )}
            {counts.hold > 0 && (
              <div
                title={`Hold: ${counts.hold}`}
                style={{
                  flex: counts.hold,
                  background: "var(--warn-fill)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {counts.hold}
              </div>
            )}
            {counts.sell > 0 && (
              <div
                title={`Sell: ${counts.sell}`}
                style={{
                  flex: counts.sell,
                  background: "var(--bear-fill)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {counts.sell}
              </div>
            )}
            {counts.strongSell > 0 && (
              <div
                title={`Strong Sell: ${counts.strongSell}`}
                style={{
                  flex: counts.strongSell,
                  background: "var(--bear-deep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {counts.strongSell}
              </div>
            )}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "14px", marginTop: "5px", fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--muted-foreground)" }}>
            <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--bull-deep)", marginRight: "3px" }} />Strong Buy {counts.strongBuy}</span>
            <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--bull-fill)", marginRight: "3px" }} />Buy {counts.buy}</span>
            <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--warn-fill)", marginRight: "3px" }} />Hold {counts.hold}</span>
            <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--bear-fill)", marginRight: "3px" }} />Sell {counts.sell}</span>
            <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--bear-deep)", marginRight: "3px" }} />Strong Sell {counts.strongSell}</span>
          </div>
        </div>
      )}

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--muted-foreground)",
          marginTop: "6px",
        }}
      >
        Data via Yahoo Finance · analyst targets are lagging indicators — verify freshness before acting.
      </p>
    </div>
  );
}
