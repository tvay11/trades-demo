const FIELD_LABELS: Record<string, { label: string; pct?: boolean; suffix?: string }> = {
  probUp: { label: "P(up)", pct: true },
  expectedMovePct: { label: "expected move", pct: true },
  changePct: { label: "forecast change", pct: true },
  bandPct: { label: "band", pct: true },
  revenueYoYPct: { label: "revenue", pct: true, suffix: " YoY" },
  netIncomeYoYPct: { label: "net income", pct: true, suffix: " YoY" },
  grossMarginPct: { label: "gross margin", pct: true },
  dilutedEps: { label: "diluted EPS" },
  congressNetFlowLabel: { label: "congress flow" },
  insiderTrades: { label: "insider trades" },
  newsSkew: { label: "news skew" },
};

const roundNum = (s: string) =>
  s.replace(/-?\d+\.\d{3,}/g, (m) => Number(m).toFixed(1)).replace(/-/g, "−");

/** Make an LLM "evidence" string human-readable: map known field names, round long
 *  decimals, append % where appropriate, strip `xxx title:`/`issue:` prefixes & quotes. */
export function humanizeEvidence(raw: string): string {
  let s = raw.trim();
  // strip "<word(s)> title:" / "issue:" prefixes and surrounding quotes
  s = s.replace(/^[\w\s]+?(title|issue|name)\s*:\s*/i, "").replace(/^['"]|['"]$/g, "");
  // "fieldName <number>" -> "Label <rounded>%"
  const m = s.match(/^([a-zA-Z]+)\s+(-?\d+(?:\.\d+)?)(.*)$/);
  if (m && FIELD_LABELS[m[1]]) {
    const { label, pct, suffix } = FIELD_LABELS[m[1]];
    const num = Number(m[2]);
    const val = Number.isFinite(num) ? num.toFixed(1).replace(/-/, "−") : m[2];
    return `${label} ${val}${pct ? "%" : ""}${suffix ?? ""}${m[3] ?? ""}`.trim();
  }
  return roundNum(s);
}
