import type { RatingAction, StreetMomentum } from "@/lib/ledger/types";

import { DataRow, HeroBand, HeroCell, Stamp } from "./primitives";

const READ_COLOR: Record<string, string> = {
  improving: "var(--bull)",
  deteriorating: "var(--bear)",
  flat: "var(--warn)",
  unknown: "var(--muted-foreground)",
};

const ACTION_GLYPH: Record<RatingAction["action"], { glyph: string; color: string }> = {
  up: { glyph: "↑", color: "var(--bull)" },
  down: { glyph: "↓", color: "var(--bear)" },
  init: { glyph: "+", color: "var(--muted-foreground)" },
  main: { glyph: "•", color: "var(--muted-foreground)" },
  reit: { glyph: "•", color: "var(--muted-foreground)" },
};

function signed(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
}

/** Mini diverging bar chart of quarterly EPS surprises (oldest → newest). */
function SurpriseBars({ sm }: { sm: StreetMomentum }) {
  const series = [...sm.surprises].reverse(); // newest-first in data → oldest-first on screen
  if (series.length === 0) return null;
  const CAP = 25; // |surprise| % at which a bar reaches full half-height

  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          marginBottom: "6px",
        }}
      >
        EPS surprise history · last {series.length} quarters
        {sm.avgSurprisePct != null ? ` · avg ${signed(sm.avgSurprisePct)}%` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: "6px", height: "56px" }}>
        {series.map((s, i) => {
          const pct = s.surprisePct;
          const h = pct == null ? 0 : Math.min(Math.abs(pct), CAP) / CAP;
          const up = pct != null && pct >= 0;
          return (
            <div
              key={i}
              title={`${s.quarter}: ${pct != null ? `${signed(pct)}%` : "n/a"}${s.epsActual != null ? ` (act ${s.epsActual} vs est ${s.epsEstimate ?? "—"})` : ""}`}
              style={{ display: "flex", flexDirection: "column", width: "26px", cursor: "default" }}
            >
              {/* upper half — beats grow up from the midline */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                {up && pct != null && (
                  <div style={{ width: "100%", height: `${Math.max(h * 100, 6)}%`, background: "var(--bull)" }} />
                )}
              </div>
              {/* lower half — misses hang below the midline */}
              <div style={{ flex: 1, borderTop: "1px solid var(--foreground)", display: "flex", alignItems: "flex-start" }}>
                {!up && pct != null && (
                  <div style={{ width: "100%", height: `${Math.max(h * 100, 6)}%`, background: "var(--bear)" }} />
                )}
                {pct == null && (
                  <div style={{ width: "100%", height: "6%", background: "var(--muted-foreground)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: "14px",
          marginTop: "5px",
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          color: "var(--muted-foreground)",
        }}
      >
        <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--bull)", marginRight: "3px" }} />Beat</span>
        <span><span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--bear)", marginRight: "3px" }} />Miss</span>
        <span>oldest → newest · hover for detail</span>
      </div>
    </div>
  );
}


export function StreetMomentumSection({ sm }: { sm: StreetMomentum }) {
  const rev0q = sm.revisions.find((r) => r.period === "0q");
  const rev0y = sm.revisions.find((r) => r.period === "0y");
  const t0q = sm.trendDeltas.find((t) => t.period === "0q");
  const t0y = sm.trendDeltas.find((t) => t.period === "0y");

  return (
    <div className="sec">
      <div className="secline">
        <h3>Street Momentum</h3>
        <span className="meta">estimate revisions · surprises · rating actions</span>
      </div>

      {/* Hero band — same idiom as Analyst Consensus */}
      <HeroBand>
        <HeroCell label="Street Read">
          <div
            style={{
              fontSize: "20px",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: READ_COLOR[sm.read],
            }}
          >
            {sm.read}
          </div>
        </HeroCell>
        <HeroCell label="Q ests · 30d">
          {rev0q ? (
            <>
              <span style={{ color: "var(--bull)" }}>▲{rev0q.up30}</span>
              <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}> / </span>
              <span style={{ color: "var(--bear)" }}>▼{rev0q.down30}</span>
            </>
          ) : (
            "—"
          )}
        </HeroCell>
        <HeroCell label="FY ests · 30d">
          {rev0y ? (
            <>
              <span style={{ color: "var(--bull)" }}>▲{rev0y.up30}</span>
              <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}> / </span>
              <span style={{ color: "var(--bear)" }}>▼{rev0y.down30}</span>
            </>
          ) : (
            "—"
          )}
        </HeroCell>
        <HeroCell label="Beat Rate">
          {sm.surpriseTotal > 0 ? `${sm.beatCount}/${sm.surpriseTotal}` : "—"}
        </HeroCell>
      </HeroBand>

      {/* PEAD drift window chip */}
      {sm.pead.active && (
        <p style={{ fontSize: "14px", marginBottom: "12px" }}>
          <Stamp
            tone={sm.pead.direction === "up" ? "bull" : "bear"}
            title="Post-earnings announcement drift: prices tend to keep moving in the surprise's direction for 60–90 days. Days-since is approximate."
            inline
          >
            DRIFT WINDOW
          </Stamp>
          ≈{sm.pead.daysSinceReport}d since a{" "}
          {sm.pead.lastSurprisePct != null ? `${signed(sm.pead.lastSurprisePct)}%` : ""} earnings surprise —
          drift historically favors the {sm.pead.direction === "up" ? "upside" : "downside"}.
        </p>
      )}

      {/* Consensus EPS drift rows */}
      {(t0q?.pctChange30d != null || t0y?.pctChange30d != null) && (
        <div style={{ borderTop: "1px solid var(--border)", marginBottom: "12px" }}>
          {t0q?.pctChange30d != null && (
            <DataRow
              label="Current-Q consensus EPS · 30d change"
              value={`${signed(t0q.pctChange30d)}%`}
              note={t0q.pctChange30d > 0.5 ? "rising" : t0q.pctChange30d < -0.5 ? "falling" : "stable"}
            />
          )}
          {t0y?.pctChange30d != null && (
            <DataRow
              label="Current-FY consensus EPS · 30d change"
              value={`${signed(t0y.pctChange30d)}%`}
              note={t0y.pctChange30d > 0.5 ? "rising" : t0y.pctChange30d < -0.5 ? "falling" : "stable"}
            />
          )}
        </div>
      )}

      <SurpriseBars sm={sm} />

      {/* Recent rating actions */}
      {sm.recentActions.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--muted-foreground)",
              marginBottom: "2px",
            }}
          >
            Rating actions · last 90d ({sm.upgrades30} up / {sm.downgrades30} down in 30d)
          </div>
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {sm.recentActions.map((a, i) => {
              const g = ACTION_GLYPH[a.action];
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "0 16px",
                    padding: "7px 0",
                    borderBottom: "1px dotted var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12.5px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{a.date}</span>
                  <span style={{ fontWeight: 700 }}>
                    <span style={{ color: g.color }}>{g.glyph}</span> {a.firm}
                  </span>
                  <span style={{ color: "var(--muted-foreground)" }}>
                    {a.fromGrade ? `${a.fromGrade} → ` : ""}
                    <b style={{ color: "var(--foreground)" }}>{a.toGrade}</b>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", marginTop: "8px" }}>
        Data via Yahoo Finance · estimate revisions and post-earnings drift are among the better-documented return signals.
      </p>
    </div>
  );
}
