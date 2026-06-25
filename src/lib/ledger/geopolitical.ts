import { deepseekJson } from "@/lib/llm/deepseek";
import { searchGeopolitical, type TavilyArticle } from "@/lib/llm/tavily";
import { computeGeoImportance, normGeoChannel, normGeoExposure, normGeoStatus } from "./geoImportance";
import { normalizeGeoScore } from "./geoScore";
import type { GeoFactor, GeoImpact, GeoImpactDir, GeoLean } from "./types";

function normImpact(v: unknown): GeoImpactDir {
  const s = String(v ?? "").toLowerCase();
  if (s === "positive") return "positive";
  if (s === "negative") return "negative";
  return "mixed";
}
function normLean(v: unknown): GeoLean {
  const s = String(v ?? "").toLowerCase();
  if (s === "tailwind") return "tailwind";
  if (s === "headwind") return "headwind";
  return "mixed";
}

export function buildGeoPrompt(
  ticker: string,
  companyName: string | null,
  sector: string | null,
  articles: TavilyArticle[],
): string {
  const subject = companyName ?? ticker;
  const lines = articles.map((a, i) => `${i}. ${a.title}\n   ${(a.content ?? "").slice(0, 1500)}`);
  return (
    `You are a geopolitical & macro analyst. The company is ${subject} (ticker ${ticker}, sector ${sector ?? "unknown"}). ` +
    `From the numbered recent articles below, identify the geopolitical / macro / regulatory / trade events that materially affect THIS company's stock. ` +
    `Use ONLY these articles — do not invent events. For each factor, cite the source via its article "index".\n\n` +
    `For each factor classify:\n` +
    `1. "impact" — direction for ${subject}'s stock: "positive" | "negative" | "mixed".\n` +
    `2. "channel" — the kind of event:\n` +
    `   - "sanctions_export_controls": sanctions, export bans, entity lists\n` +
    `   - "tariffs_trade": tariffs, quotas, trade deals or disputes\n` +
    `   - "regulation_policy": antitrust, industrial policy, subsidies, government rules\n` +
    `   - "armed_conflict_security": war, military escalation, terrorism, major cyberattacks\n` +
    `   - "energy_commodities": oil/gas shocks, commodity supply disruptions\n` +
    `   - "monetary_fiscal": central-bank policy, government spending, currency moves\n` +
    `   - "elections_political": elections, leadership changes, political instability\n` +
    `   - "diplomacy_summits": talks, treaties, summits, diplomatic signals\n` +
    `3. "exposure" — how directly the event hits ${subject}:\n` +
    `   - "company_targeted": ${subject} or its products are explicitly named or targeted\n` +
    `   - "sector_supply_chain": hits ${subject}'s sector, key customers, or supply chain\n` +
    `   - "macro_broad": broad backdrop affecting most stocks\n` +
    `4. "status" — how real the event is:\n` +
    `   - "in_effect": enacted, signed, officially announced, already happening\n` +
    `   - "proposed_likely": formally proposed or credibly advancing\n` +
    `   - "speculative_rumor": rumored, threatened, opinion-piece speculation\n\n` +
    `Do NOT output a numeric importance number — it is computed from your categories.\n` +
    `Respond with a single JSON object (no markdown) with EXACTLY: ` +
    `{"summary": string (1-2 sentence overall geopolitical read for this stock), ` +
    `"netLean": "tailwind" | "headwind" | "mixed", ` +
    `"factors": [{"index": number, "event": string, "impact": "positive"|"negative"|"mixed", ` +
    `"channel": "sanctions_export_controls"|"tariffs_trade"|"regulation_policy"|"armed_conflict_security"|"energy_commodities"|"monetary_fiscal"|"elections_political"|"diplomacy_summits", ` +
    `"exposure": "company_targeted"|"sector_supply_chain"|"macro_broad", ` +
    `"status": "in_effect"|"proposed_likely"|"speculative_rumor", ` +
    `"rationale": string (1 sentence: how it affects THIS company)}]}.\n\n` +
    lines.join("\n")
  );
}

/** Pure: parse DeepSeek geopolitical JSON, merge source url/publisher by article index. null if invalid. */
export function parseGeoImpact(text: string, articles: TavilyArticle[]): GeoImpact | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const r = parsed as Record<string, unknown>;
  const summary = typeof r.summary === "string" ? r.summary : null;
  if (!summary) return null;
  const rawFactors = Array.isArray(r.factors) ? r.factors : [];
  const factors: GeoFactor[] = [];
  for (const raw of rawFactors) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const event = typeof f.event === "string" ? f.event.trim() : "";
    const rationale = typeof f.rationale === "string" ? f.rationale : "";
    if (!event) continue;
    const idx = typeof f.index === "number" && Number.isInteger(f.index) ? f.index : -1;
    if (idx < 0 || idx >= articles.length) continue;
    const src = articles[idx];
    const hasFacets = "channel" in f || "exposure" in f || "status" in f;
    if (hasFacets) {
      const channel = normGeoChannel(f.channel);
      const exposure = normGeoExposure(f.exposure);
      const status = normGeoStatus(f.status);
      factors.push({
        event,
        impact: normImpact(f.impact),
        score: computeGeoImportance(exposure, channel, status),
        channel,
        exposure,
        status,
        rationale,
        url: src?.url ?? null,
        publisher: src?.publisher ?? null,
      });
    } else {
      factors.push({
        event,
        impact: normImpact(f.impact),
        score: normalizeGeoScore(f.score, f.magnitude),
        rationale,
        url: src?.url ?? null,
        publisher: src?.publisher ?? null,
      });
    }
  }
  if (factors.length === 0) return null;
  return { summary, netLean: normLean(r.netLean), factors };
}

/** Fetch geopolitical news + classify impact with DeepSeek. null on no data / no key / failure. */
export async function generateGeopolitical(
  ticker: string,
  companyName: string | null,
  sector: string | null,
): Promise<GeoImpact | null> {
  try {
    const articles = await searchGeopolitical(ticker, companyName, sector);
    if (articles.length === 0) return null;
    const text = await deepseekJson(buildGeoPrompt(ticker, companyName, sector, articles), 0.3);
    if (!text) return null;
    const impact = parseGeoImpact(text, articles);
    console.log(`[geopolitical] ${ticker}: ${impact ? impact.factors.length + " factors" : "none"}`);
    return impact;
  } catch (error) {
    console.error(`[geopolitical] ${ticker} failed`, error);
    return null;
  }
}
