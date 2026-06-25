"use client";

import { useState, useRef, useEffect } from "react";

/** Red ⚠ SUSPECT chip with a rich hover/click tooltip explaining why the
 * forecast was flagged and how the report defends against it. Reuses the
 * conf-tip popup styling from the confidence tooltip. */
export function SuspectChip({ reason, small }: { reason: string | null; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span
      ref={ref}
      className="conf-tip-anchor"
      style={{ borderBottom: "none", display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      <span
        style={{
          background: "var(--bear-fill)",
          color: "#fff",
          padding: small ? "1px 6px" : "2px 8px",
          fontSize: "10px",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "help",
        }}
      >
        ⚠ Suspect
      </span>
      {open && (
        <span className="conf-tip-popup" role="tooltip">
          <span className="conf-tip-title">Why this forecast is flagged</span>
          {reason && (
            <span className="conf-tip-intro" style={{ color: "var(--bear)", fontWeight: 600 }}>
              This run: {reason}.
            </span>
          )}
          <span className="conf-tip-intro">
            Statistically implausible combinations — a huge predicted move with a tight
            uncertainty cone, or a near-100% probability — are a known <b>failure signature</b> of
            the forecast model, not high conviction. It usually means the model is{" "}
            <b>mean-reverting to the average price of its ~2-year lookback window</b> after a big
            real-world move (deep drawdown, split, regime change) instead of forecasting.
          </span>
          <span className="conf-tip-intro">
            <b>What the report does about it:</b> the forecast&apos;s weight in The Call is capped
            at ±0.5 (instead of up to ±2), and the Options Trade Lens ignores it entirely.
          </span>
          <span className="conf-tip-intro">
            <b>What you should do:</b> don&apos;t trade this signal. Check the price chart for a
            recent crash, split, or regime change; lean on the other lenses (technicals, flows,
            valuation); re-run the forecaster once the data looks sane.
          </span>
        </span>
      )}
    </span>
  );
}
