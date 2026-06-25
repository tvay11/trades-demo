"use client";

import { useState } from "react";
import type { Ledger } from "@/lib/ledger/types";

export function ExportReportButton({
  report,
  label = "Export JSON",
  onDark = true,
}: {
  report: Ledger;
  label?: string;
  onDark?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const fg = onDark ? "var(--background)" : "var(--foreground)";

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "10.5px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: fg,
    background: "transparent",
    border: `1px solid ${fg}`,
    padding: "3px 10px",
    cursor: "pointer",
    opacity: 1,
  };

  const handleExport = async () => {
    try {
      const jsonStr = JSON.stringify(report, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy report JSON", err);
    }
  };

  return (
    <button type="button" style={btn} onClick={handleExport}>
      {copied ? "Copied!" : label}
    </button>
  );
}
