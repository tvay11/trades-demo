import { z } from "zod";

// ── Zod schema ────────────────────────────────────────────────────────────────

export const morningNoteSchema = z.object({
  schemaVersion: z.literal(1),
  headline: z.string().min(8).max(140),
  note: z.string().min(100).max(900),
  watchItems: z.array(z.string().min(10).max(200)).min(2).max(4),
  headlineTags: z
    .array(
      z.object({
        title: z.string().min(4).max(160),
        url: z.string().nullable(),
        sentiment: z.enum(["bullish", "bearish", "neutral"]),
      }),
    )
    .max(6),
});

export type MorningNote = z.infer<typeof morningNoteSchema>;

// ── Input types ───────────────────────────────────────────────────────────────

export interface MorningNoteInputs {
  tape: { label: string; price: number; changePct: number | null }[];
  macroLabel: string | null;
  headlines: { title: string; url: string | null }[];
  anchors: { ticker: string; rating: string | null; changed: "rating" | null }[];
  movers: string[];
}

// ── Parse helper ──────────────────────────────────────────────────────────────

/** Parse and Zod-validate a DeepSeek JSON response into MorningNote. Returns null on failure. */
export function parseMorningNote(text: string): MorningNote | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Extract first {...} object if the model wraps JSON in accidental prose
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch (e) {
    void e;
    return null;
  }

  const result = morningNoteSchema.safeParse(normalizeGeneratedMorningNote(parsed));
  if (!result.success) {
    return null;
  }
  return result.data;
}

function normalizeGeneratedMorningNote(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;

  const note = { ...(value as Record<string, unknown>) };
  if (Array.isArray(note.watchItems) && note.watchItems.length > 4) {
    note.watchItems = note.watchItems.slice(0, 4);
  }

  if (Array.isArray(note.headlineTags) && note.headlineTags.length > 6) {
    note.headlineTags = note.headlineTags.slice(0, 6);
  }

  return note;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

const requiredJsonExample = {
  schemaVersion: 1,
  headline: "Soft CPI lifts equities; tech leads as semis surge on earnings beats",
  note: "Overnight futures rallied on softer-than-expected inflation data, with the S&P 500 gapping up at the open. Tech is the standout sector, led by semiconductor strength after a string of earnings beats. The yield curve steepened modestly, with the 10-year holding near 4.4%. The dollar softened, providing a tailwind for multinational earners. Macro backdrop is risk-on but sentiment indicators are stretched — watch for a consolidation if upcoming Fed speakers push back. Position sizing into longs should respect current VIX levels and bandwidth of recent price action.",
  watchItems: [
    "NVDA earnings call — listen for data-center demand commentary and Q3 guide",
    "10-year yield above 4.5% — would pressure growth multiples and re-rate tech",
    "Dollar index DXY — a break above 106 would signal risk-off rotation",
  ],
  headlineTags: [
    { title: "Fed holds rates steady, signals patience on cuts", url: "https://example.com/1", sentiment: "neutral" },
    { title: "Nvidia crushes Q1 estimates, raises full-year guidance", url: "https://example.com/2", sentiment: "bullish" },
    { title: "China widens tariffs on US semiconductor imports", url: null, sentiment: "bearish" },
  ],
};

/** Build the system + user messages for the morning note generation request. */
export function buildMorningNotePrompt(inputs: MorningNoteInputs): { system: string; user: string } {
  const system = [
    "You are a market analyst writing a concise morning brief for an equity trader.",
    "Return only valid JSON. No markdown, no prose outside JSON.",
    "Use only the input data provided. Do not invent prices, events, tickers, or news not present in the inputs.",
    "Never invent statistics, forecasts, or market moves that are not in the supplied data.",
    "The morning note should be actionable and grounded in the supplied tape, macro, anchors, and headlines.",
  ].join(" ");

  const payload = {
    task: "Generate today's morning note JSON.",
    hardLimits: [
      "watchItems: 2 to 4 strings",
      "headlineTags: 0 to 6 objects",
      "note: 100 to 900 characters",
      "headline: 8 to 140 characters",
    ],
    tape: inputs.tape,
    macroLabel: inputs.macroLabel,
    headlines: inputs.headlines,
    anchors: inputs.anchors,
    movers: inputs.movers,
    requiredJsonExample,
  };

  return { system, user: JSON.stringify(payload) };
}
