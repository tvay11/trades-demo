import { getDailyBars } from "@/lib/yahoo/client";

export const BENCHMARK_TICKER = "SPY";

/** Fetch ~lookbackDays of SPY closes from Yahoo and upsert into TickerPriceCache (cents). */
export async function refreshBenchmarkBars(lookbackDays = 400): Promise<number> {
  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);
  const bars = await getDailyBars(BENCHMARK_TICKER, from, to);
  return bars.length;
}
