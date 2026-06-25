import type { LongTermDirection, LongTermPlay, LongTermTheme, LongTermDriver } from "@/lib/ledger/types";
import { humanizeEvidence } from "@/lib/llm/humanizeEvidence";
import type { BarPoint } from "@/components/charts/TickerPriceChart";

const scoreText = (score: number) => score.toFixed(2);

function directionLabel(direction: LongTermDirection) {
  if (direction === "tailwind") return "Tailwind";
  if (direction === "headwind") return "Risk";
  return "Mixed";
}

function scoreTone(theme: LongTermTheme) {
  if (theme.direction === "headwind") return "ltp-score-risk";
  if (theme.score >= 0.7) return "ltp-score-strong";
  if (theme.score >= 0.45) return "ltp-score-moderate";
  return "ltp-score-risk";
}

function SignalList({ title, items, tone }: { title: string; items: string[]; tone: "confirm" | "break" }) {
  if (items.length === 0) return null;
  return (
    <div className={`ltp-signal-card ltp-signal-${tone}`}>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function corrRead(corr: number | null | undefined): { text: string; color: string; pos: number } | null {
  if (corr == null || !Number.isFinite(corr)) return null;
  const c = Math.max(-1, Math.min(1, corr));
  const strong = Math.abs(c) >= 0.4;
  const color = !strong ? "var(--muted-foreground)" : c >= 0 ? "var(--bull)" : "var(--bear)";
  const text = !strong ? "loosely linked" : c >= 0 ? "moves with the stock" : "moves against the stock";
  return { text, color, pos: ((c + 1) / 2) * 100 };
}

/** Align a driver's daily closes to the stock's closes on shared dates and index
 *  both series to 100 at the first shared date. Returns null when there aren't at
 *  least 2 shared dates or a base close is unusable (caller falls back to one line). */
export function buildDriverOverlay(
  driverPoints: { date: string; close: number }[],
  stockCloseByDate: Map<string, number>,
): { driverIdx: number[]; stockIdx: number[] } | null {
  const driver: number[] = [];
  const stock: number[] = [];
  for (const p of driverPoints) {
    const s = stockCloseByDate.get(p.date);
    if (s == null || !Number.isFinite(p.close) || !Number.isFinite(s)) continue;
    driver.push(p.close);
    stock.push(s);
  }
  if (driver.length < 2) return null;
  // driver[0]/stock[0] are finite by construction (the loop filters non-finite).
  const dBase = driver[0];
  const sBase = stock[0];
  if (dBase === 0 || sBase === 0) return null;
  return {
    driverIdx: driver.map((c) => (c / dBase) * 100),
    stockIdx: stock.map((c) => (c / sBase) * 100),
  };
}

function DriverChart({ d, stockCloseByDate }: { d: LongTermDriver; stockCloseByDate: Map<string, number> }) {
  const closes = d.points.map((p) => p.close).filter((c) => Number.isFinite(c));
  if (closes.length < 2) return null;
  const base = closes[0] || 1;
  const idx = closes.map((c) => (c / base) * 100);
  const min = Math.min(...idx);
  const max = Math.max(...idx);
  const W = 240, H = 60, PAD = 4;
  const changePct = idx[idx.length - 1] - 100;
  const up = changePct >= 0;
  const color = up ? "var(--bull)" : "var(--bear)";
  const toPts = (arr: number[], lo: number, hi: number) => {
    const rng = hi - lo || 1;
    return arr
      .map((v, i) => {
        const x = PAD + (i / Math.max(1, arr.length - 1)) * (W - PAD * 2);
        const y = PAD + (1 - (v - lo) / rng) * (H - PAD * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };
  const overlay = buildDriverOverlay(d.points, stockCloseByDate);
  const driverColor = corrRead(d.corr)?.color ?? "var(--muted-foreground)";
  return (
    <div style={{ border: "1px solid var(--border)", padding: "8px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
        <b style={{ fontSize: "12px" }}>{d.label}</b>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color }}>
          {up ? "+" : ""}{changePct.toFixed(1)}% <span style={{ color: "var(--muted-foreground)" }}>1y</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", marginTop: "4px" }}>
        {overlay ? (() => {
          const all = [...overlay.driverIdx, ...overlay.stockIdx];
          const lo = Math.min(...all);
          const hi = Math.max(...all);
          return (
            <>
              <polyline points={toPts(overlay.stockIdx, lo, hi)} fill="none" stroke="var(--foreground)" strokeWidth="1.75" />
              <polyline points={toPts(overlay.driverIdx, lo, hi)} fill="none" stroke={driverColor} strokeWidth="1.5" />
            </>
          );
        })() : (
          <polyline points={toPts(idx, min, max)} fill="none" stroke={color} strokeWidth="1.5" />
        )}
      </svg>
      {overlay ? (
        <div style={{ display: "flex", gap: "10px", marginTop: "3px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)" }} aria-hidden="true">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <span style={{ width: "10px", height: "2px", background: "var(--foreground)", display: "inline-block" }} />STOCK
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <span style={{ width: "10px", height: "2px", background: driverColor, display: "inline-block" }} />{d.symbol}
          </span>
        </div>
      ) : null}
      {d.why ? <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", margin: "4px 0 0" }}>{d.why}</p> : null}
      {(() => {
        const r = corrRead(d.corr);
        if (!r) return null;
        return (
          <div style={{ marginTop: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: r.color }}>{r.text}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)" }}>
                r {d.corr! >= 0 ? "+" : ""}{d.corr!.toFixed(2)}
              </span>
            </div>
            <div style={{ position: "relative", height: "4px", background: "var(--border)", marginTop: "3px" }} aria-hidden="true">
              <div style={{ position: "absolute", left: "50%", top: "-2px", width: "1px", height: "8px", background: "var(--muted-foreground)" }} />
              <div style={{ position: "absolute", left: `${r.pos}%`, top: "-1px", width: "6px", height: "6px", marginLeft: "-3px", borderRadius: "50%", background: r.color }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function LongTermPlaySection({ play, bars }: { play: LongTermPlay | null | undefined; bars?: BarPoint[] }) {
  if (!play) return null;

  const stockCloseByDate = new Map<string, number>(
    (bars ?? []).filter((b) => Number.isFinite(b.close)).map((b) => [b.date, b.close]),
  );

  return (
    <div className="sec long-term-play">
      <div className="secline">
        <h3>Long-Term Play</h3>
        <span className="meta">business exposure · AI-classified · 3-10 year lens</span>
      </div>

      <p className="ltp-summary">
        <span>What this stock is really a bet on:</span> {play.summary}
      </p>

      <div className="ltp-theme-grid">
        {play.themes.map((theme) => (
          <article className={`ltp-theme ${scoreTone(theme)}`} key={theme.name}>
            <div className="ltp-theme-top">
              <h4>{theme.name}</h4>
              <span className="ltp-direction">{directionLabel(theme.direction)}</span>
            </div>
            <div className="ltp-score-row">
              <span className="ltp-theme-score">{scoreText(theme.score)}</span>
              <span className="ltp-score-track" aria-hidden="true">
                <span className="ltp-score-fill" style={{ width: `${Math.round(theme.score * 100)}%` }} />
              </span>
            </div>
            <p>{theme.summary}</p>
            <ul className="ltp-evidence">
              {theme.evidence.map((item) => (
                <li key={item}>{humanizeEvidence(item)}</li>
              ))}
            </ul>
            <p className="ltp-risk">
              <b>Risk:</b> {theme.risk}
            </p>
          </article>
        ))}
      </div>

      <div className="ltp-thesis-grid">
        <div className="ltp-belief">
          <h4>If you believe</h4>
          <p>{play.ifYouBelieve}</p>
        </div>
        <div className="ltp-why">
          <h4>Why it matters</h4>
          <ul>
            {play.whyItMatters.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ltp-signal-grid">
        <SignalList title="What confirms it" items={play.confirmingSignals} tone="confirm" />
        <SignalList title="What breaks it" items={play.breakingSignals} tone="break" />
      </div>

      {(play.drivers ?? []).length > 0 ? (
        <div className="ltp-drivers">
          <h4 style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted-foreground)", margin: "12px 0 6px" }}>
            Industry drivers · indexed to 100 · ~1y
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
            {(play.drivers ?? []).map((d) => <DriverChart key={d.symbol} d={d} stockCloseByDate={stockCloseByDate} />)}
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", margin: "6px 0 0", fontStyle: "italic" }}>
            r = 1-year daily-return correlation with the stock — co-movement, not causation.
          </p>
        </div>
      ) : null}

      {play.dataGaps.length > 0 ? (
        <div className="ltp-gaps">
          <h4>Data gaps</h4>
          <ul>
            {play.dataGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
