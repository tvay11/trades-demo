import { applyCacheLife } from "@/lib/cache";
import { deepseekJson } from "@/lib/llm/deepseek";
import type { ScreenerIdea } from "./score";

type RationaleInput = Pick<
  ScreenerIdea,
  "ticker" | "companyName" | "tradeCount90" | "tradeCount14" | "accel" | "tags"
>;

/** Pure: build the prompt asking DeepSeek for a ≤12-word "why look" per ticker.
 *  Returns a string that, when sent to DeepSeek JSON mode, yields { "<TICKER>": "<one-liner>" }. */
export function buildRationalePrompt(ideas: RationaleInput[]): string {
  const rows = ideas
    .map(
      (r) =>
        `${r.ticker} (${r.companyName ?? "unknown"}): 90d=${r.tradeCount90} 14d=${r.tradeCount14} accel=${r.accel} ` +
        `tags=[${r.tags.join(",")}]`,
    )
    .join("\n");

  return (
    `You are a buy-side analyst assistant. For each ticker below, write a plain-English "why look at this" reason of ≤12 words.\n` +
    `Focus on the most distinctive signal: smart-money activity acceleration or volume.\n` +
    `Return a single JSON object mapping each TICKER (uppercase key) to its one-liner string.\n` +
    `Example: {"AAPL": "Heavy congressional buying with rising 14-day acceleration."}\n\n` +
    rows
  );
}

/** Parse a JSON object from DeepSeek response (fence-tolerant). Returns {} on failure. */
function parseRationaleJson(text: string): Record<string, string> {
  // Strip markdown fences if present
  const stripped = text.replace(/^```[^\n]*\n?/m, "").replace(/\n?```$/m, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string") {
        result[k] = v;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Fetch one-line "why look" rationales for the given screener ideas.
 *  Makes ONE batched DeepSeek JSON call. Returns {} on no key / failure — never throws. */
export async function getScreenerRationales(
  ideas: RationaleInput[],
): Promise<Record<string, string>> {
  "use cache";
  applyCacheLife("hours");

  if (ideas.length === 0) return {};
  const prompt = buildRationalePrompt(ideas);
  try {
    const text = await deepseekJson(prompt, 0.3);
    if (!text) return {};
    return parseRationaleJson(text);
  } catch {
    return {};
  }
}
