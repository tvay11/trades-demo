import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { minimumDollars } from "@/lib/money";
import { classifyAction } from "@/lib/trades/classify";

// Executive-branch official trades (cabinet secretaries, agency heads, etc.)
// treated as a first-class insider signal. Unlike the enrichment layer, these
// CREATE rows in the buy brief — a ticker traded only by an executive official
// still surfaces, because executive-branch holdings are among the most direct
// "insider" disclosures available (these people sit on the policy that moves
// the stock).

export interface ExecutiveSignal {
  ticker: string;
  direction: "Bullish" | "Bearish" | "Mixed";
  buyCount: number;
  sellCount: number;
  tradeCount: number;
  /** Net signed dollars: buys minus sells (conservative minimum-disclosed value). */
  netUsd: number;
  /** Gross dollars traded (buys + sells). */
  totalUsd: number;
  /** Distinct officials involved (capped to 5 names for the CSV cell). */
  officials: string[];
  officialCount: number;
  latestDate: Date | null;
}

const LOOKBACK_DAYS = 365;

// Leftover BigInt-probe rows live under this sentinel ticker (see scripts/archive
// probe-bigint-*.ts and the db.ts notes); never surface them as a real signal.
const PROBE_TICKER = "__THRESH__";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function getExecutiveSignals(): Promise<{
  signals: ExecutiveSignal[];
  source: "database" | "database-error";
}> {
  "use cache";
  applyCacheLife("minutes");

  const since = daysAgo(LOOKBACK_DAYS);

  try {
    const rows = await db.executiveTrade.findMany({
      where: { transactionDate: { gte: since }, ticker: { not: null } },
      select: {
        ticker: true,
        transactionType: true,
        transactionDate: true,
        amountMinCents: true,
        amountMaxCents: true,
        official: { select: { name: true } },
      },
    });

    type Agg = {
      buy: number;
      sell: number;
      net: number;
      total: number;
      officials: Set<string>;
      latest: Date | null;
    };
    const byTicker = new Map<string, Agg>();

    for (const r of rows) {
      if (!r.ticker || r.ticker === PROBE_TICKER) continue;
      const action = classifyAction(r.transactionType);
      if (action === "other") continue;
      const value = minimumDollars(r.amountMinCents, r.amountMaxCents);

      const agg = byTicker.get(r.ticker) ?? {
        buy: 0,
        sell: 0,
        net: 0,
        total: 0,
        officials: new Set<string>(),
        latest: null,
      };
      if (action === "buy") agg.buy++;
      else agg.sell++;
      agg.total += value;
      agg.net += action === "buy" ? value : -value;
      if (r.official?.name) agg.officials.add(r.official.name);
      if (!agg.latest || r.transactionDate > agg.latest) agg.latest = r.transactionDate;
      byTicker.set(r.ticker, agg);
    }

    const signals: ExecutiveSignal[] = [];
    for (const [ticker, a] of byTicker) {
      const direction = a.net > 0 ? "Bullish" : a.net < 0 ? "Bearish" : "Mixed";
      signals.push({
        ticker,
        direction,
        buyCount: a.buy,
        sellCount: a.sell,
        tradeCount: a.buy + a.sell,
        netUsd: a.net,
        totalUsd: a.total,
        officials: [...a.officials].slice(0, 5),
        officialCount: a.officials.size,
        latestDate: a.latest,
      });
    }

    // Order by actual gross dollars traded, then by trade count — no synthetic
    // conviction score. The buy brief re-sorts globally; this is just a sensible
    // default ordering for any direct consumer.
    signals.sort((x, y) => y.totalUsd - x.totalUsd || y.tradeCount - x.tradeCount);
    return { signals, source: "database" };
  } catch (error) {
    console.error("[executiveSignals] query failed", error);
    return { signals: [], source: "database-error" };
  }
}
