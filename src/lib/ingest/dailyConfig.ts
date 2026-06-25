export const DEFAULT_DAILY_DATASETS = ["CongressTrade", "SenateTrade", "HouseTrade"] as const;

export function resolveDailyDatasetNames(
  argvNames: string[],
  envValue: string | undefined,
): string[] | null {
  const explicit = normalizeDatasetNames(argvNames);
  if (explicit.length > 0) return isAll(explicit) ? null : explicit;

  const fromEnv = parseDatasetEnv(envValue);
  if (fromEnv.length > 0) return isAll(fromEnv) ? null : fromEnv;

  return [...DEFAULT_DAILY_DATASETS];
}

export function dailyCutoffIso(now: Date, lookbackDays: number) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays);
  return cutoff.toISOString().slice(0, 10);
}

export function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseDatasetEnv(value: string | undefined) {
  if (!value) return [];
  return normalizeDatasetNames(value.split(/[\s,]+/));
}

function normalizeDatasetNames(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function isAll(values: string[]) {
  return values.length === 1 && values[0].toLowerCase() === "all";
}
