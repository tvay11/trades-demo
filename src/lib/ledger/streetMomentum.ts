import type {
  EarningsSurprise, EpsRevisionCounts, EpsTrendDelta, PeadWindow,
  RatingAction, StreetMomentum, StreetRead,
} from "./types";

/** Raw yahoo-finance2 shapes (subset). Kept loose — Yahoo omits fields freely. */
export interface RawTrendRow {
  period?: string | null;
  epsRevisions?: { upLast30days?: number | null; downLast30days?: number | null } | null;
  epsTrend?: { current?: number | null; ["30daysAgo"]?: number | null } | null;
}
export interface RawHistoryRow {
  quarter?: Date | null; epsActual?: number | null; epsEstimate?: number | null; surprisePercent?: number | null;
}
export interface RawActionRow {
  epochGradeDate?: Date | null; firm?: string | null; toGrade?: string | null; fromGrade?: string | null; action?: string | null;
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

export function computeStreetRead(facts: {
  revisionsNet: number | null; trendPct: number | null; actionsNet: number | null;
}): StreetRead {
  if (facts.revisionsNet == null && facts.trendPct == null && facts.actionsNet == null) return "unknown";
  let votes = 0;
  if (facts.revisionsNet != null && facts.revisionsNet !== 0) votes += Math.sign(facts.revisionsNet);
  if (facts.trendPct != null) votes += facts.trendPct > 0.5 ? 1 : facts.trendPct < -0.5 ? -1 : 0;
  if (facts.actionsNet != null && facts.actionsNet !== 0) votes += Math.sign(facts.actionsNet);
  return votes >= 2 ? "improving" : votes <= -2 ? "deteriorating" : "flat";
}

/** PEAD drift window — approximate by design (we don't store past report dates).
 * Prefer nextEarnings (quarterly cycle ≈ 91d): daysSince ≈ 91 − daysUntil.
 * Fallback: latest surprise quarter end + 30d ≈ report date. */
export function computePead(
  lastSurprisePct: number | null,
  nextEarningsDaysUntil: number | null,
  latestQuarterEnd: Date | null,
  now: Date,
): PeadWindow {
  let daysSinceReport: number | null = null;
  if (nextEarningsDaysUntil != null && nextEarningsDaysUntil >= 0 && nextEarningsDaysUntil <= 91) {
    daysSinceReport = 91 - nextEarningsDaysUntil;
  } else if (latestQuarterEnd != null) {
    const approxReport = latestQuarterEnd.getTime() + 30 * DAY;
    const d = Math.round((now.getTime() - approxReport) / DAY);
    if (d >= 0) daysSinceReport = d;
  }
  const active =
    lastSurprisePct != null && Math.abs(lastSurprisePct) >= 5 &&
    daysSinceReport != null && daysSinceReport <= 75;
  return {
    active,
    daysSinceReport,
    lastSurprisePct,
    direction: lastSurprisePct == null ? null : lastSurprisePct >= 0 ? "up" : "down",
  };
}

export function shapeStreetMomentum(input: {
  trend: RawTrendRow[]; history: RawHistoryRow[]; actions: RawActionRow[];
  nextEarningsDaysUntil: number | null; now: Date;
}): StreetMomentum {
  const wanted = new Set(["0q", "+1q", "0y", "+1y"]);
  const revisions: EpsRevisionCounts[] = [];
  const trendDeltas: EpsTrendDelta[] = [];
  for (const row of input.trend) {
    const period = typeof row.period === "string" ? row.period : "";
    if (!wanted.has(period)) continue;
    revisions.push({ period, up30: num(row.epsRevisions?.upLast30days) ?? 0, down30: num(row.epsRevisions?.downLast30days) ?? 0 });
    if (period === "0q" || period === "0y") {
      const current = num(row.epsTrend?.current);
      const ago30 = num(row.epsTrend?.["30daysAgo"]);
      const pctChange30d =
        current != null && ago30 != null && Math.abs(ago30) >= 0.01
          ? ((current - ago30) / Math.abs(ago30)) * 100
          : null;
      trendDeltas.push({ period, current, ago30, pctChange30d });
    }
  }

  const surprises: EarningsSurprise[] = input.history
    .filter((h) => h.quarter instanceof Date)
    .sort((a, b) => (b.quarter as Date).getTime() - (a.quarter as Date).getTime())
    .slice(0, 8)
    .map((h) => ({
      quarter: iso(h.quarter as Date),
      epsActual: num(h.epsActual),
      epsEstimate: num(h.epsEstimate),
      surprisePct: num(h.surprisePercent) == null ? null : Math.round((num(h.surprisePercent) as number) * 1000) / 10,
    }));
  const scored = surprises.filter((s) => s.surprisePct != null);
  const beatCount = scored.filter((s) => (s.surprisePct as number) > 0).length;
  const avgSurprisePct = scored.length
    ? Math.round((scored.reduce((sum, s) => sum + (s.surprisePct as number), 0) / scored.length) * 10) / 10
    : null;

  const cutoff90 = input.now.getTime() - 90 * DAY;
  const cutoff30 = input.now.getTime() - 30 * DAY;
  const normAction = (a: unknown): RatingAction["action"] => {
    const s = String(a ?? "").toLowerCase();
    return s === "up" || s === "down" || s === "init" || s === "main" || s === "reit" ? s : "main";
  };
  const recent = input.actions
    .filter((a) => a.epochGradeDate instanceof Date && (a.epochGradeDate as Date).getTime() >= cutoff90 && typeof a.toGrade === "string" && a.toGrade)
    .sort((a, b) => (b.epochGradeDate as Date).getTime() - (a.epochGradeDate as Date).getTime());
  const upgrades30 = recent.filter((a) => (a.epochGradeDate as Date).getTime() >= cutoff30 && normAction(a.action) === "up").length;
  const downgrades30 = recent.filter((a) => (a.epochGradeDate as Date).getTime() >= cutoff30 && normAction(a.action) === "down").length;
  const recentActions: RatingAction[] = recent.slice(0, 5).map((a) => ({
    date: iso(a.epochGradeDate as Date),
    firm: String(a.firm ?? "—"),
    fromGrade: typeof a.fromGrade === "string" && a.fromGrade ? a.fromGrade : null,
    toGrade: String(a.toGrade),
    action: normAction(a.action),
  }));

  const hasRevisionFacts = revisions.some((r) => r.up30 > 0 || r.down30 > 0);
  const revisionsNet = hasRevisionFacts ? revisions.reduce((s, r) => s + r.up30 - r.down30, 0) : null;
  const trendPct = trendDeltas.find((t) => t.period === "0q")?.pctChange30d ?? trendDeltas.find((t) => t.period === "0y")?.pctChange30d ?? null;
  const actionsNet = recent.length > 0 ? upgrades30 - downgrades30 : null;

  const pead = computePead(
    surprises[0]?.surprisePct ?? null,
    input.nextEarningsDaysUntil,
    input.history.find((h) => h.quarter instanceof Date)
      ? (input.history.map((h) => h.quarter as Date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null)
      : null,
    input.now,
  );

  return {
    revisions, trendDeltas, surprises, beatCount, surpriseTotal: scored.length, avgSurprisePct,
    upgrades30, downgrades30, recentActions, pead,
    read: computeStreetRead({ revisionsNet, trendPct, actionsNet }),
  };
}
