const WATCHLIST_TICKER_RE = /^[A-Z0-9][A-Z0-9-]{0,9}$/;

export function normalizeWatchlistTicker(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") return null;

  const ticker = value.trim().toUpperCase().replace(/\./g, "-");
  if (!WATCHLIST_TICKER_RE.test(ticker)) return null;

  return ticker;
}
