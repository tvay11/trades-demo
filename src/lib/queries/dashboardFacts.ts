export type TickerBreadthInput = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  politicianKey?: string | number | null;
  politicianName: string;
  state: string | null;
  transactionType: string;
  amountMinimum: number;
  disclosureDate: Date;
};

export type DashboardTickerBreadth = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  politicianCount: number;
  stateCount: number;
  buyVolume: number;
  sellVolume: number;
  netVolume: number;
  latestDisclosureDate: Date | null;
};

export type DisclosureReturnInput = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  return30d: number | null;
  disclosureDate: Date;
};

export type DashboardDisclosureReturn = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  sampleSize: number;
  averageReturn30d: number;
  positiveReturn30dPercent: number;
  bestReturn30d: number;
  latestDisclosureDate: Date | null;
};

export type DashboardAlertCounts = {
  newFilingsToday: number;
  committeeLinkedTrades: number;
  spouseTrades30d: number;
  largeTrades30d: number;
  darkFlowIntersections: number;
  failedDatasetCount: number;
};

export type DashboardAlertItem = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "neutral" | "warning";
  href: string;
};

export type PriceCloseInput = {
  date: Date;
  close: number;
};

export type OwnerDisclosureInput = {
  ownerType: string | null;
  ownerName: string | null;
  ownerRaw: string | null;
};

export type DualInsiderAlignmentInput = {
  congressBuyVolume: number;
  congressSellVolume: number;
  insiderBuyVolume: number;
  insiderSellVolume: number;
};

export function buildDashboardAlerts(counts: DashboardAlertCounts): DashboardAlertItem[] {
  return [
    {
      key: "new-filings",
      label: "New Filings",
      value: formatCount(counts.newFilingsToday),
      detail: "Filed today",
      tone: counts.newFilingsToday > 0 ? "positive" : "neutral",
      href: "/trades",
    },
    {
      key: "committee-linked",
      label: "Committee Links",
      value: formatCount(counts.committeeLinkedTrades),
      detail: "Jurisdiction overlap",
      tone: counts.committeeLinkedTrades > 0 ? "positive" : "neutral",
      href: "/relationships",
    },
    {
      key: "spouse-owner",
      label: "Owner Trades",
      value: formatCount(counts.spouseTrades30d),
      detail: "Spouse/dependent flags",
      tone: counts.spouseTrades30d > 0 ? "positive" : "neutral",
      href: "/trades",
    },
    {
      key: "large-trades",
      label: "Large Filings",
      value: formatCount(counts.largeTrades30d),
      detail: "$1M+ disclosed 30d",
      tone: counts.largeTrades30d > 0 ? "positive" : "neutral",
      href: "/trades",
    },
    {
      key: "dark-flow",
      label: "Dark Flow",
      value: formatCount(counts.darkFlowIntersections),
      detail: "Congress + off-exchange",
      tone: counts.darkFlowIntersections > 0 ? "positive" : "neutral",
      href: "/analysis",
    },
    {
      key: "ingest-health",
      label: "Ingest Health",
      value: formatCount(counts.failedDatasetCount),
      detail: "Dataset failures",
      tone: counts.failedDatasetCount > 0 ? "warning" : "neutral",
      href: "/admin/data-health",
    },
  ];
}

export function isOptionAssetDescription(value: string | null | undefined): boolean {
  const normalized = value?.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/\bcapital call\b/.test(normalized)) return false;
  if (/\b(call|put)\s+options?\b/.test(normalized)) return true;
  if (/\boptions?\b/.test(normalized)) return true;
  if (/\bstrike\s+price\b/.test(normalized) && /\b(expires?|expiration)\b/.test(normalized)) {
    return true;
  }
  return /\b(call|put)\b/.test(normalized) && /\b(strike|expires?|expiration)\b/.test(normalized);
}

export function calculatePostDisclosureReturn({
  disclosureDate,
  horizonDays,
  closes,
}: {
  disclosureDate: Date;
  horizonDays: number;
  closes: PriceCloseInput[];
}): number | null {
  const sortedCloses = [...closes].sort((a, b) => a.date.getTime() - b.date.getTime());
  const entry = closeOnOrAfter(disclosureDate, sortedCloses)?.close ?? null;
  const exit = closeOnOrAfter(addDays(disclosureDate, horizonDays), sortedCloses)?.close ?? null;
  if (entry == null || exit == null || entry <= 0) return null;
  return round(((exit - entry) / entry) * 100, 2);
}

export function isOwnerRelatedDisclosure(row: OwnerDisclosureInput): boolean {
  const ownerText = [row.ownerType, row.ownerRaw].filter(Boolean).join(" ").toLowerCase();
  return /\b(spouse|dependent|child)\b/.test(ownerText);
}

export function classifyDualInsiderAlignment(
  input: DualInsiderAlignmentInput,
): "Bullish" | "Bearish" | null {
  const congressNet = input.congressBuyVolume - input.congressSellVolume;
  const insiderNet = input.insiderBuyVolume - input.insiderSellVolume;
  if (congressNet > 0 && insiderNet > 0) return "Bullish";
  if (congressNet < 0 && insiderNet < 0) return "Bearish";
  return null;
}

export function summarizeTickerBreadth(
  rows: TickerBreadthInput[],
  limit = 8,
): DashboardTickerBreadth[] {
  return [...groupBy(rows, (row) => row.ticker.toUpperCase()).entries()]
    .map(([ticker, grouped]) => {
      const buyRows = grouped.filter((row) => classifyAction(row.transactionType) === "buy");
      const sellRows = grouped.filter((row) => classifyAction(row.transactionType) === "sell");
      const buyVolume = sum(buyRows.map((row) => row.amountMinimum));
      const sellVolume = sum(sellRows.map((row) => row.amountMinimum));

      return {
        ticker,
        companyName: firstText(grouped.map((row) => row.companyName)),
        sector: firstText(grouped.map((row) => row.sector)),
        tradeCount: grouped.length,
        buyCount: buyRows.length,
        sellCount: sellRows.length,
        politicianCount: new Set(
          grouped.map((row) => String(row.politicianKey ?? row.politicianName)),
        ).size,
        stateCount: new Set(grouped.map((row) => row.state).filter(Boolean)).size,
        buyVolume,
        sellVolume,
        netVolume: buyVolume - sellVolume,
        latestDisclosureDate: maxDate(grouped.map((row) => row.disclosureDate)),
      };
    })
    .sort(
      (a, b) =>
        b.politicianCount - a.politicianCount ||
        Math.abs(b.netVolume) - Math.abs(a.netVolume) ||
        b.tradeCount - a.tradeCount ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, limit);
}

export function rankDisclosureReturnFacts(
  rows: DisclosureReturnInput[],
  limit = 8,
): DashboardDisclosureReturn[] {
  return [...groupBy(rows, (row) => row.ticker.toUpperCase()).entries()]
    .map(([ticker, grouped]) => {
      const returns = grouped
        .map((row) => row.return30d)
        .filter((value): value is number => value != null && Number.isFinite(value));
      if (!returns.length) return null;

      return {
        ticker,
        companyName: firstText(grouped.map((row) => row.companyName)),
        sector: firstText(grouped.map((row) => row.sector)),
        sampleSize: returns.length,
        averageReturn30d: round(average(returns), 2),
        positiveReturn30dPercent: round(
          (returns.filter((value) => value > 0).length / returns.length) * 100,
          1,
        ),
        bestReturn30d: round(Math.max(...returns), 2),
        latestDisclosureDate: maxDate(grouped.map((row) => row.disclosureDate)),
      };
    })
    .filter((fact): fact is DashboardDisclosureReturn => fact !== null)
    .sort(
      (a, b) =>
        b.averageReturn30d - a.averageReturn30d ||
        b.positiveReturn30dPercent - a.positiveReturn30dPercent ||
        b.sampleSize - a.sampleSize ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, limit);
}

export function classifyAction(value: string): "buy" | "sell" | "other" {
  const normalized = value.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("purchase")) return "buy";
  if (normalized.includes("sell") || normalized.includes("sale")) return "sell";
  return "other";
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }
  return grouped;
}

function firstText(values: Array<string | null>) {
  return values.find((value): value is string => Boolean(value)) ?? null;
}

function maxDate(values: Date[]) {
  if (!values.length) return null;
  return values.reduce((latest, value) => (value > latest ? value : latest), values[0]);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return sum(values) / values.length;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function closeOnOrAfter(date: Date, closes: PriceCloseInput[]) {
  return closes.find((close) => close.date.getTime() >= date.getTime()) ?? null;
}

function round(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString("en-US");
}
