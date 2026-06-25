import type { EarningsBreakdown, EarningsLine, EarningsTrendPoint } from "@/lib/ledger/types";

// ── formatting helpers ───────────────────────────────────────────────────────

function fmtMoney(value: number, key: string): string {
  if (key === "eps") return `$${value.toFixed(2)}`;
  if (key === "shares") return `${(value / 1e6).toFixed(1)}M`;
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

function fmtYoY(yoy: number | null): { text: string; positive: boolean } | null {
  if (yoy == null) return null;
  return {
    text: `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%`,
    positive: yoy >= 0,
  };
}

function fmtMargin(pct: number | null): string {
  if (pct == null) return "";
  return `${pct.toFixed(1)}%`;
}

// ── visual waterfall bar ─────────────────────────────────────────────────────

/**
 * Computes a bar for each visible line. Bar width is proportional to the
 * absolute value relative to the max visible value (revenue is the anchor).
 * Returns a width percentage 0–100.
 */
function barWidth(value: number, maxValue: number): number {
  if (maxValue === 0) return 0;
  return Math.min(100, Math.round((Math.abs(value) / maxValue) * 100));
}

// ── sparkline SVG ────────────────────────────────────────────────────────────

function MarginSparkline({ points, color, label, keyName }: {
  points: EarningsTrendPoint[];
  color: string;
  label: string;
  keyName: "operatingMarginPct" | "netMarginPct" | "fcfMarginPct";
}) {
  const values = points.map(p => p[keyName]);
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return null;

  const W = 220;
  const H = 56;
  const PAD = 6;
  const minV = Math.min(...valid);
  const maxV = Math.max(...valid);
  const range = maxV - minV || 1;
  const xy = (v: number | null, i: number) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - 2 * PAD);
    const y = v == null ? H / 2 : H - PAD - ((v - minV) / range) * (H - 2 * PAD);
    return { x, y };
  };
  const pts = values.map((v, i) => { const { x, y } = xy(v, i); return `${x.toFixed(1)},${y.toFixed(1)}`; });
  const lastVal = values[values.length - 1];

  return (
    <div style={{ border: "1px solid var(--border)", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          whiteSpace: "nowrap",
        }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700, color }}>
          {lastVal != null ? `${lastVal.toFixed(1)}%` : "—"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", marginTop: "6px" }}>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => {
          if (v == null) return null;
          const { x, y } = xy(v, i);
          return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} />;
        })}
      </svg>
    </div>
  );
}

// ── single waterfall row ─────────────────────────────────────────────────────

function WaterfallRow({ line, maxValue, isCashBlock }: {
  line: EarningsLine;
  maxValue: number;
  isCashBlock: boolean;
}) {
  if (line.value == null) return null;

  const isDeduction = line.kind === "deduction";
  const isTotal = line.kind === "total";
  const isSubtotal = line.kind === "subtotal";
  const isPershare = line.kind === "pershare";
  const isCashflow = line.kind === "cashflow";

  const bw = barWidth(line.value, maxValue);
  const yoy = fmtYoY(line.yoyPct);

  // Bar color
  let barColor = "var(--bull)";
  if (isDeduction) barColor = "var(--bear)";
  else if (isTotal) barColor = "var(--foreground)";
  else if (isCashflow) barColor = "var(--info)";

  // Bar opacity — subtotals are slightly lighter
  const barOpacity = isTotal ? "0.9" : isDeduction ? "0.7" : "0.55";

  // Row typography
  const isHeavy = isTotal || isSubtotal;
  const rowBorderLeft = isTotal
    ? "3px solid var(--foreground)"
    : isSubtotal
    ? "3px solid var(--bull)"
    : isCashflow
    ? "3px solid var(--info)"
    : "3px solid transparent";

  const displayValue = isDeduction ? `− ${fmtMoney(line.value, line.key)}` : fmtMoney(line.value, line.key);

  return (
    <div
      style={{
        borderLeft: rowBorderLeft,
        paddingLeft: "10px",
        paddingTop: isHeavy ? "7px" : "4px",
        paddingBottom: isHeavy ? "7px" : "4px",
        borderTop: isTotal && !isCashBlock ? "1px solid var(--border)" : "none",
        marginTop: isTotal ? "4px" : 0,
      }}
    >
      {/* Aligned columns: label | value | margin | YoY */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 92px 50px 60px",
        alignItems: "baseline",
        columnGap: "10px",
        marginBottom: !isPershare && bw > 0 ? "5px" : 0,
      }}>
        <span style={{
          fontFamily: isHeavy ? "var(--font-heading)" : "var(--font-mono)",
          fontSize: isHeavy ? "13px" : "12px",
          fontWeight: isHeavy ? 700 : 400,
          color: isHeavy ? "var(--foreground)" : "var(--muted-foreground)",
          letterSpacing: isHeavy ? ".01em" : ".03em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {line.label}
        </span>

        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: isHeavy ? "13px" : "12px",
          fontWeight: isHeavy ? 700 : 400,
          color: isDeduction ? "var(--bear)" : isHeavy ? "var(--foreground)" : "var(--muted-foreground)",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}>
          {displayValue}
        </span>

        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--muted-foreground)",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}>
          {fmtMargin(line.marginPct)}
        </span>

        <span style={{ justifySelf: "start" }}>
          {yoy && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              color: yoy.positive ? "var(--bull)" : "var(--bear)",
              background: yoy.positive
                ? "color-mix(in srgb,var(--bull) 12%,transparent)"
                : "color-mix(in srgb,var(--bear) 12%,transparent)",
              padding: "1px 6px",
              whiteSpace: "nowrap",
            }}>
              {yoy.text}
            </span>
          )}
        </span>
      </div>

      {/* Visual bar — full width below the aligned row */}
      {!isPershare && bw > 0 && (
        <div style={{
          height: isTotal ? "5px" : "3px",
          width: "100%",
          background: "color-mix(in srgb,var(--border) 60%,transparent)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${bw}%`,
            background: barColor,
            opacity: barOpacity,
          }} />
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function EarningsWaterfallSection({
  breakdown,
  heading = "Income Statement",
}: {
  breakdown: EarningsBreakdown | null | undefined;
  heading?: string;
}) {
  if (!breakdown) return null;

  // Guard: all values null → render nothing
  const hasAnyValue = breakdown.lines.some(l => l.value != null);
  if (!hasAnyValue) return null;

  // Separate cash-flow lines for their own block
  const incomeLines = breakdown.lines.filter(l => l.kind !== "cashflow");
  const cashLines = breakdown.lines.filter(l => l.kind === "cashflow");

  // Max value for proportional bars — anchor on the largest non-null absolute value
  const allValues = breakdown.lines
    .filter(l => l.value != null && l.kind !== "pershare" && l.kind !== "cashflow")
    .map(l => Math.abs(l.value!));
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;

  const cashMaxValue = cashLines.filter(l => l.value != null).reduce(
    (m, l) => Math.max(m, Math.abs(l.value!)),
    1,
  );

  const showTrend = breakdown.trend.length >= 2;

  return (
    <div style={{ marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>

      {/* ── header ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--foreground)",
        }}>
          {heading}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: ".04em",
          color: "var(--muted-foreground)",
        }}>
          {breakdown.fiscalLabel} · {breakdown.form} · ended {breakdown.periodEnd}
        </span>
      </div>

      {/* ── P&L waterfall (full width) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {incomeLines.map((line) =>
          line.value != null ? (
            <WaterfallRow key={line.key} line={line} maxValue={maxValue} isCashBlock={false} />
          ) : null,
        )}
      </div>

      {/* Cash flow block — visually separated */}
      {cashLines.some((l) => l.value != null) && (
        <div style={{ marginTop: "14px", borderTop: "1px dashed var(--border)", paddingTop: "10px" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--info)",
            marginBottom: "6px",
          }}>
            Cash Flows
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {cashLines.map((line) =>
              line.value != null ? (
                <WaterfallRow key={line.key} line={line} maxValue={cashMaxValue} isCashBlock={true} />
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* ── margin trend strip (full width, below) ── */}
      {showTrend && (
        <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted-foreground)",
            marginBottom: "10px",
          }}>
            Margin Trend · {breakdown.trend[0]?.fiscalLabel}→{breakdown.trend[breakdown.trend.length - 1]?.fiscalLabel}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <MarginSparkline points={breakdown.trend} color="var(--bull)" label="Op. Margin" keyName="operatingMarginPct" />
            <MarginSparkline points={breakdown.trend} color="var(--info)" label="Net Margin" keyName="netMarginPct" />
            <MarginSparkline points={breakdown.trend} color="var(--warn)" label="FCF Margin" keyName="fcfMarginPct" />
          </div>
        </div>
      )}

      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        color: "var(--muted-foreground)",
        marginTop: "10px",
        fontStyle: "italic",
      }}>
        Income statement from SEC EDGAR XBRL · {breakdown.fiscalLabel} {breakdown.form} · bars scaled to revenue.
      </p>
    </div>
  );
}
