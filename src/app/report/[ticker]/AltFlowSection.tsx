import type { AltFlow } from "@/lib/ledger/types";

import { DataRow, Stamp, StatTile } from "./primitives";

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtShares(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return n.toLocaleString("en-US");
}

function BigStat({ value, unit, color }: { value: string; unit?: string; color?: string }) {
  return (
    <div style={{ fontSize: "24px", fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", color: color ?? "inherit" }}>
      {value}
      {unit && <span style={{ fontWeight: 400, fontSize: "12px", color: "var(--muted-foreground)" }}> {unit}</span>}
    </div>
  );
}


/** Two labeled horizontal bars comparing this week's mentions vs the prior week. */
function MentionBars({ now, prior }: { now: number; prior: number }) {
  const max = Math.max(now, prior, 1);
  const rows: { label: string; v: number; color: string }[] = [
    { label: "7d", v: now, color: now >= prior ? "var(--warn)" : "var(--muted-foreground)" },
    { label: "prior", v: prior, color: "var(--muted-foreground)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "9.5px", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{r.label}</span>
          <div style={{ height: "10px", border: "1px solid var(--border)" }}>
            <div style={{ width: `${(r.v / max) * 100}%`, height: "100%", background: r.color }} />
          </div>
          <span style={{ fontSize: "10.5px", fontVariantNumeric: "tabular-nums" }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

/** 0–100% gauge of off-exchange short volume with a tick at the trailing baseline. */
function ShortVolGauge({ latest, baseline }: { latest: number; baseline: number | null }) {
  return (
    <div>
      <div style={{ position: "relative", height: "12px", border: "1px solid var(--border)" }}>
        <div style={{ width: `${Math.min(latest, 100)}%`, height: "100%", background: "var(--muted-foreground)", opacity: 0.55 }} />
        {baseline != null && (
          <div
            title={`20d baseline ${baseline.toFixed(1)}%`}
            style={{
              position: "absolute",
              top: "-2px",
              bottom: "-2px",
              left: `${Math.min(baseline, 100)}%`,
              width: "2px",
              background: "var(--foreground)",
            }}
          />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "var(--muted-foreground)", marginTop: "2px" }}>
        <span>0%</span>
        <span>▮ = 20d baseline</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function AltFlowSection({ altFlow }: { altFlow: AltFlow }) {
  const { wsb, darkShort, thirteenF, govContracts } = altFlow;
  if (!wsb && !darkShort && !thirteenF && !govContracts) return null;

  const excess = darkShort?.excessPp ?? null;
  const excessColor = excess == null ? "var(--muted-foreground)" : excess >= 10 ? "var(--bear)" : excess >= 5 ? "var(--warn)" : "var(--bull)";

  return (
    <div className="sec">
      <div className="secline">
        <h3>Alt Flow</h3>
        <span className="meta">WSB heat · dark short pressure · 13F drift · gov contracts</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>

        {/* WSB heat */}
        {wsb && (
          <StatTile label="WSB Heat" note={wsb.surgeRatio != null ? `surge ×${wsb.surgeRatio}` : undefined}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <BigStat value={String(wsb.mentions7d)} unit="mentions 7d" />
              {wsb.crowded && (
                <Stamp tone="bear" title="High retail attention — squeeze/IV risk, premium expensive">CROWDED</Stamp>
              )}
            </div>
            <MentionBars now={wsb.mentions7d} prior={wsb.mentionsPrior7d} />
            {wsb.latestSentiment != null && (
              <DataRow
                size="sm"
                label="latest sentiment"
                value={`${wsb.latestSentiment >= 0 ? "+" : ""}${wsb.latestSentiment.toFixed(2)}`}
              />
            )}
          </StatTile>
        )}

        {/* Dark short pressure */}
        {darkShort && (
          <StatTile
            label="Dark Short"
            note={`${darkShort.sampleSize} sessions`}
            title="Share of off-exchange (dark) volume marked short, vs its own 20-day baseline"
          >
            <BigStat
              value={darkShort.latestShortVolPct != null ? `${darkShort.latestShortVolPct.toFixed(1)}%` : "—"}
              unit="short vol"
              color={excess != null && excess >= 10 ? "var(--bear)" : undefined}
            />
            {darkShort.latestShortVolPct != null && (
              <ShortVolGauge latest={darkShort.latestShortVolPct} baseline={darkShort.baselineShortVolPct} />
            )}
            <div style={{ fontSize: "11px", color: excessColor, fontWeight: 700 }}>
              {excess != null
                ? `${excess >= 0 ? "+" : ""}${excess.toFixed(1)}pp vs 20d baseline${excess >= 10 ? " — pressure" : ""}`
                : "baseline needs ≥5 sessions"}
            </div>
          </StatTile>
        )}

        {/* 13F drift */}
        {thirteenF && (
          <StatTile
            label="13F Drift"
            note={thirteenF.reportDate ?? undefined}
            title="Quarterly holdings, filed up to 45d late — context, not timing"
          >
            <BigStat
              value={thirteenF.netChangeShares != null ? `${thirteenF.netChangeShares >= 0 ? "+" : ""}${fmtShares(thirteenF.netChangeShares)}` : "—"}
              unit={`shs net · ${thirteenF.holderCount} filers`}
              color={
                thirteenF.netChangeShares == null
                  ? undefined
                  : thirteenF.netChangeShares >= 0
                  ? "var(--bull)"
                  : "var(--bear)"
              }
            />
            {thirteenF.topHolders.length > 0 && (
              <div>
                {thirteenF.topHolders.map((h, i) => (
                  <DataRow key={i} size="sm" label={h.filer} value={h.valueUsd != null ? fmtMoney(h.valueUsd) : "—"} />
                ))}
              </div>
            )}
          </StatTile>
        )}

        {/* Gov contracts */}
        {govContracts && (
          <StatTile label="Gov Contracts" note="last 180d">
            <BigStat
              value={fmtMoney(govContracts.totalUsd180d)}
              unit={`across ${govContracts.count180d} award${govContracts.count180d === 1 ? "" : "s"}`}
              color={govContracts.totalUsd180d >= 10_000_000 ? "var(--bull)" : undefined}
            />
            {govContracts.recent.length > 0 && (
              <div>
                {govContracts.recent.map((r, i) => (
                  <DataRow
                    key={i}
                    size="sm"
                    label={r.agency ?? "—"}
                    value={`${r.amountUsd != null ? fmtMoney(r.amountUsd) : "—"}${r.awardedAt ? ` · ${r.awardedAt}` : ""}`}
                  />
                ))}
              </div>
            )}
          </StatTile>
        )}

      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", marginTop: "8px" }}>
        Quiver-fed daily ingests · WSB crowding is a risk flag, not a direction call · 13F positions lag up to 45 days.
      </p>
    </div>
  );
}
