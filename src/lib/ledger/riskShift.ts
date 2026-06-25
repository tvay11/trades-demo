import { deepseekJson } from "@/lib/llm/deepseek";
import { resolveCik } from "@/lib/queries/edgarFundamentals";
import type { RiskShift } from "./types";

// Reuse the same User-Agent as edgarFundamentals.ts
const UA = { "User-Agent": "trades-research-app (contact: research@example.com)" };

/** Extract Item 1A text from a filing's HTML/text. Returns null when not found. */
export function extractItem1A(doc: string): string | null {
  const text = doc
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  // last occurrence of "Item 1A" (TOC mentions come first), ending at the following "Item 1B"
  const startRe = /item\s*1a\.?\s*risk\s*factors/gi;
  let start = -1;
  for (let m = startRe.exec(text); m; m = startRe.exec(text)) start = m.index;
  if (start === -1) return null;
  const tail = text.slice(start);
  const end = tail.search(/item\s*1b\.?/i);
  const body = (end === -1 ? tail : tail.slice(0, end)).trim();
  return body.length < 500 ? null : body.slice(0, 12_000);
}

export function buildRiskShiftPrompt(
  company: string,
  prevLabel: string,
  currLabel: string,
  prevText: string,
  currText: string,
): string {
  return (
    `You compare Risk Factors (Item 1A) across two annual reports for ${company}. ` +
    `Identify what is genuinely NEW or materially expanded in the newer filing, and what was REMOVED or materially de-emphasized. ` +
    `Ignore boilerplate present in both. Respond with a single JSON object (no markdown) with EXACTLY: ` +
    `{"newRisks": string[] (0-5 short phrases), "removedRisks": string[] (0-3 short phrases), ` +
    `"shiftSummary": string (1-2 sentences: what the change in risk language says about the business)}.\n\n` +
    `=== OLDER (${prevLabel}) ===\n${prevText}\n\n=== NEWER (${currLabel}) ===\n${currText}`
  );
}

/** Parse DeepSeek risk-shift JSON. null if invalid. Mirrors parseGeoImpact structure. */
export function parseRiskShift(
  text: string,
  fromFiling: string,
  toFiling: string,
): RiskShift | null {
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

  const shiftSummary = typeof r.shiftSummary === "string" ? r.shiftSummary.trim() : "";
  if (!shiftSummary) return null;

  const toStringArr = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.filter((s) => typeof s === "string" && s.length > 0) as string[];
  };

  const newRisks = toStringArr(r.newRisks).slice(0, 5);
  const removedRisks = toStringArr(r.removedRisks).slice(0, 3);

  return { newRisks, removedRisks, shiftSummary, fromFiling, toFiling };
}

async function fetchLastTwo10Ks(cik: string): Promise<{ label: string; url: string }[]> {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: UA });
  if (!res.ok) return [];
  const j = (await res.json()) as {
    filings?: {
      recent?: {
        form?: string[];
        accessionNumber?: string[];
        primaryDocument?: string[];
        filingDate?: string[];
      };
    };
  };
  const r = j.filings?.recent;
  if (!r?.form) return [];
  const out: { label: string; url: string }[] = [];
  for (let i = 0; i < r.form.length && out.length < 2; i++) {
    if (r.form[i] !== "10-K") continue;
    const acc = (r.accessionNumber?.[i] ?? "").replace(/-/g, "");
    const doc = r.primaryDocument?.[i] ?? "";
    if (!acc || !doc) continue;
    out.push({
      label: `10-K ${r.filingDate?.[i] ?? "?"}`,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}`,
    });
  }
  return out; // newest first
}

export async function generateRiskShift(
  ticker: string,
  companyName: string | null,
): Promise<RiskShift | null> {
  try {
    const cik = await resolveCik(ticker.trim().toUpperCase());
    if (!cik) return null;
    const filings = await fetchLastTwo10Ks(cik);
    if (filings.length < 2) return null;
    const [curr, prev] = filings;
    const [currDoc, prevDoc] = await Promise.all([
      fetch(curr.url, { headers: UA }).then((r) => (r.ok ? r.text() : "")),
      fetch(prev.url, { headers: UA }).then((r) => (r.ok ? r.text() : "")),
    ]);
    const currText = extractItem1A(currDoc);
    const prevText = extractItem1A(prevDoc);
    if (!currText || !prevText) return null;
    const text = await deepseekJson(
      buildRiskShiftPrompt(companyName ?? ticker, prev.label, curr.label, prevText, currText),
      0.3,
    );
    if (!text) return null;
    return parseRiskShift(text, prev.label, curr.label);
  } catch (e) {
    console.error(`[riskShift] ${ticker} failed`, e);
    return null;
  }
}
