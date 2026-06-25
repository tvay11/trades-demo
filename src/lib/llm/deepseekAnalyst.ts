import { z } from "zod";
import type {
  AltFlow, AnalystAnalysis, AnalystConviction, AnalystLensRead,
  EdgarPeriod, ForensicsReport, GeoImpact, Ledger, OptionsSignal, Rating,
  SegmentBreakdown, ShortInterest, StreetMomentum, Valuation,
  AnalystConsensus,
} from "@/lib/ledger/types";

const ENDPOINT = "https://api.deepseek.com/chat/completions";

// ── Zod schema ─────────────────────────────────────────────────────────────

const analystAnalysisSchema = z.object({
  schemaVersion: z.literal(1),
  bottomLine: z.string().min(20).max(240),
  headline: z.string().min(8).max(140),
  thesis: z.string().min(40).max(500),
  lensReads: z.array(z.object({
    lens: z.enum(["technicals", "fundamentals", "valuation", "positioning", "flows", "news"]),
    posture: z.enum(["bullish", "bearish", "neutral", "mixed", "unavailable"]),
    summary: z.string().min(10).max(300),
    evidence: z.array(z.string().min(1).max(160)).max(4),
  })).min(4).max(6),
  takeaways: z.array(z.object({
    kind: z.enum(["support", "risk", "watch"]),
    label: z.string().min(3).max(40),
    text: z.string().min(10).max(240),
  })).min(2).max(4),
  keyTension: z.string().min(20).max(300),
  whatWouldChange: z.string().min(20).max(300),
});

// ── Pure helpers ───────────────────────────────────────────────────────────

/** Trim the over-long arrays the model occasionally returns (e.g. 5+ evidence
 *  bullets, a 7th lens, a 5th takeaway) so strict validation doesn't reject
 *  an otherwise-good analysis. Mirrors the normalization in morningNote.ts. */
function normalizeAnalystAnalysis(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const v = { ...(value as Record<string, unknown>) };
  if (Array.isArray(v.lensReads)) {
    v.lensReads = v.lensReads.slice(0, 6).map((lr) => {
      if (lr === null || typeof lr !== "object" || Array.isArray(lr)) return lr;
      const read = { ...(lr as Record<string, unknown>) };
      if (Array.isArray(read.evidence)) read.evidence = read.evidence.slice(0, 4);
      return read;
    });
  }
  if (Array.isArray(v.takeaways)) v.takeaways = v.takeaways.slice(0, 4);
  return v;
}

/** Conviction for the verdict: how strongly the lens reads line up behind the
 *  deterministic rating. Not the model's opinion — derived from lens postures. */
export function deriveConviction(action: Rating, lensReads: AnalystLensRead[]): AnalystConviction {
  const bullish = lensReads.filter((l) => l.posture === "bullish").length;
  const bearish = lensReads.filter((l) => l.posture === "bearish").length;
  if (action === "HOLD") {
    // HOLD: low when lenses are genuinely split, medium when they converge (high is unreachable by design).
    return Math.min(bullish, bearish) >= 2 ? "low" : "medium";
  }
  const agree = action === "BUY" ? bullish : bearish;
  const disagree = action === "BUY" ? bearish : bullish;
  if (agree >= 4 && disagree <= 1) return "high";
  if (agree <= 2 || disagree >= 3) return "low";
  return "medium";
}

/** Parse + Zod-validate a DeepSeek JSON response into AnalystAnalysis, attaching a
 *  verdict whose action mirrors the deterministic rating. Returns null on failure. */
export function parseAnalystAnalysis(text: string, rating: Rating): AnalystAnalysis | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch (e) {
    console.warn(`[deepseek] analyst analysis: JSON.parse failed (response likely truncated): ${(e as Error).message}`);
    return null;
  }

  const result = analystAnalysisSchema.safeParse(normalizeAnalystAnalysis(parsed));
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" | ");
    console.warn(`[deepseek] analyst analysis: schema rejected — ${issues}`);
    return null;
  }

  const d = result.data;
  return {
    schemaVersion: 1,
    verdict: {
      action: rating,
      conviction: deriveConviction(rating, d.lensReads),
      bottomLine: d.bottomLine,
    },
    headline: d.headline,
    thesis: d.thesis,
    lensReads: d.lensReads,
    takeaways: d.takeaways,
    keyTension: d.keyTension,
    whatWouldChange: d.whatWouldChange,
  };
}

/** Convert a structured AnalystAnalysis back to a flat legacy note string. */
export function analystAnalysisToLegacyNote(analysis: AnalystAnalysis): string {
  const parts: string[] = [];
  if (analysis.verdict) {
    parts.push(`${analysis.verdict.action} — ${analysis.verdict.conviction} conviction. ${analysis.verdict.bottomLine}`);
  }
  parts.push(analysis.thesis);

  const lensLines = analysis.lensReads.map(
    (lr) => `${lr.lens.toUpperCase()} (${lr.posture}): ${lr.summary}`,
  );
  if (lensLines.length > 0) parts.push(lensLines.join(" "));

  if (analysis.takeaways.length > 0) {
    parts.push(analysis.takeaways.map((t) => `${t.label}: ${t.text}`).join(" "));
  }

  parts.push(`Key tension: ${analysis.keyTension}`);
  parts.push(`What would change: ${analysis.whatWouldChange}`);

  return parts.join("\n\n");
}

// ── Compact input snapshot helpers ────────────────────────────────────────

const r1 = (x: number | null | undefined): number | null => (x == null ? null : Number(x.toFixed(1)));

function compactEdgarPeriod(period: EdgarPeriod | null) {
  if (!period) return null;
  return {
    fiscalLabel: period.fiscalLabel,
    revenueYoYPct: r1(period.revenueYoYPct),
    grossMarginPct: r1(period.grossMarginPct),
    netIncomeYoYPct: r1(period.netIncomeYoYPct),
    dilutedEps: period.dilutedEps,
  };
}

function compactValuation(v: Valuation | null) {
  if (!v) return null;
  return { read: v.read, peTrailing: r1(v.peTrailing), peForward: r1(v.peForward), pegRatio: r1(v.pegRatio), evToEbitda: r1(v.evToEbitda), priceToSales: r1(v.priceToSales) };
}

function compactAnalyst(a: AnalystConsensus | null) {
  if (!a) return null;
  return { recommendation: a.recommendationKey, upsidePct: r1(a.upsidePct), targetMean: a.targetMean, numAnalysts: a.numAnalysts, counts: a.counts };
}

function compactOptions(o: OptionsSignal | null) {
  if (!o) return null;
  return { lean: o.lean, putCallVolume: r1(o.putCallVolume), atmIvPct: r1(o.atmIvPct), expectedMovePct: r1(o.expectedMovePct), expectedMove60dPct: r1(o.expectedMove60dPct), ivRankPct: r1(o.ivRankPct) };
}

function compactShortInterest(s: ShortInterest | null) {
  if (!s) return null;
  return { percentOfFloat: r1(s.percentOfFloat), daysToCover: r1(s.daysToCover), changePct: r1(s.changePct) };
}

function compactStreetMomentum(m: StreetMomentum | null) {
  if (!m) return null;
  return { read: m.read, upgrades30: m.upgrades30, downgrades30: m.downgrades30, avgSurprisePct: r1(m.avgSurprisePct), beatCount: m.beatCount, peadActive: m.pead.active };
}

function compactAltFlow(f: AltFlow | null) {
  if (!f) return null;
  return {
    darkShortExcessPp: f.darkShort ? r1(f.darkShort.excessPp) : null,
    thirteenFNetShares: f.thirteenF ? f.thirteenF.netChangeShares : null,
    govContracts180dUsd: f.govContracts ? f.govContracts.totalUsd180d : null,
    wsbSurgeRatio: f.wsb ? r1(f.wsb.surgeRatio) : null,
    wsbCrowded: f.wsb ? f.wsb.crowded : null,
  };
}

function compactForensics(f: ForensicsReport | null) {
  if (!f) return null;
  return { overall: f.overall, patterns: f.patterns.map((p) => `${p.label}: ${p.verdict} (${p.metric})`) };
}

function compactSegments(s: SegmentBreakdown | null) {
  if (!s) return null;
  return { fiscalLabel: s.fiscalLabel, top: s.segments.slice(0, 4).map((x) => ({ name: x.name, sharePct: r1(x.sharePct), yoyPct: r1(x.yoyPct) })) };
}

function compactGeo(g: GeoImpact | null) {
  if (!g) return null;
  return { netLean: g.netLean, summary: g.summary, factors: g.factors.slice(0, 3).map((x) => `${x.event} (${x.impact})`) };
}

const requiredJsonExample = {
  schemaVersion: 1,
  bottomLine: "Net-net a BUY: growth, margins and momentum outweigh a rich multiple and policy risk.",
  headline: "AI demand supports the call, but a rich multiple keeps the setup from being clean",
  thesis: "The BUY call is supported by strong fundamentals and favorable momentum, while a premium valuation and export-risk headlines keep risk elevated.",
  lensReads: [
    { lens: "technicals", posture: "bullish", summary: "Trend and momentum readings support the rating.", evidence: ["Long-term trend bullish", "MACD histogram bullish"] },
    { lens: "fundamentals", posture: "bullish", summary: "Growth, margins, and clean cash conversion support quality.", evidence: ["revenue +114.0% YoY", "operating margin 62.0%", "FCF/NI 0.95 over 3y clean"] },
    { lens: "valuation", posture: "bearish", summary: "Multiples are stretched even against the growth rate.", evidence: ["forward P/E 38.0 rich", "EV/EBITDA 28.4", "analyst upside +6.0%"] },
    { lens: "positioning", posture: "neutral", summary: "Options and revisions are constructive but not extreme.", evidence: ["put/call 0.8", "ATM IV 42% expected move +/-7.5%", "EPS revisions improving"] },
    { lens: "flows", posture: "neutral", summary: "Smart-money and political flow is present but not decisive on its own.", evidence: ["congress net buying", "13F net adds", "dark-pool short +6pp"] },
    { lens: "news", posture: "mixed", summary: "News contains both earnings strength and policy risk.", evidence: ["NVDA crushes estimates again", "Export curbs loom large", "geopolitical headwind"] },
  ],
  takeaways: [
    { kind: "support", label: "Main support", text: "Fundamentals and momentum align with the BUY rating." },
    { kind: "risk", label: "Main risk", text: "A premium valuation leaves little margin for error." },
    { kind: "watch", label: "Watch item", text: "An escalation in policy risk would weaken the setup." },
  ],
  keyTension: "The setup is directionally positive, but the valuation leaves little room for error.",
  whatWouldChange: "Multiple compression with stable fundamentals, or a momentum breakdown, would move the picture toward HOLD.",
};

// ── Message builder ────────────────────────────────────────────────────────

/** Build the system + user messages for the structured analyst analysis request. */
export function buildAnalystAnalysisMessages(ledger: Ledger): { system: string; user: string } {
  const system = [
    "You are an equity research analyst writing a structured JSON analysis for a stock report.",
    "Return only valid JSON. No markdown, no prose outside JSON.",
    "Use only the input data. Do not invent prices, dates, facts, model settings, filings, or news.",
    "Do not contradict the report rating. If evidence is mixed, explain the tension.",
    "Produce exactly six lensReads, one per lens, in this order: technicals, fundamentals, valuation, positioning, flows, news.",
    "technicals = scorecard and trendGrid; fundamentals = financials, margins, forensics quality-of-earnings, and segment mix; valuation = multiples plus analyst consensus target and upside; positioning = options lean/IV/expected-move, short interest, and estimate-revision/earnings-surprise momentum; flows = congress/insider/13F/dark-pool/gov-contract/WSB activity; news = headlines, geopolitical lean, and 10-K risk shifts.",
    "If a lens has no usable input data, still include it with posture \"unavailable\" and an empty evidence array.",
    "Write a 'bottomLine': one decisive sentence stating what the report rating means and why, consistent with that rating. Do not output an 'action', 'conviction', 'rating', or 'verdict' field — the system sets those.",
    "Write each evidence item as a short human-readable phrase (e.g. 'FY revenue -2.9% YoY', 'EV/EBITDA 18.4 rich', 'put/call 1.6 bearish', 'FCF/NI 0.62 over 3y'). Do not output raw field names like 'revenueYoYPct'.",
  ].join(" ");

  const latestTrend = ledger.fundamentals?.earnings?.trend.at(-1) ?? null;

  const input = {
    task: "Create structured report analysis JSON with six lenses and a decisive bottom line.",
    ticker: ledger.ticker,
    companyName: ledger.companyName,
    rating: ledger.houseCall.rating,
    lastClose: ledger.lastClose,
    scorecard: ledger.scorecard,
    trendGrid: ledger.trendGrid,
    fundamentals: {
      annual: compactEdgarPeriod(ledger.fundamentals?.annual ?? null),
      quarter: compactEdgarPeriod(ledger.fundamentals?.quarter ?? null),
      margins: latestTrend
        ? { operatingMarginPct: r1(latestTrend.operatingMarginPct), netMarginPct: r1(latestTrend.netMarginPct), fcfMarginPct: r1(latestTrend.fcfMarginPct) }
        : null,
      forensics: compactForensics(ledger.forensics),
      segments: compactSegments(ledger.segments),
      insight: ledger.fundamentalsInsight
        ? { interpretation: ledger.fundamentalsInsight.interpretation, riskFactors: ledger.fundamentalsInsight.riskFactors.slice(0, 3) }
        : null,
    },
    valuation: compactValuation(ledger.valuation),
    analystConsensus: compactAnalyst(ledger.analyst),
    positioning: {
      options: compactOptions(ledger.options),
      shortInterest: compactShortInterest(ledger.shortInterest),
      streetMomentum: compactStreetMomentum(ledger.streetMomentum),
    },
    flows: ledger.signals || ledger.altFlow
      ? {
          congressNetFlowLabel: ledger.signals?.congressNetFlowLabel ?? null,
          congressTrades: ledger.signals?.congressTradeCount ?? null,
          insiderTrades: ledger.signals?.insiderTradeCount ?? null,
          thirteenF: ledger.signals?.thirteenFCount ?? null,
          govContracts: ledger.signals?.govContractCount ?? null,
          altFlow: compactAltFlow(ledger.altFlow),
        }
      : null,
    news: {
      skew: Number(ledger.newsSkew.toFixed(3)),
      bullish: ledger.news.filter((n) => n.sentiment === "bullish").slice(0, 4).map((n) => n.title),
      bearish: ledger.news.filter((n) => n.sentiment === "bearish").slice(0, 4).map((n) => n.title),
      neutral: ledger.news.filter((n) => n.sentiment === "neutral").slice(0, 3).map((n) => n.title),
      geopolitical: compactGeo(ledger.geopolitical),
      riskShift: ledger.riskShift
        ? { shiftSummary: ledger.riskShift.shiftSummary, newRisks: ledger.riskShift.newRisks.slice(0, 3) }
        : null,
    },
    macro: ledger.macro ? { label: ledger.macro.label, note: ledger.macro.note } : null,
    requiredJsonExample,
  };

  return { system, user: JSON.stringify(input) };
}

// ── Network call ───────────────────────────────────────────────────────────

/** Single DeepSeek call; returns raw content string or null on HTTP/network error. Never throws. */
async function callDeepSeek(key: string, messages: { system: string; user: string }): Promise<string | null> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.2,
      max_tokens: 3600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[deepseek] analyst analysis HTTP ${res.status} ${res.statusText}: ${body.slice(0, 400)}`);
    return null;
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? "").trim() || null;
}

/** Call DeepSeek with JSON mode to generate a structured analyst analysis. Never throws. */
export async function generateAnalystAnalysis(ledger: Ledger): Promise<AnalystAnalysis | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.warn("[deepseek] DEEPSEEK_API_KEY not set — analyst analysis skipped");
    return null;
  }

  const messages = buildAnalystAnalysisMessages(ledger);

  try {
    const text1 = await callDeepSeek(key, messages);
    if (text1) {
      const analysis = parseAnalystAnalysis(text1, ledger.houseCall.rating);
      if (analysis) {
        console.log(`[deepseek] analyst analysis: generated headline="${analysis.headline}"`);
        return analysis;
      }
      // First attempt failed validation — retry once
      const text2 = await callDeepSeek(key, messages);
      if (text2) {
        const analysis2 = parseAnalystAnalysis(text2, ledger.houseCall.rating);
        if (analysis2) {
          console.log(`[deepseek] analyst analysis: generated headline="${analysis2.headline}" (retry)`);
          return analysis2;
        }
        console.warn(`[deepseek] analyst analysis: invalid JSON shape after retry — ${text2.slice(0, 300)}`);
      }
    }
    return null;
  } catch (error) {
    console.error("[deepseek] analyst analysis failed", error);
    return null;
  }
}
