/**
 * Parse a Quiver dollar-range string into { min, max } dollar numbers.
 *
 * Handled inputs:
 *   "$1,001 - $15,000"     -> { min: 1001, max: 15000 }
 *   "$50,000"              -> { min: 50000, max: 50000 }   (single value, treat min=max)
 *   "$5,000,000+"          -> { min: 5000000, max: 5000000 } (open-ended; treat upper as floor)
 *   "$5M - $25M"           -> { min: 5000000, max: 25000000 }
 *   "$1,000 -"             -> null                          (malformed: max < min)
 *   ""                     -> null
 *
 * Returns null when the input is unparseable. Notably, an open-ended bound
 * like "$5M+" returns { min: lower, max: lower } rather than null so the row
 * isn't dropped, but downstream minimum math treats it as a floor — slightly
 * conservative but never inflates.
 */
export function parseAmountRange(range: string): { min: number; max: number } | null {
  if (!range) return null;
  const cleaned = range.replace(/\$/g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;

  const openEnded = /\+$/.test(cleaned);
  const body = cleaned.replace(/\+$/, "").trim();
  if (!body) return null;

  const parts = body.split(/\s*-\s*/).map((p) => p.trim());
  const minStr = parts[0];
  const maxStr = parts[1];

  const min = parseSuffixedNumber(minStr);
  if (!Number.isFinite(min)) return null;

  if (openEnded) return { min, max: min };
  if (maxStr === undefined) return { min, max: min };
  if (maxStr === "") return null; // "$1,000 -" trailing dash with no upper bound

  const max = parseSuffixedNumber(maxStr);
  if (!Number.isFinite(max) || max < min) return null;
  return { min, max };
}

function parseSuffixedNumber(s: string | undefined): number {
  if (!s) return NaN;
  const match = /^(\d+(?:\.\d+)?)([KMB])?$/i.exec(s);
  if (!match) return Number(s);
  const n = Number(match[1]);
  const suffix = match[2]?.toUpperCase();
  if (suffix === "K") return n * 1_000;
  if (suffix === "M") return n * 1_000_000;
  if (suffix === "B") return n * 1_000_000_000;
  return n;
}
