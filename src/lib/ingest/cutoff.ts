const DEFAULT_CUTOFF = "2024-12-01";

export function ingestMinDateString(): string {
  return process.env.INGEST_MIN_DATE ?? DEFAULT_CUTOFF;
}

export function ingestMinDate(): Date {
  return new Date(`${ingestMinDateString()}T00:00:00Z`);
}

export function isAfterCutoff(date: Date | null | undefined, cutoff?: Date): boolean {
  if (!date) return true;
  const ts = date.getTime();
  if (!Number.isFinite(ts)) return true;
  return ts >= (cutoff ?? ingestMinDate()).getTime();
}
