// Black-Scholes greeks for European options. Yahoo's options endpoint
// returns prices + IV but no greeks, so we compute them locally. Inputs
// must already be normalized: time in YEARS, rates as decimals.
//
// References:
//   - Hull, J. C. "Options, Futures, and Other Derivatives" §17 — closed-form
//     formulas for delta/gamma/theta/vega/rho on European options.
//
// Limitations:
//   - American options (most US equity options are American) have early-exercise
//     premium that BSM ignores. For at-the-money short-dated equity options
//     the error is small (<2%); for deep ITM puts on dividend-paying names
//     it can be larger. Treat as an approximation, not a pricing oracle.

export type OptionType = "call" | "put";

export type GreeksInput = {
  /** Underlying spot price. */
  spot: number;
  /** Strike price. */
  strike: number;
  /** Time to expiration in YEARS. Must be > 0. */
  timeToExpiry: number;
  /** Risk-free rate as decimal (e.g. 0.05 for 5%). */
  riskFreeRate: number;
  /** Continuous dividend yield as decimal. Use 0 if unknown. */
  dividendYield: number;
  /** Implied volatility as decimal (e.g. 0.30 for 30%). Must be > 0. */
  iv: number;
  type: OptionType;
};

export type Greeks = {
  /** ∂Price/∂Spot. Call: 0..1, put: -1..0. */
  delta: number;
  /** ∂²Price/∂Spot² (same for calls and puts). */
  gamma: number;
  /** ∂Price/∂Time, expressed as price change PER DAY (not per year). */
  theta: number;
  /** ∂Price/∂σ, expressed PER 1 vol-point change (not per +1.0). */
  vega: number;
  /** ∂Price/∂r, expressed PER 1 percentage-point rate change. */
  rho: number;
};

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Standard normal PDF φ(x). */
function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Standard normal CDF Φ(x). Abramowitz & Stegun 26.2.17 approximation
 *  — max error ~7.5e-8, plenty for option greeks. */
function cdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * ax);
  const poly =
    t *
    (0.319381530 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const probDensity = pdf(ax);
  return 0.5 + sign * (0.5 - probDensity * poly);
}

export function computeGreeks(input: GreeksInput): Greeks | null {
  const { spot, strike, timeToExpiry: T, riskFreeRate: r, dividendYield: q, iv, type } = input;

  if (!Number.isFinite(spot) || spot <= 0) return null;
  if (!Number.isFinite(strike) || strike <= 0) return null;
  if (!Number.isFinite(T) || T <= 0) return null;
  if (!Number.isFinite(iv) || iv <= 0) return null;

  const sqrtT = Math.sqrt(T);
  const sigmaSqrtT = iv * sqrtT;
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * iv * iv) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;

  const Nd1 = cdf(d1);
  const Nd2 = cdf(d2);
  const Nnegd1 = 1 - Nd1;
  const Nnegd2 = 1 - Nd2;
  const npd1 = pdf(d1);

  const eqT = Math.exp(-q * T);
  const erT = Math.exp(-r * T);

  let delta: number;
  let theta: number;
  let rho: number;

  if (type === "call") {
    delta = eqT * Nd1;
    // Annualized theta — converted to per-day below.
    theta =
      -(spot * eqT * npd1 * iv) / (2 * sqrtT) -
      r * strike * erT * Nd2 +
      q * spot * eqT * Nd1;
    rho = strike * T * erT * Nd2;
  } else {
    delta = eqT * (Nd1 - 1);
    theta =
      -(spot * eqT * npd1 * iv) / (2 * sqrtT) +
      r * strike * erT * Nnegd2 -
      q * spot * eqT * Nnegd1;
    rho = -strike * T * erT * Nnegd2;
  }

  const gamma = (eqT * npd1) / (spot * sigmaSqrtT);
  // Vega is per +1.0 vol change; we report per +1 vol-point (0.01).
  const vegaAnnual = spot * eqT * npd1 * sqrtT;

  return {
    delta,
    gamma,
    theta: theta / 365, // per calendar day
    vega: vegaAnnual / 100, // per 1 vol point (1%)
    rho: rho / 100, // per 1 rate point (1%)
  };
}
