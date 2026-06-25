import { getMarketTape } from "@/lib/queries/marketTape";
import { getMacroRegime } from "@/lib/queries/macroRegime";
import { getMorningBriefTickers } from "@/lib/queries/morningBrief";
import { getAltFlowMovers } from "@/lib/queries/altFlowMovers";
import { buildMorningNotePrompt, parseMorningNote } from "./morningNote";
import { getStoredMorningNote, saveMorningNote } from "./morningNoteStore";
import type { MorningNote, MorningNoteInputs } from "./morningNote";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

// ── Cooldown: prevent hammering the paid pipeline on every page load during an outage ──
let lastFailedAttemptAt = 0;
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function recordFailure(reason: string): void {
  lastFailedAttemptAt = Date.now();
  console.warn(`[morningNote] generation failed; cooldown=${formatDuration(RETRY_COOLDOWN_MS)} reason=${reason}`);
}

function clearFailure(): void {
  lastFailedAttemptAt = 0;
}

// ── Tavily headlines ──────────────────────────────────────────────────────────

interface MarketHeadline {
  title: string;
  url: string | null;
}

export async function fetchMarketHeadlines(): Promise<MarketHeadline[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        api_key: key,
        query: "stock market today top news",
        topic: "news",
        search_depth: "basic",
        max_results: 6,
        days: 2,
      }),
    });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { results?: unknown[] };
    const results = Array.isArray(json.results) ? json.results : [];
    return results
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
      .filter((r) => typeof r.title === "string" && r.title.trim() !== "")
      .map((r) => ({
        title: r.title as string,
        url: typeof r.url === "string" ? r.url : null,
      }))
      .slice(0, 6);
  } catch (e) {
    void e;
    return [];
  }
}

// ── Input assembly ────────────────────────────────────────────────────────────

export async function assembleInputs(): Promise<MorningNoteInputs> {
  const [tape, macro, briefRows, altFlow, headlines] = await Promise.all([
    getMarketTape().catch(() => []),
    getMacroRegime().catch(() => null),
    getMorningBriefTickers().catch(() => []),
    getAltFlowMovers().catch(() => ({ wsbSurges: [], darkShortSpikes: [], govContracts: [] })),
    fetchMarketHeadlines(),
  ]);

  const anchors = briefRows.map((r) => ({
    ticker: r.ticker,
    rating: r.signals?.rating ?? null,
    changed: r.changed,
  }));

  // Build mover description strings from each alt-flow block
  const movers: string[] = [
    ...altFlow.wsbSurges.map((s) => `${s.ticker} WSB ×${s.surgeRatio}`),
    ...altFlow.darkShortSpikes.map((s) => `${s.ticker} dark short +${s.excessPp.toFixed(1)}pp`),
    ...altFlow.govContracts.map((s) => {
      const usd = s.amountUsd >= 1_000_000
        ? `$${(s.amountUsd / 1_000_000).toFixed(1)}M`
        : `$${Math.round(s.amountUsd / 1_000)}K`;
      return `${s.ticker} ${usd} gov contract`;
    }),
  ];

  const inputs = {
    tape: tape.map((c) => ({ label: c.label, price: c.price, changePct: c.changePct })),
    macroLabel: macro?.label ?? null,
    headlines,
    anchors,
    movers,
  };

  return inputs;
}

// ── DeepSeek call ─────────────────────────────────────────────────────────────

async function callDeepSeekForNote(
  key: string,
  messages: { system: string; user: string },
  _attemptLabel: string,
): Promise<string | null> {
  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.3,
      max_tokens: 1600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(`[morningNote] DeepSeek HTTP ${res.status} ${res.statusText}: ${body.slice(0, 400)}`);
    return null;
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = (data.choices?.[0]?.message?.content ?? "").trim();
  return content || null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MorningNoteResult {
  note: MorningNote;
  generatedAt: string;
  fresh: boolean;
}

/**
 * Return today's morning note from cache if available; otherwise generate, save, and return.
 * Returns null when DEEPSEEK_API_KEY is absent or generation fails.
 * This call runs once per day — acceptable latency for a cached daily note.
 */
export async function getOrGenerateMorningNote(): Promise<MorningNoteResult | null> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  if (isDemo) {
    return {
      note: {
        schemaVersion: 1,
        headline: "Congress Tech Flow Surges Amid Semis Demand",
        note: "Congressional disclosures reveal significant buying pressure in semiconductor and defense sectors over the past 48 hours. Notable trades include several Armed Services committee members initiating positions in leading chipmakers, pointing to strategic alignments with recent federal policy updates. Momentum is building around technology and energy infrastructure.",
        watchItems: [
          "Nancy Pelosi's NVDA option exercises suggest continued confidence in technology sector leadership.",
          "Bipartisan buys in major energy sector companies point to legislative focus shifting to local grids.",
          "Executive agency overlaps detected in recent cybersecurity software contracts."
        ],
        headlineTags: [
          {
            title: "Fed hints at stable rate outlook, tech indexes rally",
            url: null,
            sentiment: "neutral"
          },
          {
            title: "House introduces bill boosting local energy grid security",
            url: null,
            sentiment: "bullish"
          }
        ]
      },
      generatedAt: new Date().toISOString(),
      fresh: true
    };
  }

  const today = new Date().toLocaleDateString("en-CA");

  // Return cached note if available
  const stored = await getStoredMorningNote(today);
  if (stored) {
    return { note: stored.note, generatedAt: stored.generatedAt, fresh: false };
  }

  // Skip the paid pipeline if a recent attempt already failed (outage guard)
  const sinceFailure = Date.now() - lastFailedAttemptAt;
  if (lastFailedAttemptAt > 0 && sinceFailure < RETRY_COOLDOWN_MS) {
    return null;
  }

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return null;
  }

  return _generate(today, key, /* bypassCooldown */ false);
}

/**
 * Regenerate today's morning note unconditionally (skips the cache check).
 * Used by the server action behind the Regenerate button.
 */
export async function regenerateMorningNote(): Promise<MorningNoteResult | null> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  if (isDemo) {
    return getOrGenerateMorningNote();
  }

  const today = new Date().toLocaleDateString("en-CA");
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return null;
  }
  // User-initiated: bypass cooldown check but still update timestamp on failure/success
  return _generate(today, key, /* bypassCooldown */ true);
}

async function _generate(today: string, key: string, bypassCooldown: boolean): Promise<MorningNoteResult | null> {
  void bypassCooldown; // cooldown check is handled by the caller; flag kept for documentation clarity
  try {
    const inputs = await assembleInputs();
    const messages = buildMorningNotePrompt(inputs);

    // Attempt 1
    const text1 = await callDeepSeekForNote(key, messages, "attempt 1");
    if (text1) {
      const note = parseMorningNote(text1);
      if (note) {
        await saveMorningNote(today, note);
        const generatedAt = new Date().toISOString();
        clearFailure();
        return { note, generatedAt, fresh: true };
      }
      // Retry once on parse failure
      const text2 = await callDeepSeekForNote(key, messages, "attempt 2");
      if (text2) {
        const note2 = parseMorningNote(text2);
        if (note2) {
          await saveMorningNote(today, note2);
          const generatedAt = new Date().toISOString();
          clearFailure();
          return { note: note2, generatedAt, fresh: true };
        }
        recordFailure("DeepSeek returned invalid JSON shape after retry");
        return null;
      }
    }
    recordFailure("no valid response from DeepSeek");
    return null;
  } catch (error) {
    console.warn("[morningNote] generation threw:", error);
    recordFailure(error instanceof Error ? `exception: ${error.message}` : "unknown exception");
    return null;
  }
}
