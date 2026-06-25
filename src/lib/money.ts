export type Cents = number | bigint | null | undefined;

export function centsToDollars(value: Cents) {
  if (value == null) return null;
  return Number(value) / 100;
}

/**
 * Conservative lower-bound value of a disclosed range, returned in DOLLARS.
 *
 * Inputs are the raw cents values stored in `amountMinCents` / `amountMaxCents`.
 * Congressional and executive disclosures usually provide ranges, not exact
 * fills, so the app uses the minimum disclosed amount as the default factual
 * dollar measure instead of inventing a precise fill.
 *
 * When `min` is null we return 0 — without a known floor there's no
 * conservative value to assert. (Returning the max would be the opposite of
 * conservative and contradicts the function name.)
 */
export function minimumDollars(min: Cents, max: Cents): number {
  if (min == null) return 0;
  const minNum = Number(min);
  if (max == null) return minNum / 100;
  return Math.min(minNum, Number(max)) / 100;
}

export function dollarsToCentsBigInt(value: number) {
  return BigInt(Math.round(value * 100));
}
