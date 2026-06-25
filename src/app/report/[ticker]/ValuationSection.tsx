import type { Valuation, ValuationRead } from "@/lib/ledger/types";

function readChipStyle(read: ValuationRead): { background: string; label: string } {
  switch (read) {
    case "expensive":
      return { background: "var(--bear-fill)", label: "EXPENSIVE" };
    case "cheap":
      return { background: "var(--bull-fill)", label: "CHEAP" };
    case "fair":
      return { background: "var(--warn-fill)", label: "FAIR" };
    default:
      return { background: "var(--muted-foreground)", label: "N/A" };
  }
}

function ValRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "0 16px",
        padding: "7px 0",
        borderBottom: "1px dotted var(--muted-foreground)",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        alignItems: "center",
      }}
    >
      <span
        style={{
          textTransform: "uppercase",
          letterSpacing: ".06em",
          fontSize: "10.5px",
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
        {value != null ? value.toFixed(1) + "x" : "—"}
      </span>
    </div>
  );
}

export function ValuationSection({ valuation }: { valuation: Valuation | null }) {
  if (!valuation) return null;

  const chip = readChipStyle(valuation.read);

  return (
    <div className="sec">
      <div className="secline">
        <h3>Valuation</h3>
        <span className="meta">Yahoo Finance — trailing multiples</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#fff",
            background: chip.background,
            padding: "2px 8px",
          }}
        >
          {chip.label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--muted-foreground)",
          }}
        >
          {valuation.read === "expensive"
            ? "Trailing P/E above 60 — multiple expansion risk."
            : valuation.read === "cheap"
            ? "Trailing P/E below 15 — potential value opportunity."
            : valuation.read === "fair"
            ? "Multiples within typical growth-stock range."
            : "Insufficient data to assess valuation."}
        </span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <ValRow label="P/E (Trailing)" value={valuation.peTrailing} />
        <ValRow label="P/E (Forward)" value={valuation.peForward} />
        <ValRow label="P/S (TTM)" value={valuation.priceToSales} />
        <ValRow label="P/B" value={valuation.priceToBook} />
        <ValRow label="PEG Ratio" value={valuation.pegRatio} />
        <ValRow label="EV / EBITDA" value={valuation.evToEbitda} />
      </div>
    </div>
  );
}
