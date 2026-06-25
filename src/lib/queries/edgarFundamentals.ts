import { applyCacheLife } from "@/lib/cache";
import type { EarningsBreakdown, EarningsLine, EarningsTrendPoint, EdgarFundamentals, EdgarPeriod, ForensicsYear } from "@/lib/ledger/types";

const UA = "trades-research-app (contact: research@example.com)";

type Fact = {
  fy?: number | null;
  fp?: string | null;
  form?: string | null;
  start?: string;
  end?: string;
  val?: number;
};
type CompanyFacts = {
  facts?: { "us-gaap"?: Record<string, { units?: Record<string, Fact[]> }> };
};

const REVENUE_KEYS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
] as const;

const OCF_KEYS = [
  "NetCashProvidedByUsedInOperatingActivities",
  "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
] as const;
const CAPEX_KEYS = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
] as const;
const SBC_KEYS = [
  "ShareBasedCompensation",
  "AllocatedShareBasedCompensationExpense",
] as const;
const AR_KEYS = ["AccountsReceivableNetCurrent"] as const;
const INVENTORY_KEYS = ["InventoryNet"] as const;
const DEFERRED_REV_KEYS = [
  "ContractWithCustomerLiabilityCurrent",
  "DeferredRevenueCurrent",
  "ContractWithCustomerLiability",
] as const;
const DILUTED_SHARES_KEYS = ["WeightedAverageNumberOfDilutedSharesOutstanding"] as const;
const NET_INCOME_KEYS = ["NetIncomeLoss"] as const;
const EPS_KEYS = ["EarningsPerShareDiluted"] as const;
const COGS_KEYS = ["CostOfRevenue", "CostOfGoodsAndServicesSold"] as const;
const GROSS_PROFIT_KEYS = ["GrossProfit"] as const;
const OPERATING_INCOME_KEYS = ["OperatingIncomeLoss"] as const;
const RND_KEYS = ["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"] as const;
const SGA_KEYS = ["SellingGeneralAndAdministrativeExpense", "GeneralAndAdministrativeExpense"] as const;

/** Return the USD (or USD/shares) array for a concept, or []. */
function factsFor(facts: CompanyFacts, concept: string): Fact[] {
  const node = facts.facts?.["us-gaap"]?.[concept];
  if (!node?.units) return [];
  return node.units["USD"] ?? node.units["USD/shares"] ?? [];
}

/**
 * Pick the REVENUE_KEYS concept whose latest annual (10-K FY) end date is
 * the most recent.  This handles companies like NVDA that tagged early filings
 * with RevenueFromContractWithCustomerExcludingAssessedTax but switched to the
 * simpler "Revenues" tag for more recent 10-Ks — we always want the concept
 * with the freshest data rather than the first one that has any data.
 */
function pickRevenueConcept(facts: CompanyFacts): string | null {
  let bestKey: string | null = null;
  let bestEnd = "";

  for (const key of REVENUE_KEYS) {
    const annual = factsFor(facts, key).filter(
      (f) => f.form === "10-K" && f.fp === "FY" && typeof f.val === "number" && f.end,
    );
    if (annual.length === 0) continue;
    const latestEnd = annual.reduce((max, f) => (f.end! > max ? f.end! : max), "");
    if (latestEnd > bestEnd) {
      bestEnd = latestEnd;
      bestKey = key;
    }
  }

  return bestKey;
}

/** Days between two ISO date strings. */
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/** Map fp "Q1"/"Q2"/"Q3" → 1/2/3; fallback: infer from end-month. */
function quarterNumber(fp: string | null | undefined, endDate: string): number {
  if (fp === "Q1") return 1;
  if (fp === "Q2") return 2;
  if (fp === "Q3") return 3;
  // fp could be null or undefined — infer from end month
  const month = new Date(endDate).getUTCMonth() + 1; // 1-12
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

/** Find the single fact whose `end` matches `targetEnd` (form-agnostic). */
function factAtEnd(arr: Fact[], targetEnd: string): number | null {
  const hit = arr.find((f) => f.end === targetEnd && typeof f.val === "number");
  return hit?.val ?? null;
}

/** Build an EdgarPeriod for the annual (10-K FY) filing. */
function buildAnnualPeriod(
  facts: CompanyFacts,
  revenueConcept: string,
): EdgarPeriod | null {
  const revAll = factsFor(facts, revenueConcept).filter(
    (f) => f.form === "10-K" && f.fp === "FY" && typeof f.val === "number" && f.end,
  );
  if (revAll.length === 0) return null;

  revAll.sort((a, b) => (a.end! < b.end! ? -1 : 1));
  const latest = revAll[revAll.length - 1];
  const latestEnd = latest.end!;

  // Prior = the annual fact whose end is closest to ~365d before latestEnd
  const targetPriorMs = new Date(latestEnd).getTime() - 365 * 86_400_000;
  const prior = revAll
    .slice(0, revAll.length - 1)
    .reduce<Fact | null>((best, f) => {
      if (!best) return f;
      const dBest = Math.abs(new Date(best.end!).getTime() - targetPriorMs);
      const dF = Math.abs(new Date(f.end!).getTime() - targetPriorMs);
      return dF < dBest ? f : best;
    }, null);

  const revenue = latest.val ?? null;
  const revenueYoYPct =
    prior?.val && revenue != null
      ? ((revenue - prior.val) / prior.val) * 100
      : null;

  // All other metrics: find fact with same end date, form=10-K
  const niAll = factsFor(facts, "NetIncomeLoss").filter(
    (f) => f.form === "10-K" && typeof f.val === "number" && f.end,
  );
  const gpAll = factsFor(facts, "GrossProfit").filter(
    (f) => f.form === "10-K" && typeof f.val === "number" && f.end,
  );
  const corAll = factsFor(facts, "CostOfRevenue").filter(
    (f) => f.form === "10-K" && typeof f.val === "number" && f.end,
  );
  const cogsAll = factsFor(facts, "CostOfGoodsAndServicesSold").filter(
    (f) => f.form === "10-K" && typeof f.val === "number" && f.end,
  );
  const epsAll = factsFor(facts, "EarningsPerShareDiluted").filter(
    (f) => f.form === "10-K" && typeof f.val === "number" && f.end,
  );

  const netIncome = factAtEnd(niAll, latestEnd);

  // Prior net income for YoY
  const priorEnd = prior?.end ?? null;
  const priorNetIncome = priorEnd ? factAtEnd(niAll, priorEnd) : null;
  const netIncomeYoYPct =
    priorNetIncome && netIncome != null
      ? ((netIncome - priorNetIncome) / Math.abs(priorNetIncome)) * 100
      : null;

  // Gross margin: GrossProfit at same end, else revenue - CostOfRevenue
  let grossMarginPct: number | null = null;
  const gp = factAtEnd(gpAll, latestEnd);
  if (gp != null && revenue != null && revenue !== 0) {
    grossMarginPct = (gp / revenue) * 100;
  } else if (revenue != null && revenue !== 0) {
    const cor =
      factAtEnd(corAll, latestEnd) ?? factAtEnd(cogsAll, latestEnd);
    if (cor != null) {
      grossMarginPct = ((revenue - cor) / revenue) * 100;
    }
  }

  const dilutedEps = factAtEnd(epsAll, latestEnd);

  return {
    fiscalLabel: latest.fy != null ? `FY${latest.fy}` : "latest",
    periodEnd: latestEnd,
    form: "10-K",
    revenue,
    revenueYoYPct,
    grossMarginPct,
    netIncome,
    netIncomeYoYPct,
    dilutedEps,
  };
}

/** Build an EdgarPeriod for the latest quarterly (10-Q ~90d) filing. */
function buildQuarterPeriod(
  facts: CompanyFacts,
  revenueConcept: string,
): EdgarPeriod | null {
  // Only ~3-month facts (80–100 days) from 10-Q filings
  const isQuarterly = (f: Fact) =>
    f.form === "10-Q" &&
    typeof f.val === "number" &&
    f.end &&
    f.start &&
    daysBetween(f.start, f.end) >= 80 &&
    daysBetween(f.start, f.end) <= 100;

  const revQ = factsFor(facts, revenueConcept).filter(isQuarterly);
  if (revQ.length === 0) return null;

  revQ.sort((a, b) => (a.end! < b.end! ? -1 : 1));
  const latest = revQ[revQ.length - 1];
  const latestEnd = latest.end!;
  const latestStart = latest.start!;

  // Prior quarter: ~1 year earlier AND same ~90-day duration
  const targetPriorMs = new Date(latestEnd).getTime() - 365 * 86_400_000;
  const latestDur = daysBetween(latestStart, latestEnd);
  const prior = revQ
    .slice(0, revQ.length - 1)
    .filter((f) => Math.abs(daysBetween(f.start!, f.end!) - latestDur) <= 10)
    .reduce<Fact | null>((best, f) => {
      if (!best) return f;
      const dBest = Math.abs(new Date(best.end!).getTime() - targetPriorMs);
      const dF = Math.abs(new Date(f.end!).getTime() - targetPriorMs);
      return dF < dBest ? f : best;
    }, null);

  const revenue = latest.val ?? null;
  const revenueYoYPct =
    prior?.val && revenue != null
      ? ((revenue - prior.val) / prior.val) * 100
      : null;

  // Align all quarterly metrics to latestEnd + ~90d duration
  const matchQ = (arr: Fact[]): number | null => {
    // Find fact with same end, form=10-Q, and ~quarterly duration
    const hit = arr.find(
      (f) =>
        f.end === latestEnd &&
        f.form === "10-Q" &&
        f.start &&
        daysBetween(f.start, f.end) >= 80 &&
        daysBetween(f.start, f.end) <= 100 &&
        typeof f.val === "number",
    );
    return hit?.val ?? null;
  };

  const niAll = factsFor(facts, "NetIncomeLoss").filter(
    (f) => f.form === "10-Q" && typeof f.val === "number" && f.end,
  );
  const gpAll = factsFor(facts, "GrossProfit").filter(
    (f) => f.form === "10-Q" && typeof f.val === "number" && f.end,
  );
  const corAll = factsFor(facts, "CostOfRevenue").filter(
    (f) => f.form === "10-Q" && typeof f.val === "number" && f.end,
  );
  const cogsAll = factsFor(facts, "CostOfGoodsAndServicesSold").filter(
    (f) => f.form === "10-Q" && typeof f.val === "number" && f.end,
  );
  const epsAll = factsFor(facts, "EarningsPerShareDiluted").filter(
    (f) => f.form === "10-Q" && typeof f.val === "number" && f.end,
  );

  const netIncome = matchQ(niAll);

  // Prior net income for YoY
  const priorEnd = prior?.end ?? null;
  const priorNetIncome = priorEnd
    ? niAll.find(
        (f) =>
          f.end === priorEnd &&
          f.start &&
          daysBetween(f.start, f.end!) >= 80 &&
          daysBetween(f.start, f.end!) <= 100,
      )?.val ?? null
    : null;
  const netIncomeYoYPct =
    priorNetIncome && netIncome != null
      ? ((netIncome - priorNetIncome) / Math.abs(priorNetIncome)) * 100
      : null;

  // Gross margin: same-period GrossProfit or revenue - CostOfRevenue
  let grossMarginPct: number | null = null;
  const gp = matchQ(gpAll);
  if (gp != null && revenue != null && revenue !== 0) {
    grossMarginPct = (gp / revenue) * 100;
  } else if (revenue != null && revenue !== 0) {
    const cor = matchQ(corAll) ?? matchQ(cogsAll);
    if (cor != null) {
      grossMarginPct = ((revenue - cor) / revenue) * 100;
    }
  }

  const dilutedEps = matchQ(epsAll);

  // Additional quarterly income-statement items (single-quarter ~90d facts only).
  const quarterlyFacts = (key: string) =>
    factsFor(facts, key).filter((f) => f.form === "10-Q" && typeof f.val === "number" && f.end);
  const matchQKeys = (keys: readonly string[]): number | null => {
    for (const k of keys) {
      const v = matchQ(quarterlyFacts(k));
      if (v != null) return v;
    }
    return null;
  };
  const operatingIncome = matchQKeys(OPERATING_INCOME_KEYS);
  const rdExpense = matchQKeys(RND_KEYS);
  const sgaExpense = matchQKeys(SGA_KEYS);

  const qNum = quarterNumber(latest.fp, latestEnd);
  const fyLabel = latest.fy != null ? `FY${latest.fy}` : "";
  const fiscalLabel = `Q${qNum} ${fyLabel}`.trim();

  return {
    fiscalLabel,
    periodEnd: latestEnd,
    form: "10-Q",
    revenue,
    revenueYoYPct,
    grossMarginPct,
    netIncome,
    netIncomeYoYPct,
    dilutedEps,
    operatingIncome,
    rdExpense,
    sgaExpense,
  };
}

/** Like factsFor but also returns the "shares" unit (for share counts). */
function anyUnitFacts(facts: CompanyFacts, concept: string): Fact[] {
  const node = facts.facts?.["us-gaap"]?.[concept];
  if (!node?.units) return [];
  return node.units["USD"] ?? node.units["USD/shares"] ?? node.units["shares"] ?? [];
}

/** First concept (in priority order) that has a 10-K FY fact at `end`, else null. */
function annualValueAtEnd(
  facts: CompanyFacts,
  concepts: readonly string[],
  end: string,
): number | null {
  for (const c of concepts) {
    const hit = anyUnitFacts(facts, c).find(
      (f) => f.end === end && f.form === "10-K" && typeof f.val === "number",
    );
    if (hit) return hit.val ?? null;
  }
  return null;
}

/** Trailing annual (10-K FY) series, oldest→newest, last 3 fiscal years. */
export function buildForensicsSeries(
  facts: CompanyFacts,
  revenueConcept: string,
): ForensicsYear[] {
  const revAnnual = factsFor(facts, revenueConcept).filter(
    (f) => f.form === "10-K" && f.fp === "FY" && typeof f.val === "number" && f.end,
  );
  if (revAnnual.length === 0) return [];

  revAnnual.sort((a, b) => (a.end! < b.end! ? -1 : 1));
  const years = revAnnual.slice(-3); // last 3 fiscal years, oldest→newest

  return years.map((rev) => {
    const end = rev.end!;
    const ocf = annualValueAtEnd(facts, OCF_KEYS, end);
    const capex = annualValueAtEnd(facts, CAPEX_KEYS, end);
    const fcf = ocf != null && capex != null ? ocf - capex : null;
    return {
      fiscalLabel: rev.fy != null ? `FY${rev.fy}` : end.slice(0, 4),
      periodEnd: end,
      revenue: rev.val ?? null,
      netIncome: annualValueAtEnd(facts, NET_INCOME_KEYS, end),
      operatingCashFlow: ocf,
      capex,
      freeCashFlow: fcf,
      sbc: annualValueAtEnd(facts, SBC_KEYS, end),
      dilutedShares: annualValueAtEnd(facts, DILUTED_SHARES_KEYS, end),
      dilutedEps: annualValueAtEnd(facts, EPS_KEYS, end),
      accountsReceivable: annualValueAtEnd(facts, AR_KEYS, end),
      inventory: annualValueAtEnd(facts, INVENTORY_KEYS, end),
      costOfRevenue: annualValueAtEnd(facts, COGS_KEYS, end),
      deferredRevenue: annualValueAtEnd(facts, DEFERRED_REV_KEYS, end),
    };
  });
}

function marginOf(v: number | null, rev: number | null): number | null {
  return v != null && rev != null && rev !== 0 ? (v / rev) * 100 : null;
}
function yoyOf(cur: number | null, prev: number | null): number | null {
  return cur != null && prev != null && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
}

/** Latest-10-K income-statement waterfall + cash-flow block + 3y margin trend. */
export function buildEarningsBreakdown(
  facts: CompanyFacts,
  revenueConcept: string,
): EarningsBreakdown | null {
  const revAnnual = factsFor(facts, revenueConcept).filter(
    (f) => f.form === "10-K" && f.fp === "FY" && typeof f.val === "number" && f.end,
  );
  if (revAnnual.length === 0) return null;
  revAnnual.sort((a, b) => (a.end! < b.end! ? -1 : 1));
  const years = revAnnual.slice(-3);
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  const end = latest.end!;
  const priorEnd = prior?.end ?? null;
  const at = (keys: readonly string[], e: string | null) => (e ? annualValueAtEnd(facts, keys, e) : null);

  const revenue = latest.val ?? null;
  const revenuePrior = prior?.val ?? null;
  const cogs = at(COGS_KEYS, end);
  let grossProfit = at(GROSS_PROFIT_KEYS, end);
  if (grossProfit == null && revenue != null && cogs != null) grossProfit = revenue - cogs;
  const operatingIncome = at(OPERATING_INCOME_KEYS, end);
  const rnd = at(RND_KEYS, end);
  const sga = at(SGA_KEYS, end);
  const netIncome = at(NET_INCOME_KEYS, end);
  const eps = at(EPS_KEYS, end);
  const ocf = at(OCF_KEYS, end);
  const capex = at(CAPEX_KEYS, end);
  const fcf = ocf != null && capex != null ? ocf - capex : null;
  const ocfPrior = at(OCF_KEYS, priorEnd);
  const capexPrior = at(CAPEX_KEYS, priorEnd);
  const fcfPrior = ocfPrior != null && capexPrior != null ? ocfPrior - capexPrior : null;

  const lines: EarningsLine[] = [
    { key: "revenue", label: "Revenue", value: revenue, marginPct: null, yoyPct: yoyOf(revenue, revenuePrior), kind: "total" },
    { key: "cogs", label: "Cost of revenue", value: cogs, marginPct: marginOf(cogs, revenue), yoyPct: null, kind: "deduction" },
    { key: "grossProfit", label: "Gross profit", value: grossProfit, marginPct: marginOf(grossProfit, revenue), yoyPct: null, kind: "subtotal" },
    { key: "rnd", label: "R&D", value: rnd, marginPct: marginOf(rnd, revenue), yoyPct: null, kind: "deduction" },
    { key: "sga", label: "SG&A", value: sga, marginPct: marginOf(sga, revenue), yoyPct: null, kind: "deduction" },
    { key: "operatingIncome", label: "Operating income", value: operatingIncome, marginPct: marginOf(operatingIncome, revenue), yoyPct: yoyOf(operatingIncome, at(OPERATING_INCOME_KEYS, priorEnd)), kind: "subtotal" },
    { key: "netIncome", label: "Net income", value: netIncome, marginPct: marginOf(netIncome, revenue), yoyPct: yoyOf(netIncome, at(NET_INCOME_KEYS, priorEnd)), kind: "subtotal" },
    { key: "eps", label: "Diluted EPS", value: eps, marginPct: null, yoyPct: yoyOf(eps, at(EPS_KEYS, priorEnd)), kind: "pershare" },
    { key: "shares", label: "Diluted shares", value: annualValueAtEnd(facts, DILUTED_SHARES_KEYS, end), marginPct: null, yoyPct: null, kind: "pershare" },
    { key: "ocf", label: "Operating cash flow", value: ocf, marginPct: marginOf(ocf, revenue), yoyPct: null, kind: "cashflow" },
    { key: "capex", label: "CapEx", value: capex, marginPct: marginOf(capex, revenue), yoyPct: null, kind: "deduction" },
    { key: "fcf", label: "Free cash flow", value: fcf, marginPct: marginOf(fcf, revenue), yoyPct: yoyOf(fcf, fcfPrior), kind: "cashflow" },
  ];

  const trend: EarningsTrendPoint[] = years.map((y) => {
    const e = y.end!;
    const rev = y.val ?? null;
    const o = annualValueAtEnd(facts, OCF_KEYS, e);
    const c = annualValueAtEnd(facts, CAPEX_KEYS, e);
    const fc = o != null && c != null ? o - c : null;
    return {
      fiscalLabel: y.fy != null ? `FY${y.fy}` : e.slice(0, 4),
      revenue: rev,
      operatingMarginPct: marginOf(annualValueAtEnd(facts, OPERATING_INCOME_KEYS, e), rev),
      netMarginPct: marginOf(annualValueAtEnd(facts, NET_INCOME_KEYS, e), rev),
      fcfMarginPct: marginOf(fc, rev),
    };
  });

  return { fiscalLabel: latest.fy != null ? `FY${latest.fy}` : end.slice(0, 4), periodEnd: end, form: "10-K", lines, trend };
}

/** Convert a shaped EdgarPeriod into an income-statement waterfall (no trend).
 *  Cost of revenue / gross profit are derived from gross margin when present. */
export function periodToEarningsBreakdown(period: EdgarPeriod | null): EarningsBreakdown | null {
  if (!period || period.revenue == null) return null;
  const rev = period.revenue;
  const margin = (v: number | null | undefined): number | null =>
    v != null && rev !== 0 ? (v / rev) * 100 : null;
  const grossProfit = period.grossMarginPct != null ? rev * (period.grossMarginPct / 100) : null;
  const cogs = grossProfit != null ? rev - grossProfit : null;

  const lines: EarningsLine[] = [
    { key: "revenue", label: "Revenue", value: rev, marginPct: null, yoyPct: period.revenueYoYPct, kind: "total" },
    { key: "cogs", label: "Cost of revenue", value: cogs, marginPct: margin(cogs), yoyPct: null, kind: "deduction" },
    { key: "grossProfit", label: "Gross profit", value: grossProfit, marginPct: period.grossMarginPct ?? null, yoyPct: null, kind: "subtotal" },
    { key: "rnd", label: "R&D", value: period.rdExpense ?? null, marginPct: margin(period.rdExpense), yoyPct: null, kind: "deduction" },
    { key: "sga", label: "SG&A", value: period.sgaExpense ?? null, marginPct: margin(period.sgaExpense), yoyPct: null, kind: "deduction" },
    { key: "operatingIncome", label: "Operating income", value: period.operatingIncome ?? null, marginPct: margin(period.operatingIncome), yoyPct: null, kind: "subtotal" },
    { key: "netIncome", label: "Net income", value: period.netIncome, marginPct: margin(period.netIncome), yoyPct: period.netIncomeYoYPct, kind: "subtotal" },
    { key: "eps", label: "Diluted EPS", value: period.dilutedEps, marginPct: null, yoyPct: null, kind: "pershare" },
  ];
  if (lines.every((l) => l.value == null)) return null;
  return { fiscalLabel: period.fiscalLabel, periodEnd: period.periodEnd ?? "", form: period.form, lines, trend: [] };
}

export function shapeEdgarFacts(facts: CompanyFacts): EdgarFundamentals | null {
  const revConcept = pickRevenueConcept(facts);
  if (!revConcept) return null;

  const annual = buildAnnualPeriod(facts, revConcept);
  const quarter = buildQuarterPeriod(facts, revConcept);

  if (!annual && !quarter) return null;

  return {
    annual,
    quarter,
    forensicsSeries: buildForensicsSeries(facts, revConcept),
    earnings: buildEarningsBreakdown(facts, revConcept) ?? undefined,
    quarterlyEarnings: periodToEarningsBreakdown(quarter) ?? undefined,
  };
}

export async function resolveCik(ticker: string): Promise<string | null> {
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  const map = (await res.json()) as Record<string, { ticker: string; cik_str: number }>;
  const hit = Object.values(map).find((e) => e.ticker?.toUpperCase() === ticker.toUpperCase());
  return hit ? String(hit.cik_str).padStart(10, "0") : null;
}

export async function getEdgarFundamentals(ticker: string): Promise<EdgarFundamentals | null> {
  "use cache";
  applyCacheLife("hours");

  try {
    console.log(`[edgar] ${ticker}: resolving CIK`);
    const cik = await resolveCik(ticker.trim().toUpperCase());
    if (!cik) {
      console.warn(`[edgar] ${ticker}: no CIK match`);
      return null;
    }
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { "User-Agent": UA },
    });
    console.log(`[edgar] ${ticker}: companyfacts HTTP ${res.status} (CIK ${cik})`);
    if (!res.ok) return null;
    const shaped = shapeEdgarFacts((await res.json()) as CompanyFacts);
    console.log(
      `[edgar] ${ticker}: ${shaped ? "annual=" + shaped.annual?.revenue + " (" + shaped.annual?.fiscalLabel + ") quarter=" + shaped.quarter?.revenue + " (" + shaped.quarter?.fiscalLabel + ")" : "no usable facts"}`,
    );
    return shaped;
  } catch (error) {
    console.error("[edgar] fundamentals failed", error);
    return null;
  }
}
