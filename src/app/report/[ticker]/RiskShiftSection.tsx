import type { RiskShift } from "@/lib/ledger/types";

function FilingChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: ".06em",
        border: "1px solid var(--foreground)",
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function RiskColumn({
  heading,
  color,
  items,
  muted,
}: {
  heading: string;
  color: string;
  items: string[];
  muted?: boolean;
}) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: "12px", flex: "1 1 260px", minWidth: "240px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color,
          marginBottom: "6px",
        }}
      >
        {heading} ({items.length})
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((r, i) => (
          <li
            key={i}
            style={{
              position: "relative",
              paddingLeft: "16px",
              fontSize: "13px",
              lineHeight: 1.45,
              marginBottom: "4px",
              color: muted ? "var(--muted-foreground)" : "inherit",
            }}
          >
            <span style={{ position: "absolute", left: 0, color, fontWeight: 700 }}>{muted ? "−" : "+"}</span>
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RiskShiftSection({ riskShift }: { riskShift: RiskShift | null }) {
  if (!riskShift) return null;

  return (
    <div style={{ marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted-foreground)",
          }}
        >
          Risk Shift · 10-K YoY
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <FilingChip label={riskShift.fromFiling} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted-foreground)" }}>→</span>
          <FilingChip label={riskShift.toFiling} />
        </span>
      </div>

      <p style={{ fontSize: "14px", lineHeight: 1.5, marginBottom: "12px" }}>{riskShift.shiftSummary}</p>

      {(riskShift.newRisks.length > 0 || riskShift.removedRisks.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "8px" }}>
          {riskShift.newRisks.length > 0 && (
            <RiskColumn heading="New in latest 10-K" color="var(--bear)" items={riskShift.newRisks} />
          )}
          {riskShift.removedRisks.length > 0 && (
            <RiskColumn heading="No longer cited" color="var(--bull)" items={riskShift.removedRisks} muted />
          )}
        </div>
      )}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px", fontStyle: "italic" }}>
        Item 1A risk factors, AI-diffed across the company&apos;s two most recent 10-K filings via SEC EDGAR.
      </p>
    </div>
  );
}
