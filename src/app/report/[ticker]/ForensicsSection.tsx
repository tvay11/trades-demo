import type { ForensicsReport, ForensicVerdict } from "@/lib/ledger/types";

const VERDICT_COLOR: Record<ForensicVerdict, string> = {
  clean: "var(--bull)",
  watch: "var(--warn)",
  concerning: "var(--bear)",
  unavailable: "var(--muted-foreground)",
};

const VERDICT_BG: Record<ForensicVerdict, string> = {
  clean: "var(--bull-fill)",
  watch: "var(--warn-fill)",
  concerning: "var(--bear-fill)",
  unavailable: "var(--muted-foreground)",
};

const VERDICT_LABEL: Record<ForensicVerdict, string> = {
  clean: "CLEAN",
  watch: "WATCH",
  concerning: "CONCERNING",
  unavailable: "N/A",
};

function VerdictChip({ verdict }: { verdict: ForensicVerdict }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: ".08em",
        color: "#fff",
        background: VERDICT_BG[verdict],
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function ForensicsSection({ forensics }: { forensics: ForensicsReport | null }) {
  if (!forensics || forensics.overall === "unavailable") return null;

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
          Quality of Earnings · {forensics.yearsAnalyzed}y
        </span>
        <VerdictChip verdict={forensics.overall} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {forensics.patterns
          .filter((p) => p.verdict !== "unavailable")
          .map((p) => (
            <div
              key={p.key}
              style={{ borderLeft: `3px solid ${VERDICT_COLOR[p.verdict]}`, paddingLeft: "12px" }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                <b style={{ fontSize: "13px" }}>{p.label}</b>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: VERDICT_COLOR[p.verdict] }}>
                  {p.metric}
                </span>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.45, margin: "2px 0 0", color: "var(--muted-foreground)" }}>
                {p.detail}
              </p>
            </div>
          ))}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", marginTop: "8px", fontStyle: "italic" }}>
        Deterministic quality-of-earnings checks computed from SEC EDGAR annual filings. Not fraud detection — flags aggressive accounting within GAAP.
      </p>
    </div>
  );
}
