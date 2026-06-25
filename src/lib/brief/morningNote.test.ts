// @vitest-environment node
import { describe, expect, it } from "vitest";
import { morningNoteSchema, parseMorningNote, buildMorningNotePrompt } from "./morningNote";
import type { MorningNoteInputs } from "./morningNote";

const validNote = {
  schemaVersion: 1 as const,
  headline: "Markets open risk-on as Fed signals patience",
  note: "Equities rallied overnight on softer-than-expected inflation data. The S&P 500 futures point to a gap up at the open. Tech leads the advance with semiconductors surging on earnings beats. Bonds sold off modestly as the curve steepened. Watch for any Fed commentary this week as the key catalyst. Positioning is broadly constructive but sentiment indicators are stretched.",
  watchItems: [
    "NVDA earnings call — listen for data-center demand tone",
    "CPI revision risk — any upward revision would rattle rate expectations",
    "Dollar index DXY holding above 104 — risk-off trigger if it breaks",
  ],
  headlineTags: [
    { title: "Fed holds rates, signals patience on cuts", url: "https://example.com/1", sentiment: "neutral" as const },
    { title: "Nvidia smashes Q1 estimates, raises guidance", url: "https://example.com/2", sentiment: "bullish" as const },
    { title: "China tariffs widened on semiconductor imports", url: null, sentiment: "bearish" as const },
  ],
};

const inputs: MorningNoteInputs = {
  tape: [
    { label: "S&P 500", price: 5990.12, changePct: 0.42 },
    { label: "VIX", price: 16.8, changePct: -3.2 },
  ],
  macroLabel: "risk-on",
  headlines: [
    { title: "Fed holds rates", url: "https://example.com/1" },
    { title: "NVDA earnings beat", url: "https://example.com/2" },
  ],
  anchors: [
    { ticker: "NVDA", rating: "BUY", changed: "rating" },
    { ticker: "AAPL", rating: "HOLD", changed: null },
  ],
  movers: ["NVDA WSB ×4.1", "XYZ dark short +8pp", "LMT $12M gov contract"],
};

describe("morningNoteSchema", () => {
  it("accepts a valid morning note", () => {
    const result = morningNoteSchema.safeParse(validNote);
    expect(result.success).toBe(true);
  });

  it("rejects a note that is too short", () => {
    const bad = { ...validNote, note: "Too short" };
    const result = morningNoteSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a headline that is too short", () => {
    const bad = { ...validNote, headline: "Short" };
    const result = morningNoteSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects watchItems with fewer than 2 entries", () => {
    const bad = { ...validNote, watchItems: ["Only one item that is long enough to pass length check"] };
    const result = morningNoteSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("parseMorningNote", () => {
  it("parses a valid JSON string directly", () => {
    const result = parseMorningNote(JSON.stringify(validNote));
    expect(result).not.toBeNull();
    expect(result?.headline).toBe(validNote.headline);
    expect(result?.watchItems).toHaveLength(3);
  });

  it("extracts JSON from prose-wrapped text", () => {
    const prose = `Here is the morning note for today:\n${JSON.stringify(validNote)}\nEnd of note.`;
    const result = parseMorningNote(prose);
    expect(result).not.toBeNull();
    expect(result?.schemaVersion).toBe(1);
  });

  it("returns null for empty string", () => {
    expect(parseMorningNote("")).toBeNull();
  });

  it("returns null for invalid JSON shape (missing required fields)", () => {
    const invalid = JSON.stringify({ schemaVersion: 1, headline: "Test headline ok" });
    expect(parseMorningNote(invalid)).toBeNull();
  });

  it("trims extra watch items from otherwise valid model output", () => {
    const watchItems = [
      ...validNote.watchItems,
      "Extra yield-watch item that should not make the dashboard fail",
      "Extra geopolitical item that should not make the dashboard fail",
    ];
    const result = parseMorningNote(JSON.stringify({
      ...validNote,
      watchItems,
    }));

    expect(result).not.toBeNull();
    expect(result?.watchItems).toEqual(watchItems.slice(0, 4));
  });

  it("trims extra headline tags from otherwise valid model output", () => {
    const result = parseMorningNote(JSON.stringify({
      ...validNote,
      headlineTags: [
        ...validNote.headlineTags,
        { title: "Extra market headline one", url: null, sentiment: "neutral" },
        { title: "Extra market headline two", url: null, sentiment: "bullish" },
        { title: "Extra market headline three", url: null, sentiment: "bearish" },
        { title: "Extra market headline four", url: null, sentiment: "neutral" },
      ],
    }));

    expect(result).not.toBeNull();
    expect(result?.headlineTags).toHaveLength(6);
  });
});

describe("buildMorningNotePrompt", () => {
  it("embeds anchor ticker in the user message", () => {
    const { user } = buildMorningNotePrompt(inputs);
    expect(user).toContain("NVDA");
  });

  it("includes a requiredJsonExample in the user message", () => {
    const { user } = buildMorningNotePrompt(inputs);
    expect(user).toContain("requiredJsonExample");
  });

  it("system message forbids invention and demands JSON only", () => {
    const { system } = buildMorningNotePrompt(inputs);
    expect(system.toLowerCase()).toMatch(/json/);
    expect(system.toLowerCase()).toMatch(/do not invent|never invent/);
  });

  it("user message contains macro label", () => {
    const { user } = buildMorningNotePrompt(inputs);
    expect(user).toContain("risk-on");
  });

  it("states the array limits in the prompt payload", () => {
    const { user } = buildMorningNotePrompt(inputs);
    expect(user).toContain("watchItems: 2 to 4");
    expect(user).toContain("headlineTags: 0 to 6");
  });
});
