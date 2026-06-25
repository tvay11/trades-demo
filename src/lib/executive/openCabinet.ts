import { createHash } from "node:crypto";

export type OpenCabinetDataset = {
  generatedAt?: string;
  officialCount?: number;
  transactionCount?: number;
  officials?: OpenCabinetOfficial[];
};

export type OpenCabinetOfficial = {
  name?: string;
  slug?: string;
  title?: string | null;
  agency?: string | null;
  level?: string | null;
  party?: string | null;
  filingType?: string | null;
  summary?: string | null;
  confirmedDate?: string | null;
  tookOfficeDate?: string | null;
  departedDate?: string | null;
  mostRecentFilingDate?: string | null;
  sourceFilings?: OpenCabinetSourceFiling[];
  transactions?: OpenCabinetTransaction[];
};

export type OpenCabinetSourceFiling = {
  date?: string | null;
  url?: string | null;
  label?: string | null;
};

export type OpenCabinetTransaction = {
  description?: string | null;
  ticker?: string | null;
  type?: string | null;
  date?: string | null;
  amount?: string | null;
  lateFilingFlag?: boolean | null;
};

export type ParsedOpenCabinetAmountRange = {
  minCents: bigint | null;
  maxCents: bigint | null;
  midCents: bigint | null;
};

export type ShapedOpenCabinetOfficial = {
  name: string;
  slug: string;
  title: string | null;
  agencyName: string | null;
  level: string | null;
  party: string | null;
  filingType: string | null;
  summary: string | null;
  confirmedDate: Date | null;
  tookOfficeDate: Date | null;
  departedDate: Date | null;
  mostRecentFilingDate: Date | null;
  sourceUpdatedAt: Date | null;
};

export type ShapedOpenCabinetSourceFiling = {
  officialSlug: string;
  filingDate: Date | null;
  label: string | null;
  url: string;
};

export type ShapedOpenCabinetTrade = {
  officialSlug: string;
  ticker: string | null;
  assetDescription: string;
  transactionType: string;
  transactionDate: Date;
  amountMinCents: bigint | null;
  amountMaxCents: bigint | null;
  amountMidCents: bigint | null;
  amountRangeRaw: string;
  lateFilingFlag: boolean;
  sourceHash: string;
};

export type ShapedOpenCabinetDataset = {
  generatedAt: Date | null;
  officials: ShapedOpenCabinetOfficial[];
  sourceFilings: ShapedOpenCabinetSourceFiling[];
  trades: ShapedOpenCabinetTrade[];
  stockTickers: string[];
};

const VALID_TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function parseOpenCabinetAmountRange(range: string | null | undefined): ParsedOpenCabinetAmountRange {
  const raw = range?.trim();
  if (!raw) return { minCents: null, maxCents: null, midCents: null };

  if (/^over\s+/i.test(raw)) {
    const minCents = dollarsToCents(parseDollarNumber(raw));
    return { minCents, maxCents: null, midCents: minCents };
  }

  const parts = raw.split("-").map((part) => part.trim()).filter(Boolean);
  const minCents = dollarsToCents(parseDollarNumber(parts[0] ?? ""));
  const maxCents = dollarsToCents(parseDollarNumber(parts[1] ?? parts[0] ?? ""));
  const midCents =
    minCents == null
      ? maxCents
      : maxCents == null
        ? minCents
        : (minCents + maxCents) / BigInt(2);

  return { minCents, maxCents, midCents };
}

export function shapeOpenCabinetDataset(input: OpenCabinetDataset): ShapedOpenCabinetDataset {
  const generatedAt = parseDate(input.generatedAt);
  const officials: ShapedOpenCabinetOfficial[] = [];
  const sourceFilings: ShapedOpenCabinetSourceFiling[] = [];
  const trades: ShapedOpenCabinetTrade[] = [];
  const stockTickers = new Set<string>();

  for (const official of input.officials ?? []) {
    const name = cleanString(official.name);
    const slug = cleanString(official.slug) ?? slugify(name);
    if (!name || !slug) continue;

    officials.push({
      name,
      slug,
      title: cleanString(official.title),
      agencyName: cleanString(official.agency),
      level: cleanString(official.level),
      party: cleanString(official.party),
      filingType: cleanString(official.filingType),
      summary: cleanString(official.summary),
      confirmedDate: parseDate(official.confirmedDate),
      tookOfficeDate: parseDate(official.tookOfficeDate),
      departedDate: parseDate(official.departedDate),
      mostRecentFilingDate: parseDate(official.mostRecentFilingDate),
      sourceUpdatedAt: generatedAt,
    });

    for (const filing of official.sourceFilings ?? []) {
      const url = cleanString(filing.url);
      if (!url) continue;
      sourceFilings.push({
        officialSlug: slug,
        filingDate: parseDate(filing.date),
        label: cleanString(filing.label),
        url,
      });
    }

    const occurrenceCounts = new Map<string, number>();
    for (const transaction of official.transactions ?? []) {
      const assetDescription = cleanString(transaction.description);
      const transactionType = cleanString(transaction.type);
      const transactionDate = parseDate(transaction.date);
      const amountRangeRaw = cleanString(transaction.amount);
      if (!assetDescription || !transactionType || !transactionDate || !amountRangeRaw) continue;

      const ticker = normalizeTicker(transaction.ticker);
      if (ticker) stockTickers.add(ticker);

      const amount = parseOpenCabinetAmountRange(amountRangeRaw);
      const naturalKey = [
        slug,
        assetDescription,
        ticker ?? "",
        transactionType,
        transactionDate.toISOString().slice(0, 10),
        amountRangeRaw,
      ].join("|");
      const occurrence = (occurrenceCounts.get(naturalKey) ?? 0) + 1;
      occurrenceCounts.set(naturalKey, occurrence);

      trades.push({
        officialSlug: slug,
        ticker,
        assetDescription,
        transactionType,
        transactionDate,
        amountMinCents: amount.minCents,
        amountMaxCents: amount.maxCents,
        amountMidCents: amount.midCents,
        amountRangeRaw,
        lateFilingFlag: transaction.lateFilingFlag === true,
        sourceHash: tradeHash({
          officialSlug: slug,
          assetDescription,
          ticker,
          transactionType,
          transactionDate,
          amountRangeRaw,
          occurrence,
        }),
      });
    }
  }

  return {
    generatedAt,
    officials,
    sourceFilings,
    trades,
    stockTickers: [...stockTickers].sort(),
  };
}

function parseDollarNumber(value: string): number | null {
  const normalized = value.replace(/over/gi, "").replace(/[$,]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function dollarsToCents(value: number | null): bigint | null {
  return value == null ? null : BigInt(Math.round(value * 100));
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDate(value: unknown): Date | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const date = new Date(raw.includes("T") ? raw : `${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTicker(value: unknown): string | null {
  const ticker = cleanString(value)?.toUpperCase() ?? null;
  return ticker && VALID_TICKER.test(ticker) ? ticker : null;
}

function slugify(value: string | null): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tradeHash(input: {
  officialSlug: string;
  assetDescription: string;
  ticker: string | null;
  transactionType: string;
  transactionDate: Date;
  amountRangeRaw: string;
  occurrence: number;
}) {
  return createHash("sha256")
    .update(
      [
        "open_cabinet",
        input.officialSlug,
        input.assetDescription,
        input.ticker ?? "",
        input.transactionType,
        input.transactionDate.toISOString().slice(0, 10),
        input.amountRangeRaw,
        input.occurrence.toString(),
      ].join("|"),
    )
    .digest("hex");
}
