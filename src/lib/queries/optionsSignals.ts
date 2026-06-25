import YahooFinance from "yahoo-finance2";
import { applyCacheLife } from "@/lib/cache";
import type { OptionContract, OptionsLean, OptionsSignal } from "@/lib/ledger/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface OptionsComputeInput {
  spot: number; expiration: string; daysToExp: number;
  calls: OptionContract[]; puts: OptionContract[];
}
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
const nearestIv = (cs: OptionContract[], target: number) =>
  cs.filter(c => c.impliedVolatility != null)
    .sort((a, b) => Math.abs(a.strike - target) - Math.abs(b.strike - target))[0]?.impliedVolatility ?? null;

export function computeOptionsSignals(i: OptionsComputeInput): OptionsSignal {
  const asOf = new Date().toISOString().slice(0, 10);
  if (i.calls.length === 0 && i.puts.length === 0) {
    return { asOf, expiration: i.expiration, putCallVolume: null, putCallOI: null, atmIvPct: null, ivSkewPct: null, expectedMovePct: null, lean: "neutral", daysToExp: null, expectedMove60dPct: null, expiration60d: null };
  }
  const cVol = sum(i.calls.map(c => c.volume)), pVol = sum(i.puts.map(p => p.volume));
  const cOI = sum(i.calls.map(c => c.openInterest)), pOI = sum(i.puts.map(p => p.openInterest));
  const putCallVolume = cVol > 0 ? pVol / cVol : null;
  const putCallOI = cOI > 0 ? pOI / cOI : null;
  const atmCallIv = nearestIv(i.calls, i.spot), atmPutIv = nearestIv(i.puts, i.spot);
  const atmIv = [atmCallIv, atmPutIv].filter((x): x is number => x != null);
  const atmIvPct = atmIv.length ? (atmIv.reduce((a, b) => a + b, 0) / atmIv.length) * 100 : null;
  const otmPutIv = nearestIv(i.puts, i.spot * 0.9), otmCallIv = nearestIv(i.calls, i.spot * 1.1);
  const ivSkewPct = otmPutIv != null && otmCallIv != null ? (otmPutIv - otmCallIv) * 100 : null;
  const expectedMovePct = atmIvPct != null ? atmIvPct * Math.sqrt(Math.max(1, i.daysToExp) / 365) : null;
  // Lean: fear (PCR>1.1 or positive downside skew) = bearish; greed (PCR<0.7 or negative skew) = bullish.
  let s = 0;
  if (putCallVolume != null) s += putCallVolume > 1.1 ? -1 : putCallVolume < 0.7 ? 1 : 0;
  if (ivSkewPct != null) s += ivSkewPct > 3 ? -1 : ivSkewPct < -1 ? 1 : 0;
  const lean: OptionsLean = s < 0 ? "bearish" : s > 0 ? "bullish" : "neutral";
  return { asOf, expiration: i.expiration, putCallVolume, putCallOI, atmIvPct, ivSkewPct, expectedMovePct, lean, daysToExp: null, expectedMove60dPct: null, expiration60d: null };
}

// ── Expiry picker ─────────────────────────────────────────────────────────

/** Return the index in `expirations` whose days-to-expiry is closest to `targetDays`.
 *  Falls back to 0 if the array is empty. */
export function pickExpirationIndex(expirations: Date[], now: Date, targetDays = 30): number {
  if (expirations.length === 0) return 0;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < expirations.length; i++) {
    const days = (expirations[i].getTime() - now.getTime()) / 86_400_000;
    const diff = Math.abs(days - targetDays);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

// ── Yahoo Finance fetch ────────────────────────────────────────────────────

type YahooCallOrPut = {
  strike: number;
  impliedVolatility: number;
  volume?: number;
  openInterest?: number;
};

type YahooOptionChain = {
  quote: { regularMarketPrice?: number };
  expirationDates?: Date[];
  options: {
    expirationDate: Date;
    calls: YahooCallOrPut[];
    puts: YahooCallOrPut[];
  }[];
};

function toOptionContracts(cs: YahooCallOrPut[]): OptionContract[] {
  return cs.map((c) => ({
    strike: c.strike,
    impliedVolatility: Number.isFinite(c.impliedVolatility) ? c.impliedVolatility : null,
    volume: c.volume != null ? c.volume : null,
    openInterest: c.openInterest != null ? c.openInterest : null,
  }));
}

export async function getOptionsSignal(ticker: string): Promise<OptionsSignal | null> {
  "use cache";
  applyCacheLife("minutes");
  try {
    const raw = (await yahooFinance.options(ticker, undefined, { fetchOptions: { signal: AbortSignal.timeout(6000) } })) as YahooOptionChain;
    const spot = raw.quote?.regularMarketPrice;
    if (spot == null || !Number.isFinite(spot)) return null;
    const expDates: Date[] = (raw.expirationDates ?? raw.options.map(o => o.expirationDate)).filter(Boolean);
    if (expDates.length === 0) return null;
    const now = new Date();

    async function chainFor(exp: Date) {
      // already have the nearest in raw.options[0]; only refetch when different
      if (raw.options[0] && +raw.options[0].expirationDate === +exp) return raw.options[0];
      const r = (await yahooFinance.options(ticker, { date: exp }, { fetchOptions: { signal: AbortSignal.timeout(6000) } })) as YahooOptionChain;
      return r.options[0] ?? null;
    }

    const i30 = pickExpirationIndex(expDates, now, 30);
    const exp30 = expDates[i30];
    const c30 = await chainFor(exp30);
    if (!c30) return null;
    const days30 = Math.round((exp30.getTime() - now.getTime()) / 86_400_000);
    const primary = computeOptionsSignals({
      spot, expiration: exp30.toISOString().slice(0, 10), daysToExp: days30,
      calls: toOptionContracts(c30.calls), puts: toOptionContracts(c30.puts),
    });

    const i60 = pickExpirationIndex(expDates, now, 60);
    const exp60 = expDates[i60];
    let expectedMove60dPct: number | null = null, expiration60d: string | null = null;
    if (i60 !== i30) {
      const c60 = await chainFor(exp60);
      if (c60) {
        const s60 = computeOptionsSignals({ spot, expiration: exp60.toISOString().slice(0, 10),
          daysToExp: Math.round((exp60.getTime() - now.getTime()) / 86_400_000),
          calls: toOptionContracts(c60.calls), puts: toOptionContracts(c60.puts) });
        expectedMove60dPct = s60.expectedMovePct; expiration60d = s60.expiration;
      }
    }
    return { ...primary, daysToExp: days30, expectedMove60dPct, expiration60d };
  } catch (e) {
    console.error(`[options] getOptionsSignal(${ticker}) failed`, e);
    return null;
  }
}
