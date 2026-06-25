import { earningsInsideWindow } from "@/lib/ledger/earningsWindow";
import type { NextEarnings, TradeBias, TradeLens } from "@/lib/ledger/types";

function biasColor(bias: TradeBias): string {
  if (bias === "long calls" || bias === "call spreads") return "var(--bull-fill)";
  if (bias === "long puts" || bias === "put spreads") return "var(--bear-fill)";
  return "var(--warn-fill)";
}

function edgeColor(edge: TradeLens["edge"]): string {
  if (edge === "cheap") return "var(--bull)";
  if (edge === "rich") return "#7c2d2d"; // oxblood — not a signal token
  if (edge === "fair") return "var(--warn)";
  return "var(--muted-foreground)";
}

function fmt1(n: number | null, suffix = ""): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}${suffix}`;
}

export function OptionsTradeLensSection({
  lens,
  nextEarnings,
  daysToExp60,
}: {
  lens: TradeLens | null;
  nextEarnings?: NextEarnings | null;
  daysToExp60?: number | null;
}) {
  if (!lens) return null;

  const bColor = biasColor(lens.bias);
  const eColor = edgeColor(lens.edge);

  const edgeLabel =
    lens.edge === "cheap"
      ? "premium cheap"
      : lens.edge === "rich"
      ? "premium rich"
      : lens.edge === "fair"
      ? "roughly fair"
      : "—";

  const forecastLabel =
    lens.kronosMovePct != null
      ? `Forecast ±${fmt1(lens.kronosMovePct)}%`
      : "Forecast —";
  const impliedLabel =
    lens.impliedMovePct != null
      ? `implied ±${fmt1(lens.impliedMovePct)}%`
      : "implied —";

  return (
    <div className="sec">
      <div className="secline">
        <h3>Options Trade Lens</h3>
        <span className="meta">forecast vs implied · research only</span>
      </div>

      {/* Primary row: bias chip + P(up) + edge comparison */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "18px",
          marginBottom: "14px",
          fontFamily: "var(--font-mono)",
        }}
      >
        {/* Bias chip */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#fff",
            background: bColor,
            padding: "5px 14px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
          }}
        >
          {lens.bias}
        </span>

        {/* P(up) */}
        {lens.probUp != null && (
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
                marginBottom: "3px",
              }}
            >
              P(up)
            </span>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: lens.probUp >= 50 ? "var(--bull)" : "var(--bear)",
              }}
            >
              {lens.probUp.toFixed(0)}%
            </span>
          </span>
        )}

        {/* Forecast vs implied comparison */}
        <span
          style={{
            fontSize: "13px",
            fontVariantNumeric: "tabular-nums",
            color: "var(--foreground)",
          }}
        >
          {forecastLabel} vs {impliedLabel}{" "}
          <span
            style={{
              fontWeight: 700,
              color: eColor,
            }}
          >
            → {edgeLabel}
          </span>
        </span>
      </div>

      {/* Note */}
      <p
        style={{
          fontSize: "13.5px",
          lineHeight: 1.5,
          color: "var(--foreground)",
          marginBottom: "10px",
          fontFamily: "var(--font-sans)",
          maxWidth: "860px",
        }}
      >
        {lens.note}
      </p>

      {/* Edge ratio detail */}
      {lens.edgeRatio != null && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--muted-foreground)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Edge ratio: {lens.edgeRatio.toFixed(2)}× (|forecast| ÷ implied; &gt;1.2 = cheap, &lt;0.8 = rich)
        </p>
      )}

      {earningsInsideWindow(nextEarnings?.daysUntil ?? null, daysToExp60 ?? null) && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--warn)", fontWeight: 700 }}>
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
        Research only — not financial advice. Derived from Kronos forecast + Yahoo options chain.
      </p>
    </div>
  );
}
