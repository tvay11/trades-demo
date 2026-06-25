import type { DatasetSpec } from "../types";
import type { QuiverTrade } from "@/lib/quiver/types";
import { tradeHash } from "@/lib/trades/hash";
import { normalizeTradeOwner } from "@/lib/trades/owner";
import { upsertCongressTrades } from "@/lib/trades/upsert";
import { ingestMinDate, isAfterCutoff } from "../cutoff";

function normalizeParty(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "d" || normalized.startsWith("dem")) return "D";
  if (normalized === "r" || normalized.startsWith("rep")) return "R";
  return value;
}

function normalizeChamber(value?: string): "House" | "Senate" | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("rep") || normalized.includes("house")) return "House";
  if (normalized.startsWith("sen") || normalized.includes("senate")) return "Senate";
  return undefined;
}

function disclosureRangeFromAmount(value?: string | number) {
  if (value == null || value === "") return undefined;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return undefined;
  if (amount <= 1_000) return "$1,000 - $1,000";
  if (amount <= 15_000) return "$1,001 - $15,000";
  if (amount <= 50_000) return "$15,001 - $50,000";
  if (amount <= 100_000) return "$50,001 - $100,000";
  if (amount <= 250_000) return "$100,001 - $250,000";
  if (amount <= 500_000) return "$250,001 - $500,000";
  if (amount <= 1_000_000) return "$500,001 - $1,000,000";
  if (amount <= 5_000_000) return "$1,000,001 - $5,000,000";
  return "$5,000,001 - $25,000,000";
}

function disclosureFreshnessDate(t: QuiverTrade) {
  return t.ReportDate ?? t.Disclosed ?? t.Filed ?? t.last_modified ?? t.TransactionDate;
}

function normalizeTrade(t: QuiverTrade): QuiverTrade | null {
  const representative = t.Representative ?? t.Name;
  const transactionDate = t.TransactionDate ?? t.Traded;
  const reportDate = t.ReportDate ?? t.Filed ?? t.Disclosed;
  const range = t.Range ?? disclosureRangeFromAmount(t.Trade_Size_USD ?? t.Amount);
  const owner = normalizeTradeOwner(t as Record<string, unknown>);

  if (!representative || !t.Ticker || !t.Transaction || !transactionDate) return null;

  return {
    ...t,
    Representative: representative,
    TransactionDate: transactionDate,
    ReportDate: reportDate,
    Disclosed: t.Disclosed ?? reportDate,
    Range: range,
    House: t.House ?? normalizeChamber(t.Chamber),
    Party: normalizeParty(t.Party),
    AssetDescription: t.AssetDescription ?? t.Description ?? t.Company ?? undefined,
    OwnerType: owner.ownerType ?? undefined,
    OwnerName: owner.ownerName ?? undefined,
    OwnerRaw: owner.ownerRaw ?? undefined,
    FilingUrl: owner.filingUrl ?? undefined,
    DocumentId: owner.documentId ?? undefined,
  };
}

export const CongressTradeSpec: DatasetSpec<QuiverTrade[], QuiverTrade> = {
  name: "CongressTrade",
  endpoints: {
    bulk: "/bulk/congresstrading",
    live: "/live/congresstrading",
  },
  pagination: { type: "none" },
  parse: (raw) => {
    const cutoff = ingestMinDate();
    return raw
      .map(normalizeTrade)
      .filter((row): row is QuiverTrade => row !== null)
      .filter((row) => isAfterCutoff(new Date(disclosureFreshnessDate(row)), cutoff));
  },
  dedup: (t) =>
    tradeHash({
      name: t.Representative,
      ticker: t.Ticker,
      date: t.TransactionDate,
      type: t.Transaction,
      amount: t.Range ?? "",
    }),
  upsert: async (rows) => upsertCongressTrades(rows),
};
