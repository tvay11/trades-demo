import { deepseekJson } from "@/lib/llm/deepseek";
import { searchRiskFactors, type TavilyArticle } from "@/lib/llm/tavily";
import type { EdgarFundamentals, EdgarPeriod, FundamentalsInsight } from "./types";

const MAX_RISKS = 6;
const MAX_RISK_LEN = 240;
const MAX_INTERP_LEN = 600;

function fmtMoney(n: number | null): string {
  if (n === null) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number | null): string {
  return n === null ? "n/a" : `${n.toFixed(1)}%`;
}
function periodLine(label: string, p: EdgarPeriod | null): string {
  if (!p) return `${label}: (no data)`;
  const eps = p.dilutedEps === null ? "n/a" : `$${p.dilutedEps.toFixed(2)}`;
  return (
    `${label} ${p.fiscalLabel} (${p.form}, ended ${p.periodEnd ?? "?"}): ` +
    `revenue ${fmtMoney(p.revenue)} (YoY ${fmtPct(p.revenueYoYPct)}), ` +
    `gross margin ${fmtPct(p.grossMarginPct)}, ` +
    `net income ${fmtMoney(p.netIncome)} (YoY ${fmtPct(p.netIncomeYoYPct)}), ` +
    `diluted EPS ${eps}`
  );
}

/** Pure: grounded JSON prompt for fundamentals interpretation (#3) + 10-K risk factors (#2). */
export function buildFundamentalsPrompt(
  ticker: string,
  companyName: string | null,
  fundamentals: EdgarFundamentals | null,
  riskArticles: TavilyArticle[],
): string {
  const name = companyName ?? ticker;
  const fundLines = [
    periodLine("ANNUAL", fundamentals?.annual ?? null),
    periodLine("QUARTER", fundamentals?.quarter ?? null),
  ].join("\n");
  const articleLines =
    riskArticles.length > 0
      ? riskArticles.map((a, i) => `${i}. ${a.title}\n   ${(a.content ?? "").slice(0, 1500)}`).join("\n")
      : "(no risk-factor articles found)";
  return (
    `You are an equity research analyst. Two tasks for ${name} (${ticker}).\n\n` +
    `TASK 1 (interpretation): In 1–2 sentences, interpret what these reported fundamentals say about the business ` +
    `(growth trajectory, margins, earnings quality). Use ONLY the numbers below; never invent figures or comment on ones marked n/a.\n` +
    `${fundLines}\n\n` +
    `TASK 2 (riskFactors): Extract 3–5 concise, specific risk factors that matter to investors ` +
    `(competition, regulation/export controls, customer concentration, supply chain, valuation, demand). ` +
    `Use ONLY these articles — do NOT invent risks. If none are usable, return an empty array.\n` +
    `${articleLines}\n\n` +
    `Return ONLY JSON: {"interpretation": string, "riskFactors": string[]}. Keep each risk under 30 words.`
  );
}

/** Pure: parse + validate DeepSeek's reply (tolerates fences/prose). */
export function parseFundamentalsInsight(text: string): FundamentalsInsight | null {
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
  const interpretation =
    typeof r.interpretation === "string" ? r.interpretation.trim().slice(0, MAX_INTERP_LEN) : "";
  const riskFactors = Array.isArray(r.riskFactors)
    ? r.riskFactors
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().slice(0, MAX_RISK_LEN))
        .filter((s) => s.length > 0)
        .slice(0, MAX_RISKS)
    : [];
  if (!interpretation && riskFactors.length === 0) return null;
  return { schemaVersion: 1, interpretation, riskFactors };
}

/** Generate interpretation + risk factors. Returns null with no key, no inputs, or on failure. */
export async function generateFundamentalsInsight(
  ticker: string,
  companyName: string | null,
  fundamentals: EdgarFundamentals | null,
): Promise<FundamentalsInsight | null> {
  try {
    const riskArticles = await searchRiskFactors(ticker, companyName);
    if (!fundamentals?.annual && !fundamentals?.quarter && riskArticles.length === 0) return null;
    const text = await deepseekJson(
      buildFundamentalsPrompt(ticker, companyName, fundamentals, riskArticles),
      0.3,
    );
    if (!text) return null;
    return parseFundamentalsInsight(text);
  } catch (error) {
    console.error(`[fundamentalsInsight] ${ticker} failed`, error);
    return null;
  }
}
