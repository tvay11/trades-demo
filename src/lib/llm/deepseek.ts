import type { NewsItem, NewsSentiment, NewsRelevance, NewsEventType, NewsSurprise } from "@/lib/ledger/types";
import { computeNewsImportance, normEventType, normRelevance, normSurprise } from "@/lib/ledger/newsImportance";
import type { TavilyArticle } from "./tavily";

const ENDPOINT = "https://api.deepseek.com/chat/completions";

export interface NewsVerdict {
  index: number;
  sentiment: NewsSentiment;
  relevance: NewsRelevance;
  eventType: NewsEventType;
  surprise: NewsSurprise;
  summary: string | null;
}

function normSentiment(s: unknown): NewsSentiment {
  const v = String(s ?? "").toLowerCase();
  if (v === "bullish") return "bullish";
  if (v === "bearish") return "bearish";
  return "neutral";
}

/** Pure: parse DeepSeek's reply into per-article verdicts (tolerates fences/prose). */
export function parseVerdicts(text: string): NewsVerdict[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: NewsVerdict[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.index !== "number" || !Number.isInteger(r.index)) continue;
    out.push({
      index: r.index,
      sentiment: normSentiment(r.sentiment),
      relevance: normRelevance(r.relevance),
      eventType: normEventType(r.eventType),
      surprise: normSurprise(r.surprise),
      summary: typeof r.summary === "string" ? r.summary : null,
    });
  }
  return out;
}

/** Pure: merge verdicts onto source articles (preserve title/url/publisher), sorted by index. */
export function mergeVerdicts(articles: TavilyArticle[], verdicts: NewsVerdict[]): NewsItem[] {
  return verdicts
    .filter((v) => v.index >= 0 && v.index < articles.length)
    .sort((a, b) => a.index - b.index)
    .map((v) => {
      const a = articles[v.index];
      return {
        title: a.title,
        publisher: a.publisher,
        url: a.url,
        publishedAt: a.publishedAt,
        summary: v.summary,
        sentiment: v.sentiment,
        score: computeNewsImportance(v.relevance, v.eventType, v.surprise),
        relevance: v.relevance,
        eventType: v.eventType,
        surprise: v.surprise,
      };
    });
}

export function buildNewsPrompt(articles: TavilyArticle[], ticker: string, companyName?: string | null): string {
  const subject = companyName?.trim() ? `${companyName.trim()} (${ticker})` : `(${ticker})`;
  const lines = articles.map(
    (a, i) =>
      `${i}. ${a.title}\n   [${a.publisher ?? "unknown publisher"} · ${a.publishedAt ?? "unknown date"}]\n   ${(a.content ?? "").slice(0, 2000)}`,
  );
  return (
    `You are a sell-side equity analyst covering ${subject}. For each numbered article, classify it FOR THIS COMPANY ONLY.\n` +
    `Fields per article:\n` +
    `1. "sentiment" — impact direction for ${subject}:\n` +
    `   - bullish: record results, beats, raised guidance, upgrades, new demand/customers, buybacks/dividends, positive catalysts.\n` +
    `   - bearish: valuation concerns, downgrades, competition/market-share loss, regulatory/legal/export risk, demand softness, insider selling, "sell the news"/profit-taking, weak guidance.\n` +
    `   - neutral: no clear directional impact, or genuinely mixed.\n` +
    `2. "relevance" — who the article is actually about:\n` +
    `   - direct: about ${subject} itself.\n` +
    `   - sector: about a peer, supplier, customer, or its industry with read-through to it.\n` +
    `   - macro: market-wide or economy-wide news.\n` +
    `   - unrelated: about a different company or topic with no meaningful read-through. If the article is about another company whose name or ticker merely resembles ${subject}, it is unrelated.\n` +
    `3. "eventType" — the kind of event:\n` +
    `   - earnings_guidance: results, guidance, pre-announcements.\n` +
    `   - ma_strategic: M&A, spin-offs, major partnerships/strategic deals.\n` +
    `   - regulatory_legal: regulation, lawsuits, investigations, tariffs/export rules.\n` +
    `   - analyst_action: upgrades/downgrades, price-target or rating changes.\n` +
    `   - product_demand: product launches, demand signals, major customer wins/losses.\n` +
    `   - insider_institutional: insider trades, 13F/fund position changes.\n` +
    `   - commentary_listicle: opinion pieces, "top N stocks" lists, recaps.\n` +
    `   - routine_filing: mechanical filing coverage with no new information.\n` +
    `4. "surprise" — information freshness:\n` +
    `   - new_material: genuinely new, market-moving information.\n` +
    `   - incremental: adds detail to a known story.\n` +
    `   - recycled_known: rehashes already-public information.\n` +
    `5. "summary" — 1–2 sentences.\n` +
    `Be discerning — do NOT default everything to bullish or to direct. Judge each article on its own content.\n` +
    `Return ONLY a JSON array, one object per article: {"index": number, "sentiment": "bullish"|"bearish"|"neutral", "relevance": "direct"|"sector"|"macro"|"unrelated", "eventType": "earnings_guidance"|"ma_strategic"|"regulatory_legal"|"analyst_action"|"product_demand"|"insider_institutional"|"commentary_listicle"|"routine_filing", "surprise": "new_material"|"incremental"|"recycled_known", "summary": string}.\n\n` +
    lines.join("\n")
  );
}

/** Reusable DeepSeek plain-text (non-JSON) call. Returns message content, or null on no key / error. */
export async function deepseekChat(prompt: string, temperature = 0.3): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.warn("[deepseek] DEEPSEEK_API_KEY not set");
    return null;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[deepseek] HTTP ${res.status} ${res.statusText}: ${body.slice(0, 400)}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[deepseek] chat call failed", error);
    return null;
  }
}

/** Reusable DeepSeek JSON-mode call. Returns message content string, or null on no key / error. */
export async function deepseekJson(prompt: string, temperature = 0.4): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.warn("[deepseek] DEEPSEEK_API_KEY not set");
    return null;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[deepseek] HTTP ${res.status} ${res.statusText}: ${body.slice(0, 400)}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[deepseek] json call failed", error);
    return null;
  }
}

/** Classify Tavily articles with DeepSeek. Returns [] with no key, no articles, or on failure. */
export async function classifyNews(articles: TavilyArticle[], ticker: string, companyName?: string | null): Promise<NewsItem[]> {
  if (articles.length === 0) return [];
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.warn("[deepseek] DEEPSEEK_API_KEY not set — returning unclassified-empty");
    return [];
  }
  console.log(`[deepseek] classifying ${articles.length} articles`);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        messages: [{ role: "user", content: buildNewsPrompt(articles, ticker, companyName) }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[deepseek] HTTP ${res.status} ${res.statusText}: ${body.slice(0, 400)}`);
      return [];
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const items = mergeVerdicts(articles, parseVerdicts(text));
    console.log(`[deepseek] classified ${items.length} items`);
    return items;
  } catch (error) {
    console.error("[deepseek] classify failed", error);
    return [];
  }
}
