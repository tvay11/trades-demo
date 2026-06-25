import { deepseekJson } from "@/lib/llm/deepseek";
import { resolveCik } from "@/lib/queries/edgarFundamentals";
import type { SegmentBreakdown, SegmentLine } from "./types";

// Reuse the same User-Agent as edgarFundamentals.ts
const UA = { "User-Agent": "trades-research-app (contact: research@example.com)" };

/** Pick the ×1 / ×1e3 / ×1e6 factor that best aligns the segment sum with the
 *  reported full-dollar total (10-K segment tables are often in thousands/millions). */
function bestScale(sum: number, total: number): number {
  if (sum <= 0 || total <= 0) return 1;
  let best = 1;
  let bestErr = Infinity;
  for (const k of [1, 1e3, 1e6]) {
    const err = Math.abs(Math.log((sum * k) / total));
    if (err < bestErr) { bestErr = err; best = k; }
  }
  return best;
}

/** Find the segment-reporting footnote and return a text window around it. */
export function extractSegmentNote(doc: string): string | null {
  const text = doc
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  const re =
    /(reportable\s+segments|segment\s+information|revenue[s]?\s+by\s+(reportable\s+)?segment|disaggregation\s+of\s+revenue)/gi;
  // last occurrence wins — the table of contents mentions the heading before the real note
  let start = -1;
  for (let m = re.exec(text); m; m = re.exec(text)) start = m.index;
  if (start === -1) return null;
  const body = text.slice(Math.max(0, start - 200), start + 9000).trim();
  return body.length < 200 ? null : body;
}

export function buildSegmentPrompt(company: string, noteText: string): string {
  return (
    `Extract revenue by reportable segment (or product line) for ${company} from the 10-K excerpt below. ` +
    `Use ONLY numbers present in the text; do NOT invent. Keep each segment's revenue in the SAME units the text uses. ` +
    `If the excerpt has no segment revenue table, return {"segments": []}.\n` +
    `Return ONLY JSON: {"fiscalLabel": string, "note": string (<=1 sentence), ` +
    `"segments": [{"name": string, "revenue": number, "revenuePriorYear": number|null}]}.\n\n` +
    `=== 10-K EXCERPT ===\n${noteText}`
  );
}

/** Parse + validate. totalRevenue (same scale as segment numbers, or null) drives reconciliation. */
export function parseSegmentBreakdown(
  text: string,
  totalRevenue: number | null,
): SegmentBreakdown | null {
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
  const raw = Array.isArray(r.segments) ? r.segments : [];
  const cleaned = raw
    .map((s) => s as Record<string, unknown>)
    .filter(
      (s) =>
        typeof s.name === "string" &&
        typeof s.revenue === "number" &&
        (s.revenue as number) > 0,
    )
    .map((s) => ({
      name: (s.name as string).trim(),
      revenue: s.revenue as number,
      prior:
        typeof s.revenuePriorYear === "number"
          ? (s.revenuePriorYear as number)
          : null,
    }));
  if (cleaned.length < 2) return null;

  const sum = cleaned.reduce((a, s) => a + s.revenue, 0);
  if (sum <= 0) return null;
  const scale = totalRevenue != null && totalRevenue > 0 ? bestScale(sum, totalRevenue) : 1;
  const segments: SegmentLine[] = cleaned
    .map((s) => ({
      name: s.name,
      revenue: s.revenue * scale,
      sharePct: (s.revenue / sum) * 100,
      yoyPct:
        s.prior != null && s.prior !== 0
          ? ((s.revenue - s.prior) / s.prior) * 100
          : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const reconciledPct =
    totalRevenue != null && totalRevenue !== 0
      ? (sum * scale / totalRevenue) * 100
      : null;
  const fiscalLabel =
    typeof r.fiscalLabel === "string" ? r.fiscalLabel.trim() : "";
  const note =
    typeof r.note === "string" ? r.note.trim().slice(0, 200) : "";
  return { fiscalLabel, segments, reconciledPct, note };
}

async function fetchLatest10KDoc(cik: string): Promise<string> {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: UA,
  });
  if (!res.ok) return "";
  const j = (await res.json()) as {
    filings?: {
      recent?: {
        form?: string[];
        accessionNumber?: string[];
        primaryDocument?: string[];
      };
    };
  };
  const r = j.filings?.recent;
  if (!r?.form) return "";
  for (let i = 0; i < r.form.length; i++) {
    if (r.form[i] !== "10-K") continue;
    const acc = (r.accessionNumber?.[i] ?? "").replace(/-/g, "");
    const doc = r.primaryDocument?.[i] ?? "";
    if (!acc || !doc) continue;
    const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}`;
    const d = await fetch(url, { headers: UA });
    return d.ok ? d.text() : "";
  }
  return "";
}

/** Generate the segment breakdown. Soft-fails to null (no key, no segment note, parse fail). */
export async function generateSegmentBreakdown(
  ticker: string,
  companyName: string | null,
  totalRevenue: number | null,
): Promise<SegmentBreakdown | null> {
  try {
    const cik = await resolveCik(ticker.trim().toUpperCase());
    if (!cik) return null;
    const doc = await fetchLatest10KDoc(cik);
    if (!doc) return null;
    const note = extractSegmentNote(doc);
    if (!note) return null;
    const text = await deepseekJson(
      buildSegmentPrompt(companyName ?? ticker, note),
      0.2,
    );
    if (!text) return null;
    return parseSegmentBreakdown(text, totalRevenue);
  } catch (e) {
    console.warn(`[segments] ${ticker} failed`, e);
    return null;
  }
}
