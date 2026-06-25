import type { MacroLean, MacroRegime } from "@/lib/ledger/types";

function leanColor(lean: MacroLean): string {
  return lean === "risk-on" ? "var(--bull-fill)" : lean === "risk-off" ? "var(--bear-fill)" : "var(--warn-fill)";
}

export function MacroRegimeSection({ macro }: { macro: MacroRegime | null }) {
  if (!macro) return null;

  const badgeColor = leanColor(macro.label);

  // Find factor values for the compact chip
  const vix = macro.factors.find((f) => /vix/i.test(f.name))?.value ?? null;
  const curve = macro.factors.find((f) => /curve/i.test(f.name))?.value ?? null;
  const dollar = macro.factors.find((f) => /dollar/i.test(f.name))?.value ?? null;

  const parts: string[] = [];
  if (vix) parts.push(`VIX ${vix}`);
  if (curve) parts.push(`curve ${curve}`);
  if (dollar) parts.push(`$ ${dollar}`);

  return (
    <div
      style={{
        padding: "8px 36px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: "var(--muted-foreground)",
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--foreground)" }}>Market backdrop:</span>
      <span
        style={{
          fontSize: "10px",
          color: "#fff",
          background: badgeColor,
          padding: "2px 8px",
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        {macro.label}
      </span>
      {parts.length > 0 && (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{parts.join(" · ")}</span>
      )}
      <span style={{ color: "var(--border)" }}>·</span>
      <span style={{ fontSize: "10px" }}>as of {macro.asOf}</span>
    </div>
  );
}
