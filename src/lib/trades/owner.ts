export type NormalizedTradeOwner = {
  ownerType: string | null;
  ownerName: string | null;
  ownerRaw: string | null;
  filingUrl: string | null;
  documentId: string | null;
};

type OwnerSource = Record<string, unknown>;

export function normalizeTradeOwner(source: OwnerSource): NormalizedTradeOwner {
  const ownerRaw = firstString(
    source.OwnerType,
    source.Owner,
    source.Relationship,
    source.RelationshipType,
    source.OwnerStatus,
    source.ownerType,
    source.owner,
    source.relationship,
  );

  return {
    ownerType: ownerRaw ? classifyOwnerType(ownerRaw) : null,
    ownerName: firstString(
      source.OwnerName,
      source.OwnerFullName,
      source.Owner_Name,
      source.ownerName,
      source.owner_full_name,
    ),
    ownerRaw,
    filingUrl: firstString(
      source.FilingURL,
      source.FilingUrl,
      source.Filing_URL,
      source.ReportURL,
      source.ReportUrl,
      source.URL,
      source.Url,
      source.filingUrl,
    ),
    documentId: firstString(
      source.DocumentID,
      source.DocumentId,
      source.Document_ID,
      source.DocID,
      source.DocId,
      source.ReportID,
      source.ReportId,
      source.FilingID,
      source.FilingId,
      source.documentId,
    ),
  };
}

export function classifyOwnerType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return "UNKNOWN";
  if (["sp", "s", "spouse"].includes(normalized) || normalized.includes("spouse")) {
    return "SPOUSE";
  }
  if (
    normalized === "dc" ||
    normalized.includes("dependent") ||
    normalized.includes("child")
  ) {
    return "DEPENDENT_CHILD";
  }
  if (normalized.includes("joint")) return "JOINT";
  if (
    ["self", "filer", "member", "reporting individual", "owner"].includes(normalized) ||
    normalized.includes("self")
  ) {
    return "SELF";
  }

  return "UNKNOWN";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return null;
}
