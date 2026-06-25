// Yahoo Finance options chain fetcher. The `query2.finance.yahoo.com/v7/finance/options`
// endpoint is UNDOCUMENTED but stable for years; the response shape below is
// reverse-engineered from observed responses. If it ever changes, the field
// list in `YahooOptionContract` is the place to look.
//
// Caveats:
//   - Yahoo rate-limits anonymous fetches and occasionally returns 401 when
//     the User-Agent header is missing. We send a real browser UA so the
//     request looks like a manual browser hit.
//   - Cloud IPs (Vercel/AWS/etc.) are sometimes blocked. Treat fetch failures
//     as expected; the page degrades gracefully when this returns null.

import { computeGreeks, type OptionType } from "./greeks";

export type OptionContract = {
  contractSymbol: string;
  strike: number;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  /** Implied volatility as a decimal (0.32 = 32%). */
  impliedVolatility: number | null;
  inTheMoney: boolean;
  /** Days to expiration from today. */
  dte: number;
  /** Computed via Black-Scholes from spot + IV + DTE. Null when inputs missing. */
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
};

export type OptionsChain = {
  ticker: string;
  /** Underlying spot price at time of fetch. */
  spot: number | null;
  /** All expiration dates available, as YYYY-MM-DD. */
  expirations: string[];
  /** The expiration this chain represents, YYYY-MM-DD. */
  selectedExpiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
  /** When the data was fetched. */
  fetchedAt: Date;
};

export type OptionsFetchResult =
  | { ok: true; chain: OptionsChain }
  | { ok: false; reason: "no-options" | "fetch-failed" | "parse-failed"; message?: string };

const YAHOO_BASE = "https://query2.finance.yahoo.com/v7/finance/options";
const FETCH_TIMEOUT_MS = 6_000;

// Use the same dot→dash conversion as the Yahoo links in the page header
// (e.g. BRK.B → BRK-B). Yahoo's options endpoint uses the same convention.
function yahooSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

type YahooContractRaw = {
  contractSymbol: string;
  strike: number;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
  expiration?: number;
};

type YahooQuoteRaw = {
  regularMarketPrice?: number;
  dividendYield?: number;
};

type YahooResultRaw = {
  underlyingSymbol?: string;
  expirationDates?: number[];
  quote?: YahooQuoteRaw;
  options?: Array<{
    expirationDate?: number;
    calls?: YahooContractRaw[];
    puts?: YahooContractRaw[];
  }>;
};

type YahooResponse = {
  optionChain?: {
    result?: YahooResultRaw[];
    error?: { code: string; description: string } | null;
  };
};

/** Risk-free rate used when computing greeks. Approximates current 3-month
 *  T-bill yield; for short-dated equity options the result is insensitive
 *  to a few percentage points either way. */
const RISK_FREE_RATE = 0.05;

function unixToDateKey(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function daysToExpiry(unix: number): number {
  const now = Date.now();
  return Math.max(0, (unix * 1000 - now) / 86_400_000);
}

function mapContract(
  raw: YahooContractRaw,
  spot: number | null,
  dividendYield: number,
  type: OptionType,
  expirationUnix: number,
): OptionContract {
  const dte = daysToExpiry(expirationUnix);
  const T = dte / 365;
  const iv = raw.impliedVolatility ?? null;

  const greeks =
    spot != null && iv != null && iv > 0 && T > 0
      ? computeGreeks({
          spot,
          strike: raw.strike,
          timeToExpiry: T,
          riskFreeRate: RISK_FREE_RATE,
          dividendYield,
          iv,
          type,
        })
      : null;

  return {
    contractSymbol: raw.contractSymbol,
    strike: raw.strike,
    lastPrice: raw.lastPrice ?? null,
    bid: raw.bid ?? null,
    ask: raw.ask ?? null,
    volume: raw.volume ?? null,
    openInterest: raw.openInterest ?? null,
    impliedVolatility: iv,
    inTheMoney: raw.inTheMoney ?? false,
    dte,
    delta: greeks?.delta ?? null,
    gamma: greeks?.gamma ?? null,
    theta: greeks?.theta ?? null,
    vega: greeks?.vega ?? null,
    rho: greeks?.rho ?? null,
  };
}

export async function fetchYahooOptions(
  ticker: string,
  expirationDate?: string,
): Promise<OptionsFetchResult> {
  const symbol = yahooSymbol(ticker);
  // Build URL: if a specific expiration date is requested, append it as the
  // `date` query param (Yahoo expects a unix-seconds value).
  const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`);
  if (expirationDate) {
    const ts = Math.floor(new Date(`${expirationDate}T00:00:00Z`).getTime() / 1000);
    if (Number.isFinite(ts)) url.searchParams.set("date", String(ts));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      // Yahoo blocks the default fetch UA; mimic a recent Chrome request.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json,text/javascript,*/*;q=0.01",
      },
      signal: controller.signal,
      // Cache for 60s at the fetch layer so refreshes don't immediately
      // re-hammer Yahoo. Pair this with React's "use cache" upstream for
      // longer caching.
      next: { revalidate: 60 },
    });
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      reason: "fetch-failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    return { ok: false, reason: "fetch-failed", message: `HTTP ${response.status}` };
  }

  let body: YahooResponse;
  try {
    body = (await response.json()) as YahooResponse;
  } catch (error) {
    return {
      ok: false,
      reason: "parse-failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const result = body.optionChain?.result?.[0];
  if (!result || !result.options?.length) {
    return { ok: false, reason: "no-options" };
  }

  const slice = result.options[0];
  if (!slice || slice.expirationDate == null) {
    return { ok: false, reason: "no-options" };
  }

  const spot = result.quote?.regularMarketPrice ?? null;
  // Yahoo gives dividendYield as a decimal already (0.005 = 0.5%). Default to
  // 0 if missing; for short-dated options the impact is small.
  const dividendYield = result.quote?.dividendYield ?? 0;

  const chain: OptionsChain = {
    ticker: result.underlyingSymbol ?? symbol,
    spot,
    expirations: (result.expirationDates ?? [])
      .filter((unix) => Number.isFinite(unix))
      .map(unixToDateKey)
      .sort(),
    selectedExpiration: unixToDateKey(slice.expirationDate),
    calls: (slice.calls ?? []).map((c) =>
      mapContract(c, spot, dividendYield, "call", slice.expirationDate!),
    ),
    puts: (slice.puts ?? []).map((p) =>
      mapContract(p, spot, dividendYield, "put", slice.expirationDate!),
    ),
    fetchedAt: new Date(),
  };

  return { ok: true, chain };
}
