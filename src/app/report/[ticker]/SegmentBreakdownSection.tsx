import type { SegmentBreakdown } from "@/lib/ledger/types";

// ── formatting helpers ───────────────────────────────────────────────────────

function fmtRevenue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtYoY(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// Rank-0 = info blue, rank-1 = warm info, rank-2+ = progressively muted
// All using color-mix so we stay within CSS-variable tokens only.
const RANK_COLORS = [
  "var(--info)",
  "color-mix(in srgb,var(--info) 70%,var(--warn))",
  "color-mix(in srgb,var(--info) 45%,var(--warn))",
  "color-mix(in srgb,var(--info) 30%,var(--muted-foreground))",
  "color-mix(in srgb,var(--info) 15%,var(--muted-foreground))",
];

function rankColor(rank: number): string {
  return RANK_COLORS[Math.min(rank, RANK_COLORS.length - 1)];
}

// ── main component ────────────────────────────────────────────────────────────

export function SegmentBreakdownSection({
  breakdown,
}: {
  breakdown: SegmentBreakdown | null;
}) {
  if (!breakdown || breakdown.segments.length < 2) return null;

  // Build footnote
  const footnoteParts: string[] = ["Segment revenue extracted from the latest 10-K filing"];
  if (breakdown.reconciledPct != null) {
    footnoteParts.push(`covers ${Math.round(breakdown.reconciledPct)}% of total revenue`);
  }
  const footnote =
    footnoteParts.join(" · ") + (breakdown.note ? ` — ${breakdown.note}` : "");

  return (
    <div
      style={{
        marginTop: "14px",
        borderTop: "1px solid var(--border)",
        paddingTop: "12px",
      }}
    >
      {/* ── header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--foreground)",
          }}
        >
          Revenue by Segment
        </span>
        {breakdown.fiscalLabel && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: ".04em",
              color: "var(--muted-foreground)",
            }}
          >
            {breakdown.fiscalLabel}
          </span>
        )}
      </div>

      {/* ── segment rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {breakdown.segments.map((seg, rank) => {
          const color = rankColor(rank);
          const yoy = seg.yoyPct;

          return (
            <div
              key={`${seg.name}-${rank}`}
              style={{
                borderLeft: `3px solid ${color}`,
                paddingLeft: "12px",
              }}
            >
              {/* aligned columns: name | share% | revenue | YoY */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 56px 88px 62px",
                  alignItems: "baseline",
                  columnGap: "12px",
                  marginBottom: "7px",
                }}
              >
                {/* segment name — readable text for DOM queries */}
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "15px",
                    fontWeight: rank === 0 ? 700 : 500,
                    color: "var(--foreground)",
                    letterSpacing: ".01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {seg.name}
                </span>

                {/* share % */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "15px",
                    fontWeight: 700,
                    color,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Number.isFinite(seg.sharePct) ? seg.sharePct.toFixed(1) : "—"}%
                </span>

                {/* revenue */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "14px",
                    color: "var(--foreground)",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtRevenue(seg.revenue)}
                </span>

                {/* yoy delta — only when non-null */}
                <span style={{ justifySelf: "start" }}>
                  {yoy != null && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: yoy >= 0 ? "var(--bull)" : "var(--bear)",
                        background:
                          yoy >= 0
                            ? "color-mix(in srgb,var(--bull) 12%,transparent)"
                            : "color-mix(in srgb,var(--bear) 12%,transparent)",
                        padding: "1px 6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtYoY(yoy)}
                    </span>
                  )}
                </span>
              </div>

              {/* horizontal share-of-revenue bar */}
              <div
                aria-hidden="true"
                style={{
                  height: rank === 0 ? "7px" : "5px",
                  width: "100%",
                  background: "color-mix(in srgb,var(--border) 60%,transparent)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Number.isFinite(seg.sharePct) ? seg.sharePct : 0)}%`,
                    background: color,
                    opacity: rank === 0 ? "0.85" : "0.6",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── footnote ── */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--muted-foreground)",
          marginTop: "10px",
          fontStyle: "italic",
        }}
      >
        {footnote}
      </p>
    </div>
  );
}
