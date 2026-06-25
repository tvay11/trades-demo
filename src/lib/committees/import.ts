export type CongressLegislator = {
  id: {
    bioguide?: string;
  };
  name: {
    first?: string;
    middle?: string;
    last?: string;
    suffix?: string;
    official_full?: string;
  };
  terms?: Array<{
    type?: string;
    state?: string;
    start?: string;
    end?: string;
  }>;
};

export type CongressCommittee = {
  type?: string;
  name?: string;
  thomas_id?: string;
  url?: string;
  subcommittees?: Array<{
    name?: string;
    thomas_id?: string;
  }>;
};

export type CongressCommitteeMember = {
  name?: string;
  bioguide?: string;
  party?: string;
  rank?: number;
  title?: string;
};

export type CommitteeMembership = Record<string, CongressCommitteeMember[]>;

export type LegislatorIndexEntry = {
  bioguideId: string;
  displayName: string;
  normalizedName: string;
  state: string | null;
  chamber: string | null;
};

export type LegislatorIndex = {
  byBioguide: Map<string, LegislatorIndexEntry>;
  byKey: Map<string, LegislatorIndexEntry>;
};

export type CommitteeImportRow = {
  code: string;
  name: string;
  chamber: string | null;
  type: "committee" | "subcommittee";
  url: string | null;
  parentCode: string | null;
};

export type CommitteeAssignmentImportRow = {
  bioguideId: string;
  committeeCode: string;
  role: string | null;
  rank: number | null;
  partySide: string | null;
  isChair: boolean;
  isRanking: boolean;
};

const HONORIFICS = /\b(hon|honorable|rep|representative|sen|senator|mr|mrs|ms|dr)\b\.?/gi;
const SUFFIX_PUNCTUATION = /[.,]/g;

export function normalizePersonName(name: string) {
  const trimmed = name.trim();
  const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const ordered = commaParts.length >= 2 ? `${commaParts.slice(1).join(" ")} ${commaParts[0]}` : trimmed;

  return ordered
    .replace(HONORIFICS, "")
    .replace(SUFFIX_PUNCTUATION, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildLegislatorIndex(legislators: CongressLegislator[]): LegislatorIndex {
  const byBioguide = new Map<string, LegislatorIndexEntry>();
  const byKey = new Map<string, LegislatorIndexEntry>();

  for (const legislator of legislators) {
    const bioguideId = legislator.id.bioguide;
    if (!bioguideId) continue;

    const term = latestTerm(legislator.terms ?? []);
    const displayName = displayLegislatorName(legislator);
    const entry = {
      bioguideId,
      displayName,
      normalizedName: normalizePersonName(displayName),
      state: term?.state ?? null,
      chamber: chamberFromTerm(term?.type),
    } satisfies LegislatorIndexEntry;

    byBioguide.set(bioguideId, entry);
    if (entry.state && entry.chamber) {
      byKey.set(indexKey(entry.normalizedName, entry.state, entry.chamber), entry);
    }
  }

  return { byBioguide, byKey };
}

export function flattenCommittees(committees: CongressCommittee[]): CommitteeImportRow[] {
  const rows: CommitteeImportRow[] = [];

  for (const committee of committees) {
    if (!committee.thomas_id || !committee.name) continue;

    rows.push({
      code: committee.thomas_id,
      name: committee.name,
      chamber: committee.type ?? null,
      type: "committee",
      url: committee.url ?? null,
      parentCode: null,
    });

    for (const subcommittee of committee.subcommittees ?? []) {
      if (!subcommittee.thomas_id || !subcommittee.name) continue;

      rows.push({
        code: `${committee.thomas_id}${subcommittee.thomas_id}`,
        name: `${committee.name}: ${subcommittee.name}`,
        chamber: committee.type ?? null,
        type: "subcommittee",
        url: null,
        parentCode: committee.thomas_id,
      });
    }
  }

  return rows;
}

export function shapeCommitteeAssignments(
  membership: CommitteeMembership,
  committeesByCode: Map<string, CommitteeImportRow>,
  legislatorIndex: LegislatorIndex,
): CommitteeAssignmentImportRow[] {
  const rows: CommitteeAssignmentImportRow[] = [];

  for (const [committeeCode, members] of Object.entries(membership)) {
    if (!committeesByCode.has(committeeCode)) continue;

    for (const member of members) {
      const bioguideId =
        member.bioguide ??
        (member.name ? findLegislatorByName(member.name, legislatorIndex)?.bioguideId : undefined);
      if (!bioguideId) continue;

      const role = member.title ?? null;
      const lowerRole = role?.toLowerCase() ?? "";

      rows.push({
        bioguideId,
        committeeCode,
        role,
        rank: member.rank ?? null,
        partySide: member.party ?? null,
        isChair: lowerRole.includes("chair"),
        isRanking: lowerRole.includes("ranking"),
      });
    }
  }

  return rows;
}

export function committeeIndexKey(name: string, state: string | null, chamber: string | null) {
  if (!state || !chamber) return null;
  return indexKey(normalizePersonName(name), state, chamber);
}

function findLegislatorByName(name: string, index: LegislatorIndex) {
  const normalized = normalizePersonName(name);
  return [...index.byBioguide.values()].find((entry) => entry.normalizedName === normalized);
}

function displayLegislatorName(legislator: CongressLegislator) {
  if (legislator.name.official_full) return legislator.name.official_full;

  return [
    legislator.name.first,
    legislator.name.middle,
    legislator.name.last,
    legislator.name.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function latestTerm(terms: NonNullable<CongressLegislator["terms"]>) {
  return [...terms].sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""))[0] ?? null;
}

function chamberFromTerm(type: string | undefined) {
  if (type === "rep") return "House";
  if (type === "sen") return "Senate";
  return type ?? null;
}

function indexKey(name: string, state: string, chamber: string) {
  return `${name}|${state}|${chamber}`;
}
