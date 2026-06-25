import { toCsv, type CsvColumn } from "@/lib/csv";
import type { BuyBriefEnrichmentRow } from "@/lib/queries/buyBriefEnrichment";
import type { ExecutiveSignal } from "@/lib/queries/executiveSignals";
import type { DualInsiderSignal } from "@/lib/queries/dualInsider";
import type { DarkFlowCandidate, LongShortCandidate } from "@/lib/queries/marketSignals";
import type { StockListRow } from "@/lib/queries/stocksList";

export type BuyBriefRow = {
  // Identity & fundamentals (stocks list)
  ticker: string;
  company: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  marketCap: number | null;
  tradeCount14: number | null;
  tradeCount30: number | null;
  tradeCount60: number | null;
  tradeCount90: number | null;
  tradeCount365: number | null;
  // Long/short signal
  lsStance: string | null;
  lsConfidence: string | null;
  lsScore: number | null;
  lsFlowScore: number | null;
  lsClusterScore: number | null;
  lsBreadthScore: number | null;
  lsInsiderScore: number | null;
  lsCommitteeScore: number | null;
  lsLagPenalty: number | null;
  netFlow: number | null;
  estimatedBuyVolume: number | null;
  estimatedSellVolume: number | null;
  buyPressure: number | null;
  sellPressure: number | null;
  buyCount: number | null;
  sellCount: number | null;
  politicianCount: number | null;
  insiderNetValue: number | null;
  avgDisclosureLagDays: number | null;
  latestDisclosureDate: Date | null;
  committeeRelevanceScore: number | null;
  committeeRelevanceLabel: string | null;
  lsReasons: string | null;
  lsWarnings: string | null;
  // Dark-flow signal
  dfArchetype: string | null;
  dfStance: string | null;
  dfConfidence: string | null;
  dfScore: number | null;
  darkPoolExcess: number | null;
  shortVolumeExcess: number | null;
  volumeSurge: number | null;
  hasOffExchangeBaseline: boolean | null;
  socialHeat: number | null;
  dfCongressNetFlow: number | null;
  dfInsiderNetValue: number | null;
  govContractValue: number | null;
  dfLatestDate: Date | null;
  dfCommitteeRelevanceScore: number | null;
  dfCommitteeRelevanceLabel: string | null;
  dfReasons: string | null;
  dfWarnings: string | null;
  // Dual-insider signal
  diDirection: string | null;
  diCongressBuyCount: number | null;
  diCongressSellCount: number | null;
  diCongressVolume: number | null;
  diCongressPoliticians: string | null;
  diLatestCongressDate: string | null;
  diInsiderBuyCount: number | null;
  diInsiderSellCount: number | null;
  diInsiderVolume: number | null;
  diInsiderNames: string | null;
  diLatestInsiderDate: string | null;
  diAlignmentScore: number | null;
  diOverlapWindowDays: number | null;
  // Price (ticker price cache)
  lastClose: number | null;
  lastCloseDate: Date | null;
  return30dPct: number | null;
  return90dPct: number | null;
  // Executive-branch trades (first-class insider signal)
  execDirection: string | null;
  execBuyCount: number | null;
  execSellCount: number | null;
  execTradeCount: number | null;
  execNetUsd: number | null;
  execTotalUsd: number | null;
  execOfficials: string | null;
  execOfficialCount: number | null;
  execLatestDate: Date | null;
  // Institutions (13F)
  instHolders: number | null;
  instTotalShares: number | null;
  instShareChange: number | null;
  instReportDate: Date | null;
  // Catalysts (trailing 1y)
  govContractUsd1y: number | null;
  govContractCount1y: number | null;
  lobbyingUsd1y: number | null;
  patentGrants1y: number | null;
  // Attention & risk
  wsbMentions30d: number | null;
  wsbSentiment30d: number | null;
  politicalBeta: number | null;
};

export const BUY_BRIEF_PROMPT = [
  "ROLE",
  "You are a buy-side equity analyst. The CSV below is a screen of US-listed",
  "stocks, one row per ticker, built from actual regulatory disclosures over the",
  "trailing year (congressional and executive-branch trades, corporate insider",
  "filings, 13F holdings, off-exchange tape, government contracts, lobbying) plus",
  "price and retail-attention context. Every figure is observed data, not a",
  "recommendation.",
  "",
  "TASK",
  "Identify the 8 strongest BUY candidates. Reason from the underlying evidence —",
  "do not just sort by the *_score columns; those are convenience composites and",
  "can hide thin or stale inputs. Prioritise tickers where INDEPENDENT signals",
  "agree, e.g. congress AND corporate insiders AND executive officials all net",
  "buying, confirmed by dark-pool accumulation and a supportive contract/lobbying",
  "backdrop. Treat narrow, single-source, or high-lag (avg_disclosure_lag_days)",
  "signals with caution. Discard rows with thin or mostly-blank data.",
  "",
  "WEIGHTING (strongest to weakest, all else equal)",
  "1. Executive-branch official buys (exec_*) — cabinet/agency insiders sit on the",
  "   policy that moves the stock; the highest-conviction tell.",
  "2. Dual-insider alignment (di_*) — congress and corporate insiders buying the",
  "   same name in the same window.",
  "3. Breadth of congressional buying — many distinct politicians (politician_count)",
  "   net buying (buy_count vs sell_count, net_flow > 0), committee members",
  "   especially (committee_relevance).",
  "4. Off-exchange accumulation (df_*) — dark-pool / short-volume excess with a",
  "   real baseline (has_off_exchange_baseline = true).",
  "5. Confirming context — institutional share increase (inst_share_change > 0),",
  "   growing gov contracts / lobbying, positive price trend (return_30d/90d).",
  "",
  "OUTPUT",
  "A ranked markdown table with columns: Rank | Ticker | Conviction (High/Med/Low)",
  "| Key evidence (cite the specific columns/numbers) | Position size (% of a long",
  "book, scaled to conviction) | Entry approach (scale-in vs single limit; a rough",
  "price zone from last_close only if justified) | Main risk. Then a short notes",
  "section calling out any conflicting signals (e.g. politicians buying while",
  "insiders sell, or price already extended) and which picks are data-thin.",
  "",
  "COLUMN GUIDE",
  "- Identity & fundamentals: company, sector, industry, country, market_cap, and",
  "  trade counts over 14/30/60/90/365 days (congressional trade activity).",
  "- ls_* = congressional long/short flow: stance/confidence, buy_count, sell_count,",
  "  politician_count, net_flow (est. buy minus sell volume), buy/sell pressure,",
  "  insider_net_value, avg_disclosure_lag_days, committee_relevance.",
  "- df_* = dark-flow / off-exchange: archetype, dark_pool_excess,",
  "  short_volume_excess, volume_surge, social_heat, gov_contract_value.",
  "- di_* = dual-insider alignment: direction, congress vs corporate-insider buy/",
  "  sell counts and volume, named participants, overlap window.",
  "- exec_* = executive-branch official trades: net direction, buy/sell counts,",
  "  net/total USD, and the named officials.",
  "- Price: last_close, return_30d/90d (momentum).",
  "- inst_* = 13F institutional holders, total shares, and share change.",
  "- Catalysts (trailing 1y): gov_contract_usd/count, lobbying_usd, patent_grants.",
  "- Attention & risk: wsb_mentions/sentiment (Reddit retail, 30d), political_beta",
  "  (sensitivity to political news).",
  "- *_reasons / *_warnings are semicolon-separated notes. Blank cell = no data;",
  "  treat blanks as unknown, never as zero.",
].join("\n");

const COLUMNS: CsvColumn<BuyBriefRow>[] = [
  { key: "ticker", label: "Ticker" },
  { key: "company", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "country", label: "Country" },
  { key: "marketCap", label: "Market Cap" },
  { key: "tradeCount14", label: "Trades 14d" },
  { key: "tradeCount30", label: "Trades 30d" },
  { key: "tradeCount60", label: "Trades 60d" },
  { key: "tradeCount90", label: "Trades 90d" },
  { key: "tradeCount365", label: "Trades 1y" },
  { key: "lsStance", label: "LS Stance" },
  { key: "lsConfidence", label: "LS Confidence" },
  { key: "lsScore", label: "LS Score" },
  { key: "lsFlowScore", label: "LS Flow Score" },
  { key: "lsClusterScore", label: "LS Cluster Score" },
  { key: "lsBreadthScore", label: "LS Breadth Score" },
  { key: "lsInsiderScore", label: "LS Insider Score" },
  { key: "lsCommitteeScore", label: "LS Committee Score" },
  { key: "lsLagPenalty", label: "LS Lag Penalty" },
  { key: "netFlow", label: "Net Flow" },
  { key: "estimatedBuyVolume", label: "Estimated Buy Volume" },
  { key: "estimatedSellVolume", label: "Estimated Sell Volume" },
  { key: "buyPressure", label: "Buy Pressure" },
  { key: "sellPressure", label: "Sell Pressure" },
  { key: "buyCount", label: "Buy Count" },
  { key: "sellCount", label: "Sell Count" },
  { key: "politicianCount", label: "Politician Count" },
  { key: "insiderNetValue", label: "Insider Net Value" },
  { key: "avgDisclosureLagDays", label: "Avg Disclosure Lag Days" },
  { key: "latestDisclosureDate", label: "Latest Disclosure Date" },
  { key: "committeeRelevanceScore", label: "Committee Relevance Score" },
  { key: "committeeRelevanceLabel", label: "Committee Relevance" },
  { key: "lsReasons", label: "LS Reasons" },
  { key: "lsWarnings", label: "LS Warnings" },
  { key: "dfArchetype", label: "DF Archetype" },
  { key: "dfStance", label: "DF Stance" },
  { key: "dfConfidence", label: "DF Confidence" },
  { key: "dfScore", label: "DF Score" },
  { key: "darkPoolExcess", label: "Dark Pool Excess" },
  { key: "shortVolumeExcess", label: "Short Volume Excess" },
  { key: "volumeSurge", label: "Volume Surge" },
  { key: "hasOffExchangeBaseline", label: "Has Off-Exchange Baseline" },
  { key: "socialHeat", label: "Social Heat" },
  { key: "dfCongressNetFlow", label: "DF Congress Net Flow" },
  { key: "dfInsiderNetValue", label: "DF Insider Net Value" },
  { key: "govContractValue", label: "Gov Contract Value" },
  { key: "dfLatestDate", label: "DF Latest Date" },
  { key: "dfCommitteeRelevanceScore", label: "DF Committee Relevance Score" },
  { key: "dfCommitteeRelevanceLabel", label: "DF Committee Relevance" },
  { key: "dfReasons", label: "DF Reasons" },
  { key: "dfWarnings", label: "DF Warnings" },
  { key: "diDirection", label: "DI Direction" },
  { key: "diCongressBuyCount", label: "DI Congress Buy Count" },
  { key: "diCongressSellCount", label: "DI Congress Sell Count" },
  { key: "diCongressVolume", label: "DI Congress Volume" },
  { key: "diCongressPoliticians", label: "DI Congress Politicians" },
  { key: "diLatestCongressDate", label: "DI Latest Congress Date" },
  { key: "diInsiderBuyCount", label: "DI Insider Buy Count" },
  { key: "diInsiderSellCount", label: "DI Insider Sell Count" },
  { key: "diInsiderVolume", label: "DI Insider Volume" },
  { key: "diInsiderNames", label: "DI Insider Names" },
  { key: "diLatestInsiderDate", label: "DI Latest Insider Date" },
  { key: "diAlignmentScore", label: "DI Alignment Score" },
  { key: "diOverlapWindowDays", label: "DI Overlap Window Days" },
  { key: "lastClose", label: "Last Close" },
  { key: "lastCloseDate", label: "Last Close Date" },
  { key: "return30dPct", label: "Return 30d %" },
  { key: "return90dPct", label: "Return 90d %" },
  { key: "execDirection", label: "Exec Direction" },
  { key: "execBuyCount", label: "Exec Buy Count" },
  { key: "execSellCount", label: "Exec Sell Count" },
  { key: "execTradeCount", label: "Exec Trade Count" },
  { key: "execNetUsd", label: "Exec Net USD" },
  { key: "execTotalUsd", label: "Exec Total USD" },
  { key: "execOfficials", label: "Exec Officials" },
  { key: "execOfficialCount", label: "Exec Official Count" },
  { key: "execLatestDate", label: "Exec Latest Date" },
  { key: "instHolders", label: "Inst Holders" },
  { key: "instTotalShares", label: "Inst Total Shares" },
  { key: "instShareChange", label: "Inst Share Change" },
  { key: "instReportDate", label: "Inst Report Date" },
  { key: "govContractUsd1y", label: "Gov Contract USD 1y" },
  { key: "govContractCount1y", label: "Gov Contract Count 1y" },
  { key: "lobbyingUsd1y", label: "Lobbying USD 1y" },
  { key: "patentGrants1y", label: "Patent Grants 1y" },
  { key: "wsbMentions30d", label: "WSB Mentions 30d" },
  { key: "wsbSentiment30d", label: "WSB Sentiment 30d" },
  { key: "politicalBeta", label: "Political Beta" },
];

function emptyRow(ticker: string): BuyBriefRow {
  return {
    ticker,
    company: null,
    sector: null,
    industry: null,
    country: null,
    marketCap: null,
    tradeCount14: null,
    tradeCount30: null,
    tradeCount60: null,
    tradeCount90: null,
    tradeCount365: null,
    lsStance: null,
    lsConfidence: null,
    lsScore: null,
    lsFlowScore: null,
    lsClusterScore: null,
    lsBreadthScore: null,
    lsInsiderScore: null,
    lsCommitteeScore: null,
    lsLagPenalty: null,
    netFlow: null,
    estimatedBuyVolume: null,
    estimatedSellVolume: null,
    buyPressure: null,
    sellPressure: null,
    buyCount: null,
    sellCount: null,
    politicianCount: null,
    insiderNetValue: null,
    avgDisclosureLagDays: null,
    latestDisclosureDate: null,
    committeeRelevanceScore: null,
    committeeRelevanceLabel: null,
    lsReasons: null,
    lsWarnings: null,
    dfArchetype: null,
    dfStance: null,
    dfConfidence: null,
    dfScore: null,
    darkPoolExcess: null,
    shortVolumeExcess: null,
    volumeSurge: null,
    hasOffExchangeBaseline: null,
    socialHeat: null,
    dfCongressNetFlow: null,
    dfInsiderNetValue: null,
    govContractValue: null,
    dfLatestDate: null,
    dfCommitteeRelevanceScore: null,
    dfCommitteeRelevanceLabel: null,
    dfReasons: null,
    dfWarnings: null,
    diDirection: null,
    diCongressBuyCount: null,
    diCongressSellCount: null,
    diCongressVolume: null,
    diCongressPoliticians: null,
    diLatestCongressDate: null,
    diInsiderBuyCount: null,
    diInsiderSellCount: null,
    diInsiderVolume: null,
    diInsiderNames: null,
    diLatestInsiderDate: null,
    diAlignmentScore: null,
    diOverlapWindowDays: null,
    lastClose: null,
    lastCloseDate: null,
    return30dPct: null,
    return90dPct: null,
    execDirection: null,
    execBuyCount: null,
    execSellCount: null,
    execTradeCount: null,
    execNetUsd: null,
    execTotalUsd: null,
    execOfficials: null,
    execOfficialCount: null,
    execLatestDate: null,
    instHolders: null,
    instTotalShares: null,
    instShareChange: null,
    instReportDate: null,
    govContractUsd1y: null,
    govContractCount1y: null,
    lobbyingUsd1y: null,
    patentGrants1y: null,
    wsbMentions30d: null,
    wsbSentiment30d: null,
    politicalBeta: null,
  };
}

function joinList(values: string[] | null | undefined): string | null {
  if (!values || values.length === 0) return null;
  return values.join("; ");
}

export function buildBuyBrief(
  longShort: LongShortCandidate[],
  darkFlow: DarkFlowCandidate[],
  dualInsider: DualInsiderSignal[],
  stocks: StockListRow[],
  enrichment: BuyBriefEnrichmentRow[] = [],
  executive: ExecutiveSignal[] = [],
): { rows: BuyBriefRow[]; csv: string; prompt: string; document: string } {
  const byTicker = new Map<string, BuyBriefRow>();
  const ensure = (ticker: string): BuyBriefRow => {
    const existing = byTicker.get(ticker);
    if (existing) return existing;
    const created = emptyRow(ticker);
    byTicker.set(ticker, created);
    return created;
  };

  for (const c of longShort) {
    const row = ensure(c.ticker);
    row.company ??= c.companyName;
    row.sector ??= c.sector;
    row.lsStance = c.stance;
    row.lsConfidence = c.confidence;
    row.lsScore = c.score;
    row.lsFlowScore = c.scoreBreakdown.flow;
    row.lsClusterScore = c.scoreBreakdown.cluster;
    row.lsBreadthScore = c.scoreBreakdown.breadth;
    row.lsInsiderScore = c.scoreBreakdown.insider;
    row.lsCommitteeScore = c.scoreBreakdown.committee;
    row.lsLagPenalty = c.scoreBreakdown.lagPenalty;
    row.netFlow = c.netFlow;
    row.estimatedBuyVolume = c.estimatedBuyVolume;
    row.estimatedSellVolume = c.estimatedSellVolume;
    row.buyPressure = c.buyPressure;
    row.sellPressure = c.sellPressure;
    row.buyCount = c.buyCount;
    row.sellCount = c.sellCount;
    row.politicianCount = c.politicianCount;
    row.insiderNetValue = c.insiderNetValue;
    row.avgDisclosureLagDays = c.averageDisclosureLagDays;
    row.latestDisclosureDate = c.latestDisclosureDate;
    row.committeeRelevanceScore = c.committeeRelevanceScore;
    row.committeeRelevanceLabel = c.committeeRelevanceLabel;
    row.lsReasons = joinList(c.reasons);
    row.lsWarnings = joinList(c.warnings);
  }

  for (const c of darkFlow) {
    const row = ensure(c.ticker);
    row.company ??= c.companyName;
    row.sector ??= c.sector;
    row.dfArchetype = c.archetype;
    row.dfStance = c.stance;
    row.dfConfidence = c.confidence;
    row.dfScore = c.score;
    row.darkPoolExcess = c.darkPoolExcess;
    row.shortVolumeExcess = c.shortVolumeExcess;
    row.volumeSurge = c.volumeSurge;
    row.hasOffExchangeBaseline = c.hasOffExchangeBaseline;
    row.socialHeat = c.socialHeat;
    row.dfCongressNetFlow = c.congressNetFlow;
    row.dfInsiderNetValue = c.insiderNetValue;
    row.govContractValue = c.govContractValue;
    row.dfLatestDate = c.latestDate;
    row.dfCommitteeRelevanceScore = c.committeeRelevanceScore;
    row.dfCommitteeRelevanceLabel = c.committeeRelevanceLabel;
    row.dfReasons = joinList(c.reasons);
    row.dfWarnings = joinList(c.warnings);
  }

  for (const c of dualInsider) {
    const row = ensure(c.ticker);
    row.diDirection = c.direction;
    row.diCongressBuyCount = c.congressBuyCount;
    row.diCongressSellCount = c.congressSellCount;
    row.diCongressVolume = c.congressVolume;
    row.diCongressPoliticians = joinList(c.congressPoliticians);
    row.diLatestCongressDate = c.latestCongressDate;
    row.diInsiderBuyCount = c.insiderBuyCount;
    row.diInsiderSellCount = c.insiderSellCount;
    row.diInsiderVolume = c.insiderVolume;
    row.diInsiderNames = joinList(c.insiderNames);
    row.diLatestInsiderDate = c.latestInsiderDate;
    row.diAlignmentScore = c.alignmentScore;
    row.diOverlapWindowDays = c.overlapWindowDays;
  }

  // Executive-branch official trades are a row-CREATING signal (not enrichment):
  // a ticker traded only by a cabinet/agency insider still surfaces here.
  for (const e of executive) {
    const row = ensure(e.ticker);
    row.execDirection = e.direction;
    row.execBuyCount = e.buyCount;
    row.execSellCount = e.sellCount;
    row.execTradeCount = e.tradeCount;
    row.execNetUsd = e.netUsd;
    row.execTotalUsd = e.totalUsd;
    row.execOfficials = joinList(e.officials);
    row.execOfficialCount = e.officialCount;
    row.execLatestDate = e.latestDate;
  }

  // Fundamentals only ENRICH tickers that already carry a signal — we never add a
  // row for a stock that has no congressional / dark-flow / insider signal, so the
  // brief stays focused on actual candidates instead of the whole stock universe.
  const stocksByTicker = new Map(stocks.map((s) => [s.ticker, s]));
  for (const row of byTicker.values()) {
    const s = stocksByTicker.get(row.ticker);
    if (!s) continue;
    row.company ??= s.companyName;
    row.sector ??= s.sector;
    row.industry = s.industry;
    row.country = s.country;
    row.marketCap = s.marketCap;
    row.tradeCount14 = s.tradeCount14;
    row.tradeCount30 = s.tradeCount30;
    row.tradeCount60 = s.tradeCount60;
    row.tradeCount90 = s.tradeCount90;
    row.tradeCount365 = s.tradeCount365;
  }

  // Enrichment (price, 13F, gov contracts, lobbying, patents, WSB, political
  // beta) only ENRICHES existing signal tickers — same focus rule as fundamentals
  // above. getBuyBriefEnrichment is already scoped to the signal ticker set, but
  // we guard here so a stray ticker never spawns a bare row.
  const enrichmentByTicker = new Map(enrichment.map((e) => [e.ticker, e]));
  for (const row of byTicker.values()) {
    const e = enrichmentByTicker.get(row.ticker);
    if (!e) continue;
    row.lastClose = e.lastClose;
    row.lastCloseDate = e.lastCloseDate;
    row.return30dPct = e.return30dPct;
    row.return90dPct = e.return90dPct;
    row.instHolders = e.instHolders;
    row.instTotalShares = e.instTotalShares;
    row.instShareChange = e.instShareChange;
    row.instReportDate = e.instReportDate;
    row.govContractUsd1y = e.govContractUsd1y;
    row.govContractCount1y = e.govContractCount1y;
    row.lobbyingUsd1y = e.lobbyingUsd1y;
    row.patentGrants1y = e.patentGrants1y;
    row.wsbMentions30d = e.wsbMentions30d;
    row.wsbSentiment30d = e.wsbSentiment30d;
    row.politicalBeta = e.politicalBeta;
  }

  const rows = [...byTicker.values()].sort(
    (a, b) =>
      (b.lsScore ?? b.dfScore ?? b.diAlignmentScore ?? 0) -
      (a.lsScore ?? a.dfScore ?? a.diAlignmentScore ?? 0),
  );

  const csv = toCsv(COLUMNS, rows);
  const document = `${BUY_BRIEF_PROMPT}\n\n${csv}`;
  return { rows, csv, prompt: BUY_BRIEF_PROMPT, document };
}
