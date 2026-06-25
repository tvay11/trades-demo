"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

type Confidence = "NARROW" | "MODERATE" | "WIDE";

export function ConfidenceTooltip({
  confidence,
  bandPct,
  children,
}: {
  confidence: Confidence;
  bandPct: number;
  children: ReactNode;
}) {
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
      style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
      {open && (
        <span className="conf-tip-popup" role="tooltip">
          <span className="conf-tip-title">Reading the Confidence Band</span>
          <span className="conf-tip-intro">
            The forecast model samples hundreds of possible paths forward, and the band is{" "}
            <b>how spread out those paths are.</b> Narrow = conviction. Wide = hedging.
            Treat it as a <b>conviction gauge, not a guaranteed range.</b>
          </span>

          <span className="conf-tip-cards">
            <ConfCard
              label="NARROW"
              range="< 5%"
              chipClass="n"
              active={confidence === "NARROW"}
              bandPct={bandPct}
              when="Paths cluster tight. The model is confident in direction."
              advice="Treat it as a signal worth acting on. Confirm on a second timeframe (e.g. weekly), cross-check technicals and fundamentals, then size the position to your risk. Still not a guarantee — just the best odds the forecast offers."
            />
            <ConfCard
              label="MODERATE"
              range="5–10%"
              chipClass="m"
              active={confidence === "MODERATE"}
              bandPct={bandPct}
              when="Mixed conviction. The model is partly hedging."
              advice="Use it for context only. Let it shade a thesis you already hold from other evidence. Do not put a trade on from the forecast alone at this width."
            />
            <ConfCard
              label="WIDE"
              range="> 10%"
              chipClass="w"
              active={confidence === "WIDE"}
              bandPct={bandPct}
              when="Paths scatter. Low conviction — often an inflection point where forces fight."
              advice='Do not trade the direction off the forecast alone. Treat it as a "watch this" flag. Wait for technical confirmation and lean on the fundamentals.'
            />
          </span>
        </span>
      )}
    </span>
  );
}

function ConfCard({
  label,
  range,
  chipClass,
  active,
  bandPct,
  when,
  advice,
}: {
  label: string;
  range: string;
  chipClass: string;
  active: boolean;
  bandPct: number;
  when: string;
  advice: string;
}) {
  return (
    <span className={`conf-tip-card${active ? " conf-tip-active" : ""}`}>
      <span className="conf-tip-card-head">
        <span className={`chip ${chipClass}`}>{range}</span> {label}
        {active && (
          <span className="conf-tip-youhere">THIS RUN · ±{bandPct.toFixed(1)}%</span>
        )}
      </span>
      <span className="conf-tip-when">{when}</span>
      <span className="conf-tip-lbl">What to do next</span>
      <span className="conf-tip-advice">{advice}</span>
    </span>
  );
}
