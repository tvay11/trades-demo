import type { AltFlow, DarkShortPressure, GovContractFlow, ThirteenFDrift, WsbHeat } from "./types";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function shapeWsb(
  rows: { date: Date; mentions: number; sentiment: number | null }[],
  now: Date,
): WsbHeat | null {
  if (rows.length === 0) return null;
  const t7 = now.getTime() - 7 * DAY;
  const t14 = now.getTime() - 14 * DAY;
  const sorted = [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());
  const mentions7d = sorted.filter((r) => r.date.getTime() >= t7).reduce((s, r) => s + r.mentions, 0);
  const mentionsPrior7d = sorted.filter((r) => r.date.getTime() >= t14 && r.date.getTime() < t7).reduce((s, r) => s + r.mentions, 0);
  const surgeRatio = mentionsPrior7d > 0 ? Math.round((mentions7d / mentionsPrior7d) * 10) / 10 : null;
  return {
    mentions7d,
    mentionsPrior7d,
    surgeRatio,
    latestSentiment: sorted[0].sentiment,
    crowded: mentions7d >= 300 && (surgeRatio ?? 0) >= 3,
  };
}

export const MIN_DARK_BASELINE = 5;

export function shapeDarkShort(
  rows: { date: Date; shortVolumePercent: number | null }[],
): DarkShortPressure | null {
  const valid = rows.filter((r) => r.shortVolumePercent != null).sort((a, b) => b.date.getTime() - a.date.getTime());
  if (valid.length === 0) return null;
  const latest = valid[0].shortVolumePercent as number;
  const prior = valid.slice(1, 21).map((r) => r.shortVolumePercent as number);
  const baseline = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : null;
  const excessPp =
    valid.length >= MIN_DARK_BASELINE && baseline != null
      ? Math.round((latest - baseline) * 10) / 10
      : null;
  return {
    latestShortVolPct: latest,
    baselineShortVolPct: baseline == null ? null : Math.round(baseline * 10) / 10,
    excessPp,
    sampleSize: valid.length,
  };
}

export function shapeThirteenF(
  rows: { filer: string; changeShares: number | null; valueCents: bigint | null; reportDate: Date }[],
): ThirteenFDrift | null {
  if (rows.length === 0) return null;
  const latest = rows.reduce((m, r) => (r.reportDate > m ? r.reportDate : m), new Date(0));
  const period = rows.filter((r) => r.reportDate.getTime() === latest.getTime());
  const changes = period.filter((r) => r.changeShares != null);
  return {
    netChangeShares: changes.length ? changes.reduce((s, r) => s + (r.changeShares as number), 0) : null,
    holderCount: period.length,
    topHolders: [...period]
      .sort((a, b) => Number((b.valueCents ?? 0n) - (a.valueCents ?? 0n)))
      .slice(0, 3)
      .map((r) => ({ filer: r.filer, valueUsd: r.valueCents == null ? null : Number(r.valueCents) / 100 })),
    reportDate: iso(latest),
  };
}

export function shapeGovContracts(
  rows: { agency: string | null; amountCents: bigint | null; awardedAt: Date | null }[],
  now: Date,
): GovContractFlow | null {
  const cutoff = now.getTime() - 180 * DAY;
  const recent = rows
    .filter((r) => r.awardedAt != null && r.awardedAt.getTime() >= cutoff)
    .sort((a, b) => (b.awardedAt as Date).getTime() - (a.awardedAt as Date).getTime());
  if (recent.length === 0) return null;
  return {
    count180d: recent.length,
    totalUsd180d: recent.reduce((s, r) => s + (r.amountCents == null ? 0 : Number(r.amountCents) / 100), 0),
    recent: recent.slice(0, 3).map((r) => ({
      agency: r.agency,
      amountUsd: r.amountCents == null ? null : Number(r.amountCents) / 100,
      awardedAt: r.awardedAt ? iso(r.awardedAt) : null,
    })),
  };
}

export function assembleAltFlow(parts: {
  wsb: WsbHeat | null; darkShort: DarkShortPressure | null;
  thirteenF: ThirteenFDrift | null; govContracts: GovContractFlow | null;
}): AltFlow | null {
  if (!parts.wsb && !parts.darkShort && !parts.thirteenF && !parts.govContracts) return null;
  return parts;
}
