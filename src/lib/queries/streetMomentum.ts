import { applyCacheLife } from "@/lib/cache";
import YahooFinance from "yahoo-finance2";
import { shapeStreetMomentum, type RawActionRow, type RawHistoryRow, type RawTrendRow } from "@/lib/ledger/streetMomentum";
import type { StreetMomentum } from "@/lib/ledger/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function getStreetMomentum(
  ticker: string,
  nextEarningsDaysUntil: number | null,
): Promise<StreetMomentum | null> {
  "use cache";
  applyCacheLife("hours");
  try {
    const result = (await yahooFinance.quoteSummary(ticker, {
      modules: ["earningsTrend", "earningsHistory", "upgradeDowngradeHistory"],
    })) as {
      earningsTrend?: { trend?: RawTrendRow[] };
      earningsHistory?: { history?: RawHistoryRow[] };
      upgradeDowngradeHistory?: { history?: RawActionRow[] };
    };
    return shapeStreetMomentum({
      trend: result.earningsTrend?.trend ?? [],
      history: result.earningsHistory?.history ?? [],
      actions: result.upgradeDowngradeHistory?.history ?? [],
      nextEarningsDaysUntil,
      now: new Date(),
    });
  } catch (e) {
    console.error(`[streetMomentum] quoteSummary failed for ${ticker}:`, (e as Error).message);
    return null;
  }
}
