import type {
  ForensicPattern,
  ForensicsReport,
  ForensicsYear,
  ForensicVerdict,
} from "@/lib/ledger/types";

const UNAVAILABLE = (key: ForensicPattern["key"], label: string): ForensicPattern => ({
  key, label, verdict: "unavailable", metric: "—", detail: "Insufficient filing data.",
});

/** sum of a numeric field across years where it is non-null. */
function sumField(years: ForensicsYear[], pick: (y: ForensicsYear) => number | null): number | null {
  const vals = years.map(pick).filter((v): v is number => v != null);
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function scoreFcfVsNi(years: ForensicsYear[]): ForensicPattern {
  const usable = years.filter((y) => y.freeCashFlow != null && y.netIncome != null);
  const sumFcf = sumField(usable, (y) => y.freeCashFlow);
  const sumNi = sumField(usable, (y) => y.netIncome);
  if (sumFcf == null || sumNi == null || sumNi <= 0) return UNAVAILABLE("fcf_vs_ni", "FCF vs net income");
  const ratio = sumFcf / sumNi;
  const verdict: ForensicVerdict = ratio > 0.85 ? "clean" : ratio < 0.7 ? "concerning" : "watch";
  return {
    key: "fcf_vs_ni",
    label: "FCF vs net income",
    verdict,
    metric: `FCF/NI ${ratio.toFixed(2)} over ${usable.length}y`,
    detail:
      verdict === "clean"
        ? "Cash flow backs reported earnings."
        : verdict === "watch"
        ? "Cash conversion is slipping — watch the FCF/NI gap."
        : "Free cash flow is lagging reported net income — earnings are not converting to cash.",
  };
}

function scoreSbcDilution(years: ForensicsYear[]): ForensicPattern {
  const latest = years[years.length - 1];
  if (!latest || latest.sbc == null || latest.revenue == null || latest.revenue === 0)
    return UNAVAILABLE("sbc_dilution", "SBC dilution");
  const sbcPctRev = (latest.sbc / latest.revenue) * 100;
  const first = years[0];
  const shareGrowth =
    first?.dilutedShares != null && latest.dilutedShares != null && first.dilutedShares !== 0
      ? (latest.dilutedShares / first.dilutedShares - 1) * 100
      : null;
  let verdict: ForensicVerdict;
  if (sbcPctRev < 5 && (shareGrowth == null || shareGrowth <= 0)) verdict = "clean";
  else if (sbcPctRev > 10 && shareGrowth != null && shareGrowth > 0) verdict = "concerning";
  else verdict = "watch";
  return {
    key: "sbc_dilution",
    label: "SBC dilution",
    verdict,
    metric: `SBC ${sbcPctRev.toFixed(1)}% of rev${shareGrowth != null ? `, shares ${pct(shareGrowth)}` : ""}`,
    detail:
      verdict === "clean"
        ? "Stock comp is modest and share count is not climbing."
        : verdict === "watch"
        ? "Stock comp is meaningful — watch for dilution."
        : "Stock-based comp is a material cost and the diluted share count is rising.",
  };
}

function scoreChannelStuffing(years: ForensicsYear[]): ForensicPattern {
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  const dso = (y: ForensicsYear | undefined) =>
    y && y.accountsReceivable != null && y.revenue != null && y.revenue !== 0
      ? (y.accountsReceivable / y.revenue) * 365
      : null;
  const dsoLatest = dso(latest);
  const dsoPrior = dso(prior);
  if (dsoLatest == null || dsoPrior == null || dsoPrior === 0)
    return UNAVAILABLE("channel_stuffing", "Channel-stuffing (DSO)");
  const change = (dsoLatest / dsoPrior - 1) * 100;
  const verdict: ForensicVerdict = change <= 0 ? "clean" : change > 20 ? "concerning" : "watch";
  return {
    key: "channel_stuffing",
    label: "Channel-stuffing (DSO)",
    verdict,
    metric: `DSO ${dsoLatest.toFixed(0)}d (${pct(change)} YoY)`,
    detail:
      verdict === "clean"
        ? "Receivables are not outrunning sales."
        : verdict === "watch"
        ? "Receivables are creeping up relative to sales."
        : "Days-sales-outstanding is expanding — revenue may be pulled forward via channel/credit terms.",
  };
}

function scoreWorkingCapital(years: ForensicsYear[]): ForensicPattern {
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  if (!latest || !prior || latest.revenue == null || prior.revenue == null || prior.revenue === 0)
    return UNAVAILABLE("working_capital", "Working-capital signal");
  const revGrowth = (latest.revenue / prior.revenue - 1) * 100;

  const defNow = latest.deferredRevenue;
  const defPrior = prior.deferredRevenue;
  const defGrowth =
    defNow != null && defPrior != null && defPrior !== 0 ? (defNow / defPrior - 1) * 100 : null;

  const arGrowth =
    latest.accountsReceivable != null && prior.accountsReceivable != null && prior.accountsReceivable !== 0
      ? (latest.accountsReceivable / prior.accountsReceivable - 1) * 100
      : null;

  if (defGrowth == null && arGrowth == null) return UNAVAILABLE("working_capital", "Working-capital signal");

  let verdict: ForensicVerdict = "clean";
  if ((defGrowth != null && defGrowth < 0) || (arGrowth != null && arGrowth - revGrowth > 15))
    verdict = "concerning";
  else if ((defGrowth != null && defGrowth < revGrowth) || (arGrowth != null && arGrowth > revGrowth))
    verdict = "watch";

  const parts: string[] = [];
  if (defGrowth != null) parts.push(`deferred rev ${pct(defGrowth)}`);
  if (arGrowth != null) parts.push(`A/R ${pct(arGrowth)} vs rev ${pct(revGrowth)}`);
  return {
    key: "working_capital",
    label: "Working-capital signal",
    verdict,
    metric: parts.join(", "),
    detail:
      verdict === "clean"
        ? "Forward bookings and receivables track revenue."
        : verdict === "watch"
        ? "Forward bookings or receivables are drifting versus revenue."
        : "Deferred revenue is softening or receivables are growing faster than sales.",
  };
}

function overallVerdict(patterns: ForensicPattern[]): ForensicVerdict {
  const live = patterns.filter((p) => p.verdict !== "unavailable");
  if (live.length === 0) return "unavailable";
  const concerning = live.filter((p) => p.verdict === "concerning").length;
  const watch = live.filter((p) => p.verdict === "watch").length;
  if (concerning >= 2) return "concerning";
  if (concerning === 1 || watch >= 2) return "watch";
  return "clean";
}

/** Pure: score four quality-of-earnings patterns from a trailing annual series. */
export function scoreForensics(years: ForensicsYear[]): ForensicsReport {
  if (years.length === 0) {
    return { overall: "unavailable", patterns: [], yearsAnalyzed: 0 };
  }
  const patterns = [
    scoreFcfVsNi(years),
    scoreSbcDilution(years),
    scoreChannelStuffing(years),
    scoreWorkingCapital(years),
  ];
  return { overall: overallVerdict(patterns), patterns, yearsAnalyzed: years.length };
}
