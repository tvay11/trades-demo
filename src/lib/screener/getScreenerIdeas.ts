import { getStocksList, type StockListParams } from "@/lib/queries/stocksList";
import { scoreScreenerRow } from "./score";
import type { ScreenerIdea } from "./score";

export interface ScreenerParams extends StockListParams { limit?: number; poolSize?: number; }

export async function getScreenerIdeas(params: ScreenerParams = {}): Promise<ScreenerIdea[]> {
  const poolSize = Math.min(2000, params.poolSize ?? 800);
  const limit = Math.min(200, params.limit ?? 25);

  // 1) Filter the universe (reuse the tested /stocks query). Sort by 90d activity so the pool is the most-active names.
  const list = await getStocksList({ ...params, sort: "tradeCount90", dir: "desc", page: 1, pageSize: poolSize });
  if (list.rows.length === 0) return [];

  // 2) Score + assemble.
  const ideas: ScreenerIdea[] = list.rows.map((r) => {
    const scored = scoreScreenerRow({
      tradeCount90: r.tradeCount90, tradeCount14: r.tradeCount14, marketCap: r.marketCap,
    });
    return { ticker: r.ticker, companyName: r.companyName, sector: r.sector, ...scored };
  });

  ideas.sort((a, b) => b.score - a.score);
  return ideas.slice(0, limit);
}
