import { z } from "zod";

import { deepseekJson } from "@/lib/llm/deepseek";
import { getDailyBars } from "@/lib/yahoo/client";
import type { EdgarPeriod, Ledger, LongTermPlay, LongTermDriver } from "./types";
import type { StockAnalysis } from "@/lib/queries/stockAnalysis";

const MAX_THEMES = 5;
const MAX_BULLETS = 5;
const MIN_DRIVER_POINTS = 20;
const DRIVER_LOOKBACK_DAYS = 365;

const longTermPlaySchema = z.object({
  schemaVersion: z.literal(1),
  horizon: z.string().min(3).max(40),
  summary: z.string().min(30).max(520),
  ifYouBelieve: z.string().min(30).max(520),
  whyItMatters: z.array(z.string().min(3).max(220)).min(1).max(MAX_BULLETS),
  themes: z.array(z.object({
    name: z.string().min(3).max(60),
    score: z.number().min(0).max(1),
    direction: z.enum(["tailwind", "headwind", "mixed"]),
    summary: z.string().min(10).max(260),
    evidence: z.array(z.string().min(1).max(140)).min(1).max(4),
    risk: z.string().min(5).max(240),
  })).min(1).max(MAX_THEMES),
  confirmingSignals: z.array(z.string().min(3).max(120)).min(1).max(MAX_BULLETS),
  breakingSignals: z.array(z.string().min(3).max(120)).min(1).max(MAX_BULLETS),
  dataGaps: z.array(z.string().min(3).max(160)).max(MAX_BULLETS),
  drivers: z.array(z.object({
    label: z.string().min(1).max(40),
    symbol: z.string().max(15),
    why: z.string().max(100),
  })).max(8).optional(),
});

function compactPeriod(period: EdgarPeriod | null) {
  if (!period) return null;
  const r1 = (x: number | null) => (x == null ? null : Number(x.toFixed(1)));
  return {
    fiscalLabel: period.fiscalLabel,
    form: period.form,
    revenueYoYPct: r1(period.revenueYoYPct),
    grossMarginPct: r1(period.grossMarginPct),
    netIncomeYoYPct: r1(period.netIncomeYoYPct),
    dilutedEps: period.dilutedEps,
  };
}

function compactSourceRows(analysis: StockAnalysis | null) {
  if (!analysis) return null;
  const rows = analysis.sourceRows;
  return {
    sector: analysis.detail.stock.sector,
    industry: analysis.detail.stock.industry,
    marketCap: analysis.detail.stock.marketCap,
    alternativeData: analysis.detail.alternativeData.slice(0, 8),
    patents: rows.patents.slice(0, 5).map((row) => ({
      title: row.title,
      patentNumber: row.patentNumber,
      effectiveDate: row.effectiveDate?.toISOString().slice(0, 10) ?? null,
    })),
    govContracts: rows.govContracts.slice(0, 5).map((row) => ({
      agency: row.agency,
      description: row.description,
      amount: row.amount,
      awardedAt: row.awardedAt?.toISOString().slice(0, 10) ?? null,
    })),
    lobbying: rows.lobbying.slice(0, 5).map((row) => ({
      filingPeriod: row.filingPeriod,
      issue: row.issue,
      amount: row.amount,
    })),
    holdings: rows.holdings.slice(0, 5).map((row) => ({
      filer: row.filer,
      value: row.value,
      changeShares: row.changeShares,
      reportDate: row.reportDate.toISOString().slice(0, 10),
    })),
    attention: rows.attention.slice(0, 5).map((row) => ({
      source: row.source,
      count: row.count,
      detail: row.detail,
    })),
  };
}

const requiredJsonExample = {
  schemaVersion: 1,
  horizon: "3-10 years",
  summary: "This stock is a long-term bet on enterprise AI infrastructure, cloud migration, and recurring software demand.",
  ifYouBelieve: "If you believe enterprise AI workloads keep compounding, this company benefits through cloud capacity, software distribution, and customer lock-in.",
  whyItMatters: [
    "The company has multiple ways to monetize the same long-term technology budget.",
    "Recurring revenue and scale can turn a future theme into durable earnings power.",
  ],
  themes: [
    {
      name: "Enterprise AI infrastructure",
      score: 0.82,
      direction: "tailwind",
      summary: "AI workload growth can support demand for the company's cloud and platform assets.",
      evidence: ["sector: Technology", "AI demand growth headline"],
      risk: "High capital intensity may dilute the benefit if revenue conversion lags.",
    },
  ],
  confirmingSignals: ["Segment growth acceleration", "Margin durability", "Positive earnings commentary"],
  breakingSignals: ["Weak demand commentary", "Client churn", "Margin compression"],
  dataGaps: ["Segment-level AI revenue was not available."],
  drivers: [
    { label: "Semiconductors", symbol: "SOXX", why: "Compute demand proxy" },
    { label: "Crude Oil", symbol: "CL=F", why: "Energy/input cost for the sector" },
    { label: "10Y Yield", symbol: "^TNX", why: "Discount rate on long-duration growth" },
    { label: "US Dollar", symbol: "DX-Y.NYB", why: "FX headwind on overseas revenue" },
  ],
};

/** Trim the over-long arrays the model sometimes returns (6+ themes, 5 evidence
 *  bullets, etc.) so strict validation doesn't reject an otherwise-good play.
 *  Mirrors the normalization in deepseekAnalyst.ts / morningNote.ts. */
function normalizeLongTermPlayDraft(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const v = { ...(value as Record<string, unknown>) };
  const cap = (key: string, n: number) => {
    if (Array.isArray(v[key])) v[key] = (v[key] as unknown[]).slice(0, n);
  };
  cap("whyItMatters", MAX_BULLETS);
  cap("confirmingSignals", MAX_BULLETS);
  cap("breakingSignals", MAX_BULLETS);
  cap("dataGaps", MAX_BULLETS);
  cap("drivers", 8);
  if (Array.isArray(v.themes)) {
    v.themes = (v.themes as unknown[]).slice(0, MAX_THEMES).map((t) => {
      if (t === null || typeof t !== "object" || Array.isArray(t)) return t;
      const theme = { ...(t as Record<string, unknown>) };
      if (Array.isArray(theme.evidence)) theme.evidence = (theme.evidence as unknown[]).slice(0, 4);
      return theme;
    });
  }
  return v;
}

export function parseLongTermPlay(text: string): LongTermPlay | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }

  const result = longTermPlaySchema.safeParse(normalizeLongTermPlayDraft(parsed));
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" | ");
    console.warn(`[longTermPlay] schema rejected — ${issues}`);
    return null;
  }
  const { drivers: rawDrivers, ...rest } = result.data;
  const seen = new Set<string>();
  const drivers: LongTermDriver[] = (rawDrivers ?? [])
    .map((d) => ({ label: d.label.trim(), symbol: d.symbol.trim(), why: d.why.trim() }))
    .filter((d) => {
      if (d.symbol.length === 0 || seen.has(d.symbol)) return false;
      seen.add(d.symbol);
      return true;
    })
    .map((d) => ({ ...d, points: [] as LongTermDriver["points"] }));
  return { ...rest, drivers };
}

export function buildLongTermPlayPrompt(ledger: Ledger, analysis: StockAnalysis | null): string {
  const input = {
    task: "Identify the company's long-term financial play and future-theme exposure.",
    guardrails: [
      "Use only the provided report data. Do not invent products, segments, customers, contracts, prices, dates, or financial figures.",
      "Do not tell the user to buy, sell, or hold. Frame this as a thesis fit: if the user believes a future theme, what exposure does this stock provide?",
      "Every theme score must be a number from 0 to 1 where 1 means strongest grounded exposure.",
      "Write each evidence item as a short human-readable phrase (e.g. 'revenue +114.0% YoY', 'sector: Technology', 'AI demand headline'). Do not output raw field names like 'revenueYoYPct'.",
      "Return ONLY JSON. No markdown. No prose outside JSON.",
      "List 6 to 8 macro/commodity/index/ETF series whose price action most drives this company's INDUSTRY economics. For each, give a real, commonly-quoted Yahoo Finance ticker symbol (e.g. NG=F natural gas, CL=F crude, ZC=F corn, HG=F copper, ^TNX 10y yield, DX-Y.NYB dollar, SOXX semis ETF, XLE energy ETF, GLD gold, ^VIX volatility). Use ONLY real Yahoo symbols; if unsure about a symbol, omit that driver.",
      "Pick a MIX of drivers: some that should move WITH the industry (end-demand or key-input proxies) and some that typically move AGAINST it (cost inputs, the 10y yield, or the US dollar), so the correlation read surfaces both positive and negative relationships.",
    ],
    ticker: ledger.ticker,
    companyName: ledger.companyName,
    rating: ledger.houseCall.rating,
    businessProfile: compactSourceRows(analysis),
    fundamentals: ledger.fundamentals
      ? {
          annual: compactPeriod(ledger.fundamentals.annual),
          quarter: compactPeriod(ledger.fundamentals.quarter),
        }
      : null,
    fundamentalsInsight: ledger.fundamentalsInsight,
    geopolitical: ledger.geopolitical,
    signals: ledger.signals,
    news: ledger.news.slice(0, 8).map((item) => ({
      title: item.title,
      summary: item.summary,
      sentiment: item.sentiment,
      score: item.score,
    })),
    requiredJsonExample,
  };

  return [
    "You are an equity research analyst focused on business model durability and long-term thematic exposure.",
    "Identify what future world would make this stock financially interesting, and what evidence supports or weakens that thesis.",
    "Do not provide personalized financial advice. Do not tell the user to buy, sell, or hold.",
    "Return ONLY JSON matching the requiredJsonExample shape.",
    JSON.stringify(input),
  ].join("\n\n");
}

/** Daily simple returns keyed by the (later) date. Input order-tolerant.
 *  Correlating RETURNS (not price levels) avoids spurious correlation from two
 *  series sharing a common trend. */
function returnsByDate(points: { date: string; close: number }[]): Map<string, number> {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const cur = sorted[i].close;
    if (Number.isFinite(prev) && Number.isFinite(cur) && prev !== 0) {
      out.set(sorted[i].date, (cur - prev) / prev);
    }
  }
  return out;
}

/** Pearson correlation of the two series' daily returns over shared dates.
 *  Returns null with <10 overlapping points or zero variance. Pure. */
export function correlateReturns(
  a: { date: string; close: number }[],
  b: { date: string; close: number }[],
): number | null {
  const ra = returnsByDate(a);
  const rb = returnsByDate(b);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [date, x] of ra) {
    const y = rb.get(date);
    if (y != null) { xs.push(x); ys.push(y); }
  }
  if (xs.length < 10) return null;
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

export async function resolveLongTermDrivers(
  drivers: LongTermDriver[],
  fetcher: (symbol: string) => Promise<{ date: Date; close: number }[]>,
): Promise<LongTermDriver[]> {
  const settled = await Promise.all(
    drivers.map(async (d) => {
      let rows: { date: Date; close: number }[] = [];
      try { rows = await fetcher(d.symbol); } catch { rows = []; }
      const points = rows
        .filter((r) => r.close != null && Number.isFinite(r.close))
        .map((r) => ({ date: r.date.toISOString().slice(0, 10), close: r.close }));
      return points.length >= MIN_DRIVER_POINTS ? { ...d, points } : null;
    }),
  );
  return settled.filter((x): x is LongTermDriver => x !== null);
}

export async function generateLongTermPlay(
  ledger: Ledger,
  analysis: StockAnalysis | null,
): Promise<LongTermPlay | null> {
  try {
    const text = await deepseekJson(buildLongTermPlayPrompt(ledger, analysis), 0.25);
    if (!text) return null;
    const parsed = parseLongTermPlay(text);
    if (!parsed) {
      console.warn(`[longTermPlay] ${ledger.ticker}: invalid JSON shape`);
      return null;
    }
    if (parsed.drivers.length === 0) return parsed;
    const to = new Date();
    const from = new Date(to.getTime() - DRIVER_LOOKBACK_DAYS * 86_400_000);
    const resolved = await resolveLongTermDrivers(parsed.drivers, (s) =>
      getDailyBars(s, from, to).then((bars) => bars.map((b) => ({ date: b.date, close: b.close }))),
    );
    const stock = ledger.bars.map((b) => ({ date: b.date, close: b.close }));
    const drivers = resolved.map((d) => ({ ...d, corr: correlateReturns(stock, d.points) }));
    return { ...parsed, drivers };
  } catch (error) {
    console.error(`[longTermPlay] ${ledger.ticker} failed`, error);
    return null;
  }
}
