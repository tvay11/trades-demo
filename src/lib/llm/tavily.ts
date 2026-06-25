const ENDPOINT = "https://api.tavily.com/search";

export interface TavilyArticle {
  title: string;
  url: string | null;
  publisher: string | null;
  content: string | null;
  publishedAt: string | null;
}

function publisherFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Pure: shape a Tavily /search response into articles. */
export function parseTavilyResults(json: unknown): TavilyArticle[] {
  if (!json || typeof json !== "object") return [];
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: TavilyArticle[] = [];
  for (const raw of results) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== "string" || r.title.trim() === "") continue;
    const url = typeof r.url === "string" ? r.url : null;
    const rawContent = typeof r.raw_content === "string" && r.raw_content.trim() !== "" ? r.raw_content : null;
    const snippet = typeof r.content === "string" ? r.content : null;
    out.push({
      title: r.title,
      url,
      publisher: publisherFromUrl(url),
      content: rawContent ?? snippet,
      publishedAt: typeof r.published_date === "string" ? r.published_date : null,
    });
  }
  return out;
}

/** Pure: remove duplicate articles by url (keep first occurrence; null-url articles are kept). */
export function dedupeArticles(articles: TavilyArticle[]): TavilyArticle[] {
  const seen = new Set<string>();
  const out: TavilyArticle[] = [];
  for (const a of articles) {
    if (a.url === null) {
      out.push(a);
      continue;
    }
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out;
}

async function fetchQuery(key: string, query: string): Promise<TavilyArticle[]> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        api_key: key,
        query,
        topic: "news",
        search_depth: "basic",
        max_results: 8,
        days: 21,
        include_raw_content: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[tavily] HTTP ${res.status} ${res.statusText} for "${query}": ${body.slice(0, 400)}`);
      return [];
    }
    return parseTavilyResults(await res.json());
  } catch (error) {
    console.error(`[tavily] search failed for "${query}"`, error);
    return [];
  }
}

export async function searchGeopolitical(
  ticker: string,
  companyName: string | null,
  sector: string | null,
): Promise<TavilyArticle[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("[tavily] TAVILY_API_KEY not set — skipping geopolitical search");
    return [];
  }
  const subject = companyName ?? ticker;
  const q1 = `${subject} tariffs export controls sanctions regulation policy`;
  const q2 = `${subject} ${sector ?? "sector"} geopolitical risk supply chain China trade`;
  console.log(`[tavily] geopolitical search for ${ticker}`);
  const [a, b] = await Promise.all([fetchQuery(key, q1), fetchQuery(key, q2)]);
  const merged = dedupeArticles([...a, ...b]);
  console.log(`[tavily] ${ticker}: ${merged.length} geopolitical articles`);
  return merged;
}

/** Fetch 10-K / business risk-factor coverage for grounding the fundamentals insight. */
export async function searchRiskFactors(
  ticker: string,
  companyName: string | null,
): Promise<TavilyArticle[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("[tavily] TAVILY_API_KEY not set — skipping risk-factor search");
    return [];
  }
  const name = companyName ?? ticker;
  const [a, b] = await Promise.all([
    fetchQuery(key, `${name} 10-K annual report risk factors`),
    fetchQuery(key, `${name} (${ticker}) business risks regulation competition supply chain`),
  ]);
  return dedupeArticles([...a, ...b]);
}

/** Fetch recent open-web news for a ticker. Returns [] with no key or on failure. */
export async function searchNews(ticker: string, companyName?: string | null): Promise<TavilyArticle[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("[tavily] TAVILY_API_KEY not set — skipping news fetch");
    return [];
  }
  const subject = companyName?.trim() || ticker;
  const [general, bear] = await Promise.all([
    fetchQuery(key, `${subject} stock news`),
    fetchQuery(key, `${subject} stock risks downside valuation concerns selloff bearish`),
  ]);
  const articles = dedupeArticles([...general, ...bear]);
  console.log(`[tavily] ${ticker} (subject="${subject}"): ${articles.length} articles (2 queries, deduped)`);
  return articles;
}
