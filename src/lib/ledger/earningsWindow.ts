/**
 * Returns true when a known upcoming earnings date falls inside the option's
 * expiry window.  Both inputs must be non-null and earnings must be in the
 * future (daysUntilEarnings >= 0) and on or before expiry.
 */
export function earningsInsideWindow(
  daysUntilEarnings: number | null,
  daysToExp: number | null,
): boolean {
  if (daysUntilEarnings == null || daysToExp == null) return false;
  return daysUntilEarnings >= 0 && daysUntilEarnings <= daysToExp;
}
