// Quiver / U.S. House disclosure buckets. Minimum values are used wherever
// the underlying range is the only thing the dataset gives us. This keeps
// volume calculations conservative instead of inventing a precise estimate.
const AMOUNT_RANGES = [
  { label: "$1K-$15K", min: 1_000, max: 15_000 },
  { label: "$15K-$50K", min: 15_000, max: 50_000 },
  { label: "$50K-$100K", min: 50_000, max: 100_000 },
  { label: "$100K-$250K", min: 100_000, max: 250_000 },
  { label: "$250K-$500K", min: 250_000, max: 500_000 },
  { label: "$500K-$1M", min: 500_000, max: 1_000_000 },
  { label: "$1M-$5M", min: 1_000_000, max: 5_000_000 },
  // Previously missing — Quiver/House return these for senior officials,
  // and amountMinimum() was returning 0 for every match.
  { label: "$5M-$25M", min: 5_000_000, max: 25_000_000 },
  { label: "$25M-$50M", min: 25_000_000, max: 50_000_000 },
  { label: "$50M+", min: 50_000_000, max: 50_000_000 },
];

export function amountMinimum(amount: string) {
  const match = AMOUNT_RANGES.find((range) => range.label === amount);
  if (!match) return 0;
  return match.min;
}

export function formatMoney(value: number) {
  // Handle negatives explicitly. Previously the threshold comparisons used
  // `>=` so a value of -2_000_000 fell through every guard and printed as
  // "$-2000000" (sign in the wrong place); callers prefixing "+" produced
  // "+$-2.0M". formatSignedMoney still exists for the case where callers
  // want a leading "+" on positives.
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

/** Compact a share-volume count for chart axes/tooltips: 1.25M, 850K, 1.25B. */
export function formatVolume(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${Math.round(n)}`;
}

export function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
