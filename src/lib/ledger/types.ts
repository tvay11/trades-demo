import type { BarPoint } from "@/components/charts/TickerPriceChart";
import type { ForecastPoint } from "@/lib/queries/priceForecast";

export type Signal = "BULL" | "BEAR" | "NEUTRAL";
export type Rating = "BUY" | "SELL" | "HOLD";
export type NewsSentiment = "bullish" | "bearish" | "neutral";
export type NewsRelevance = "direct" | "sector" | "macro" | "unrelated";
export type NewsEventType =
  | "earnings_guidance"
  | "ma_strategic"
  | "regulatory_legal"
  | "analyst_action"
  | "product_demand"
  | "insider_institutional"
  | "commentary_listicle"
  | "routine_filing";
export type NewsSurprise = "new_material" | "incremental" | "recycled_known";
export type Confidence = "NARROW" | "MODERATE" | "WIDE";

export interface ScorecardRow {
  label: string;
  value: string;
  signal: Signal;
}

export interface TrendLens {
  label: string;
  verdict: string;
  signal: Signal;
}

export interface HouseCallContribution {
  label: string;
  value: number;
}

export interface HouseCall {
  rating: Rating;
  drivers: string[];
  watchTrigger: string;
  synthesis: string;
  score: number;
  contributions: HouseCallContribution[];
}

export interface NewsItem {
  title: string;
  publisher: string | null;
  url: string | null;
  publishedAt: string | null;
  summary: string | null;
  sentiment: NewsSentiment;
  score: number;
  relevance?: NewsRelevance;
  eventType?: NewsEventType;
  surprise?: NewsSurprise;
}

export interface EdgarPeriod {
  fiscalLabel: string;        // "FY2026" or "Q1 FY2027"
  periodEnd: string | null;   // ISO end date
  form: string;               // "10-K" | "10-Q"
  revenue: number | null;
  revenueYoYPct: number | null;
  grossMarginPct: number | null;
  netIncome: number | null;
  netIncomeYoYPct: number | null;
  dilutedEps: number | null;
  operatingIncome?: number | null;
  rdExpense?: number | null;
  sgaExpense?: number | null;
}

export interface EdgarFundamentals {
  annual: EdgarPeriod | null;   // latest 10-K full year
  quarter: EdgarPeriod | null;  // latest 10-Q quarter
  forensicsSeries?: ForensicsYear[]; // trailing annual series, oldest→newest
  earnings?: EarningsBreakdown;          // annual income-statement waterfall
  quarterlyEarnings?: EarningsBreakdown; // latest-quarter income-statement waterfall
}

/** One line of the income-statement waterfall. value is the reported magnitude
 * (deductions like COGS/CapEx are stored positive; the UI shows the "−"). */
export interface EarningsLine {
  key: string;
  label: string;
  value: number | null;       // USD, or shares for "shares", or EPS for "eps"
  marginPct: number | null;   // % of revenue, where meaningful (else null)
  yoyPct: number | null;      // vs prior fiscal year (else null)
  kind: "total" | "deduction" | "subtotal" | "pershare" | "cashflow";
}

export interface EarningsTrendPoint {
  fiscalLabel: string;
  revenue: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  fcfMarginPct: number | null;
}

export interface EarningsBreakdown {
  fiscalLabel: string;   // "FY2025"
  periodEnd: string;     // ISO end date
  form: string;          // "10-K"
  lines: EarningsLine[];
  trend: EarningsTrendPoint[]; // oldest→newest, up to 3 fiscal years
}

export interface SegmentLine {
  name: string;
  revenue: number;          // USD for the latest fiscal year
  sharePct: number;         // % of summed segment revenue
  yoyPct: number | null;    // vs prior year, when prior provided
}
export interface SegmentBreakdown {
  fiscalLabel: string;          // e.g. "FY2025" (best-effort)
  segments: SegmentLine[];      // sorted by revenue desc
  reconciledPct: number | null; // summed segment revenue ÷ total revenue × 100, or null
  note: string;                 // one-line caption
}

/** One trailing fiscal year of raw inputs for the forensics rubric. */
export interface ForensicsYear {
  fiscalLabel: string;          // "FY2025"
  periodEnd: string;            // ISO end date
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  capex: number | null;         // positive magnitude of the capex outflow
  freeCashFlow: number | null;  // operatingCashFlow - capex
  sbc: number | null;           // stock-based compensation expense
  dilutedShares: number | null;
  dilutedEps: number | null;
  accountsReceivable: number | null;
  inventory: number | null;
  costOfRevenue: number | null;
  deferredRevenue: number | null;
}

export type ForensicVerdict = "clean" | "watch" | "concerning" | "unavailable";

export type ForensicPatternKey =
  | "fcf_vs_ni"
  | "sbc_dilution"
  | "channel_stuffing"
  | "working_capital";

export interface ForensicPattern {
  key: ForensicPatternKey;
  label: string;
  verdict: ForensicVerdict;
  metric: string;   // short headline figure, e.g. "FCF/NI 0.62 over 3y"
  detail: string;   // one line of evidence
}

export interface ForensicsReport {
  overall: ForensicVerdict;
  patterns: ForensicPattern[];
  yearsAnalyzed: number;
}

export interface ForecastSummary {
  lastClose: number;
  predictedClose: number;
  changePct: number;
  bandPct: number;
  confidence: Confidence;
  horizonDays: number;
  probUp: number | null;
  expectedMovePct: number | null;
  suspect: boolean;
  suspectReason: string | null;
}

export interface SignalsSummary {
  congressNetFlowLabel: string;
  congressTradeCount: number;
  insiderTradeCount: number;
  thirteenFCount: number;
  govContractCount: number;
}

export type AnalystLensName = "technicals" | "fundamentals" | "valuation" | "positioning" | "flows" | "news";
export type AnalystPosture = "bullish" | "bearish" | "neutral" | "mixed" | "unavailable";
export type AnalystTakeawayKind = "support" | "risk" | "watch";

export type AnalystConviction = "high" | "medium" | "low";

export interface AnalystVerdict {
  action: Rating;            // mirrors houseCall.rating — set by the system, not the model
  conviction: AnalystConviction;
  bottomLine: string;        // one decisive sentence, model-written
}

export interface AnalystLensRead {
  lens: AnalystLensName;
  posture: AnalystPosture;
  summary: string;
  evidence: string[];
}

export interface AnalystTakeaway {
  kind: AnalystTakeawayKind;
  label: string;
  text: string;
}

export interface AnalystAnalysis {
  schemaVersion: 1;
  verdict?: AnalystVerdict;
  headline: string;
  thesis: string;
  lensReads: AnalystLensRead[];
  takeaways: AnalystTakeaway[];
  keyTension: string;
  whatWouldChange: string;
}

export type GeoImpactDir = "positive" | "negative" | "mixed";
export type GeoLean = "tailwind" | "headwind" | "mixed";
export type GeoChannel =
  | "sanctions_export_controls"
  | "tariffs_trade"
  | "regulation_policy"
  | "armed_conflict_security"
  | "energy_commodities"
  | "monetary_fiscal"
  | "elections_political"
  | "diplomacy_summits";
export type GeoExposure = "company_targeted" | "sector_supply_chain" | "macro_broad";
export type GeoStatus = "in_effect" | "proposed_likely" | "speculative_rumor";

export interface GeoFactor {
  event: string;
  impact: GeoImpactDir;
  score: number;
  channel?: GeoChannel;
  exposure?: GeoExposure;
  status?: GeoStatus;
  rationale: string;
  url: string | null;
  publisher: string | null;
}

export interface GeoImpact {
  summary: string;
  netLean: GeoLean;
  factors: GeoFactor[];
}

export interface FundamentalsInsight {
  schemaVersion: 1;
  interpretation: string;   // 1–2 sentence plain-English read of the reported numbers
  riskFactors: string[];    // 3–5 concise 10-K-style risk bullets (may be empty)
}

export type LongTermDirection = "tailwind" | "headwind" | "mixed";

export interface LongTermDriverPoint {
  date: string;   // ISO yyyy-mm-dd
  close: number;
}
export interface LongTermDriver {
  label: string;          // "US Natural Gas"
  symbol: string;         // Yahoo symbol, e.g. "NG=F"
  why: string;            // one line: why it drives this industry
  points: LongTermDriverPoint[]; // ~1y daily closes, oldest→newest
  corr?: number | null;   // Pearson correlation of daily returns vs the stock, −1..1
}

export interface LongTermTheme {
  name: string;
  score: number;
  direction: LongTermDirection;
  summary: string;
  evidence: string[];
  risk: string;
}

export interface LongTermPlay {
  schemaVersion: 1;
  horizon: string;
  summary: string;
  ifYouBelieve: string;
  whyItMatters: string[];
  themes: LongTermTheme[];
  confirmingSignals: string[];
  breakingSignals: string[];
  dataGaps: string[];
  drivers: LongTermDriver[];
}

export interface LedgerOfficialTrade {
  branch: "congress" | "executive";
  name: string;
  party: string | null;
  state: string | null;
  agency: string | null;
  action: "buy" | "sell" | "other";
  transactionType: string;
  amountMin: number | null;
  amountMax: number | null;
  amountRangeRaw: string | null;
  transactionDate: string; // ISO yyyy-mm-dd
  disclosureDate: string;  // ISO yyyy-mm-dd
}

export interface LedgerInsiderTrade {
  name: string;
  title: string | null;
  action: "buy" | "sell" | "other";
  transactionType: string;
  shares: number | null;
  pricePerShare: number | null;
  totalValue: number | null;
  transactionDate: string;       // ISO yyyy-mm-dd
  filingDate: string | null;     // ISO yyyy-mm-dd
}

export interface NextEarnings {
  date: string | null;
  daysUntil: number | null;
  isEstimate: boolean;
}

export type TradeEdge = "cheap" | "rich" | "fair" | "unknown";
export type TradeBias = "long calls" | "long puts" | "call spreads" | "put spreads" | "neutral / spreads";
export interface TradeLens {
  probUp: number | null;          // from forecast
  kronosMovePct: number | null;   // |Kronos expected move| over horizon
  impliedMovePct: number | null;  // option-implied move (horizon-matched, ~60d preferred)
  edge: TradeEdge;                 // forecast move vs implied
  edgeRatio: number | null;       // |kronos| / implied
  bias: TradeBias;
  note: string;
}

export interface Ledger {
  ticker: string;
  companyName: string | null;
  generatedAt: string;
  lastClose: number | null;
  scorecard: ScorecardRow[];
  trendGrid: TrendLens[];
  houseCall: HouseCall;
  forecast: ForecastSummary | null;
  fundamentals: EdgarFundamentals | null;
  signals: SignalsSummary | null;
  news: NewsItem[];
  newsSkew: number;
  consensusTarget: number | null;
  bars: BarPoint[];
  forecastPoints: ForecastPoint[];
  analystNote: string | null;
  analystAnalysis: AnalystAnalysis | null;
  geopolitical: GeoImpact | null;
  fundamentalsInsight: FundamentalsInsight | null;
  longTermPlay: LongTermPlay | null;
  officialTrades: LedgerOfficialTrade[];
  insiderTrades: LedgerInsiderTrade[];
  macro: MacroRegime | null;
  options: OptionsSignal | null;
  valuation: Valuation | null;
  analyst: AnalystConsensus | null;
  shortInterest: ShortInterest | null;
  nextEarnings: NextEarnings | null;
  tradeLens: TradeLens | null;
  forecastTrackRecord: ForecastTrackRecord | null;
  streetMomentum: StreetMomentum | null;
  altFlow: AltFlow | null;
  riskShift: RiskShift | null;
  forensics: ForensicsReport | null;
  segments: SegmentBreakdown | null;
}

export type MacroLean = "risk-on" | "neutral" | "risk-off";
export interface MacroFactor { name: string; value: string; lean: MacroLean; }
export interface MacroRegime {
  asOf: string;            // ISO date
  score: number;           // -100..100 (positive = risk-on)
  label: MacroLean;
  factors: MacroFactor[];  // curve, HY spread, VIX, dollar
  note: string;
  confidence: "low" | "ok";
}

export type OptionsLean = "bullish" | "bearish" | "neutral";
export interface OptionsSignal {
  asOf: string;            // ISO date
  expiration: string;      // ISO date of the analyzed expiry
  putCallVolume: number | null;  // put vol / call vol
  putCallOI: number | null;      // put OI / call OI
  atmIvPct: number | null;       // ATM implied vol, %
  ivSkewPct: number | null;      // OTM-put IV − OTM-call IV, percentage points
  expectedMovePct: number | null;// atmIV * sqrt(daysToExp/365), %
  lean: OptionsLean;
  daysToExp: number | null;
  expectedMove60dPct: number | null;
  expiration60d: string | null;
  ivRankPct?: number | null;     // percentile of current atmIvPct vs own history (self-accumulates)
}
export interface OptionContract { strike: number; impliedVolatility: number | null; volume: number | null; openInterest: number | null; }

export type ValuationRead = "expensive" | "fair" | "cheap" | "unknown";
export interface Valuation {
  peTrailing: number | null; peForward: number | null; priceToSales: number | null;
  priceToBook: number | null; pegRatio: number | null; evToEbitda: number | null;
  read: ValuationRead;
}
export interface AnalystConsensus {
  targetMean: number | null; targetHigh: number | null; targetLow: number | null;
  numAnalysts: number | null; recommendationKey: string | null; recommendationMean: number | null;
  upsidePct: number | null; // vs last close
  counts: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
}
export interface ShortInterest {
  sharesShort: number | null; percentOfFloat: number | null; daysToCover: number | null;
  priorSharesShort: number | null; changePct: number | null;
}
export interface MarketStats { valuation: Valuation | null; analyst: AnalystConsensus | null; shortInterest: ShortInterest | null; }

export interface ForecastRunResult {
  generatedAt: string;          // ISO
  horizonDays: number;
  daysElapsed: number;          // trading days actually evaluable
  predictedChangePct: number;   // anchor close -> predicted close at eval date
  realizedChangePct: number;    // anchor close -> realized close at eval date
  directionHit: boolean;
  withinBand: boolean;
}

export interface ForecastTrackRecord {
  runs: ForecastRunResult[];
  n: number;
  hitRate: number | null;        // 0..100
  medianAbsErrPct: number | null;
  bandCoveragePct: number | null;
}

export type StreetRead = "improving" | "deteriorating" | "flat" | "unknown";

export interface EpsRevisionCounts {
  period: string;           // "0q" | "+1q" | "0y" | "+1y"
  up30: number;
  down30: number;
}

export interface EpsTrendDelta {
  period: string;           // "0q" | "0y"
  current: number | null;
  ago30: number | null;
  pctChange30d: number | null; // null when |ago30| < 0.01
}

export interface EarningsSurprise {
  quarter: string;          // ISO yyyy-mm-dd (period end)
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
}

export interface RatingAction {
  date: string;             // ISO yyyy-mm-dd
  firm: string;
  fromGrade: string | null;
  toGrade: string;
  action: "up" | "down" | "init" | "main" | "reit";
}

export interface PeadWindow {
  active: boolean;
  daysSinceReport: number | null; // approximate
  lastSurprisePct: number | null;
  direction: "up" | "down" | null;
}

export interface StreetMomentum {
  revisions: EpsRevisionCounts[];
  trendDeltas: EpsTrendDelta[];
  surprises: EarningsSurprise[];   // newest first, ≤8
  beatCount: number;
  surpriseTotal: number;
  avgSurprisePct: number | null;
  upgrades30: number;
  downgrades30: number;
  recentActions: RatingAction[];   // newest first, ≤5
  pead: PeadWindow;
  read: StreetRead;
}

export interface WsbHeat {
  mentions7d: number;
  mentionsPrior7d: number;
  surgeRatio: number | null;   // null when prior period is 0
  latestSentiment: number | null;
  crowded: boolean;            // mentions7d >= 300 && surge >= 3
}
export interface DarkShortPressure {
  latestShortVolPct: number | null;
  baselineShortVolPct: number | null; // avg of ≤20 prior rows
  excessPp: number | null;            // latest − baseline; null when < 5 samples
  sampleSize: number;
}
export interface ThirteenFDrift {
  netChangeShares: number | null;  // sum changeShares at latest reportDate
  holderCount: number;
  topHolders: { filer: string; valueUsd: number | null }[]; // ≤3
  reportDate: string | null;       // ISO
}
export interface GovContractFlow {
  count180d: number;
  totalUsd180d: number;
  recent: { agency: string | null; amountUsd: number | null; awardedAt: string | null }[]; // ≤3
}
export interface AltFlow {
  wsb: WsbHeat | null;
  darkShort: DarkShortPressure | null;
  thirteenF: ThirteenFDrift | null;
  govContracts: GovContractFlow | null;
}

export interface RiskShift {
  newRisks: string[];      // ≤5
  removedRisks: string[];  // ≤3
  shiftSummary: string;
  fromFiling: string;      // e.g. "10-K 2025-02-01"
  toFiling: string;        // e.g. "10-K 2026-01-30"
}

export interface LedgerInputs {
  ticker: string;
  companyName: string | null;
  bars: BarPoint[];
  forecast: { points: ForecastPoint[]; horizonDays: number; probUp?: number | null; expectedMovePct?: number | null } | null;
  fundamentals: EdgarFundamentals | null;
  news: NewsItem[];
  signals: SignalsSummary | null;
  consensusTarget: number | null;
  officialTrades?: LedgerOfficialTrade[];
  insiderTrades?: LedgerInsiderTrade[];
  macro?: MacroRegime | null;
  options?: OptionsSignal | null;
  valuation?: Valuation | null;
  analyst?: AnalystConsensus | null;
  shortInterest?: ShortInterest | null;
  benchmarkBars?: { date: string; close: number }[] | null;
  altFlow?: AltFlow | null;
}
