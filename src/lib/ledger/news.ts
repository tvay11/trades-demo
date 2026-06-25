import { classifyNews } from "@/lib/llm/deepseek";
import { searchNews } from "@/lib/llm/tavily";
import { db } from "@/lib/db";
import { normalizeNewsScore } from "./newsScore";
import type { NewsItem } from "./types";

export interface LedgerNews {
  items: NewsItem[];
  skew: number; // -1 (all bearish) .. +1 (all bullish)
}

export function newsSkew(items: NewsItem[]): number {
  const scored = items.filter((i) => i.sentiment !== "neutral");
  if (scored.length === 0) return 0;
  const total = scored.reduce((sum, item) => sum + normalizeNewsScore(item.score), 0);
  if (total === 0) return 0;
  const net = scored.reduce((sum, item) => {
    const weight = normalizeNewsScore(item.score);
    return sum + (item.sentiment === "bullish" ? weight : -weight);
  }, 0);
  return net / total;
}

export async function generateLedgerNews(ticker: string, companyName?: string | null): Promise<LedgerNews> {
  let name = companyName ?? null;
  if (!name) {
    try {
      const row = await db.stock.findUnique({ where: { ticker }, select: { companyName: true } });
      name = row?.companyName ?? null;
    } catch {
      name = null;
    }
  }
  const articles = await searchNews(ticker, name);
  const items = await classifyNews(articles, ticker, name);
  return { items, skew: newsSkew(items) };
}
