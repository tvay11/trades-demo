import type { ReactNode } from "react";

export function DataRow({
  label,
  value,
  note,
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  size?: "md" | "sm";
}) {
  return (
    <div className={size === "sm" ? "drow drow-sm" : "drow"}>
      <span className="drow-label">{label}</span>
      <span className="drow-val">{value}</span>
      {note != null ? <span className="drow-note">{note}</span> : <span />}
    </div>
  );
}

export type StampTone = "bull" | "bear" | "warn" | "neutral";

export function Stamp({
  tone = "neutral",
  title,
  inline,
  children,
}: {
  tone?: StampTone;
  title?: string;
  inline?: boolean;
  children: ReactNode;
}) {
  const cls =
    (tone === "neutral" ? "stamp" : `stamp stamp-${tone}`) +
    (inline ? " stamp-inline" : "");
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}

export function HeroBand({ children }: { children: ReactNode }) {
  return <div className="hero-band">{children}</div>;
}

export function HeroCell({
  label,
  align = "center",
  children,
}: {
  label: ReactNode;
  align?: "center" | "left";
  children: ReactNode;
}) {
  return (
    <div className={align === "left" ? "hero-cell hero-cell-left" : "hero-cell"}>
      <div className="hero-label">{label}</div>
      <div className="hero-val">{children}</div>
    </div>
  );
}

export type MetricTone = "good" | "warn" | "bad" | "neutral";

const METRIC_TONE_COLOR: Record<MetricTone, string> = {
  good: "var(--bull)",
  warn: "var(--warn)",
  bad: "var(--bear)",
  neutral: "var(--muted-foreground)",
};

/** A compact metric tile: big value, optional status badge, and either a gauge
 *  bar or a mono caption underneath. Used by the Short Interest / Options Pulse
 *  sections for a consistent terminal-card look. */
export function MetricTile({
  label,
  value,
  status,
  gaugePct,
  caption,
}: {
  label: ReactNode;
  value: ReactNode;
  status?: { text: string; tone: MetricTone } | null;
  gaugePct?: number | null;
  caption?: ReactNode;
}) {
  const color = status ? METRIC_TONE_COLOR[status.tone] : "var(--muted-foreground)";
  return (
    <div style={{ border: "1px solid var(--border)", padding: "10px 12px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "24px", fontWeight: 700, lineHeight: 1 }}>{value}</span>
        {status ? (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              padding: "1px 7px",
              color,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            {status.text}
          </span>
        ) : null}
      </div>
      {gaugePct != null ? (
        <div
          style={{ marginTop: "10px", height: "4px", background: "var(--border)", overflow: "hidden" }}
          aria-hidden="true"
        >
          <div style={{ width: `${Math.min(100, Math.max(0, gaugePct))}%`, height: "100%", background: color }} />
        </div>
      ) : caption != null ? (
        <div
          style={{
            marginTop: "10px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--muted-foreground)",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}

export function StatTile({
  label,
  note,
  title,
  children,
}: {
  label: ReactNode;
  note?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="stat-tile" title={title}>
      <div className="stat-tile-head">
        <span className="stat-tile-label">{label}</span>
        {note != null && <span className="stat-tile-note">{note}</span>}
      </div>
      {children}
    </div>
  );
}
