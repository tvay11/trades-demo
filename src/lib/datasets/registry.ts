import { format } from "date-fns";

export type DatasetGroup =
  | "Operations"
  | "Reference"
  | "Congress"
  | "Executive"
  | "Alternative Data";

export type DatasetColumnKind =
  | "text"
  | "ticker"
  | "politician"
  | "official"
  | "date"
  | "cents"
  | "number"
  | "percent"
  | "hash"
  | "url";

export type DatasetColumn = {
  key: string;
  label: string;
  kind?: DatasetColumnKind;
};

export type DatasetSortDirection = "asc" | "desc";

export type DatasetFilterGroupLabel =
  | "Entity"
  | "Time"
  | "Magnitude"
  | "Direction"
  | "Relevance"
  | "Supplemental";

export type DatasetFilterKind =
  | "text"
  | "enum"
  | "date-range"
  | "number-range"
  | "boolean"
  | "presence";

export type DatasetFilterDefinition = {
  key: string;
  label: string;
  kind: DatasetFilterKind;
  group: DatasetFilterGroupLabel;
  options?: Array<{ label: string; value: string }>;
  rangeOptions?: {
    min?: Array<{ label: string; value: string }>;
    max?: Array<{ label: string; value: string }>;
  };
  nullable?: boolean;
  virtual?: boolean;
};

export type DatasetDefaultSort = {
  key: string;
  dir: DatasetSortDirection;
};

export type DatasetFilterGroup = {
  label: DatasetFilterGroupLabel;
  description?: string;
};

export type DatasetDefinition = {
  slug: string;
  label: string;
  tableName: string;
  group: DatasetGroup;
  description: string;
  columns: DatasetColumn[];
  searchableColumns: string[];
  defaultSort: DatasetDefaultSort;
  filterGroups: DatasetFilterGroup[];
  filters: DatasetFilterDefinition[];
};

export type DatasetRow = Record<string, unknown>;

const commonGroups: DatasetFilterGroup[] = [
  { label: "Entity", description: "Who, what, or which symbol this row is about." },
  { label: "Time", description: "Recency, filing windows, and report windows." },
  { label: "Magnitude", description: "Dollar size, count size, or scale of activity." },
  { label: "Direction", description: "State, side, or directional bias." },
  { label: "Relevance", description: "Trader-facing context when the table supports it." },
  { label: "Supplemental", description: "Useful lower-priority inspection controls." },
];

const enumFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel,
  options: Array<{ label: string; value: string }>,
): DatasetFilterDefinition => ({
  key,
  label,
  kind: "enum",
  group,
  options,
});

const textFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel,
): DatasetFilterDefinition => ({
  key,
  label,
  kind: "text",
  group,
});

const dateFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel = "Time",
): DatasetFilterDefinition => ({
  key,
  label,
  kind: "date-range",
  group,
});

const numberFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel = "Magnitude",
  rangeOptions?: DatasetFilterDefinition["rangeOptions"],
): DatasetFilterDefinition => ({
  key,
  label,
  kind: "number-range",
  group,
  ...(rangeOptions ? { rangeOptions } : {}),
});

const disclosureAmountRangeOptions: NonNullable<DatasetFilterDefinition["rangeOptions"]> = {
  min: [
    { label: "Any floor", value: "" },
    { label: "$1K+", value: "100000" },
    { label: "$15K+", value: "1500000" },
    { label: "$50K+", value: "5000000" },
    { label: "$100K+", value: "10000000" },
    { label: "$250K+", value: "25000000" },
    { label: "$500K+", value: "50000000" },
    { label: "$1M+", value: "100000000" },
    { label: "$5M+", value: "500000000" },
    { label: "$25M+", value: "2500000000" },
  ],
  max: [
    { label: "Any ceiling", value: "" },
    { label: "Up to $15K", value: "1500000" },
    { label: "Up to $50K", value: "5000000" },
    { label: "Up to $100K", value: "10000000" },
    { label: "Up to $250K", value: "25000000" },
    { label: "Up to $500K", value: "50000000" },
    { label: "Up to $1M", value: "100000000" },
    { label: "Up to $5M", value: "500000000" },
    { label: "Up to $25M", value: "2500000000" },
    { label: "Any disclosed maximum", value: "999999999999" },
  ],
};

const ownerTypeOptions = [
  { label: "Self", value: "SELF" },
  { label: "Spouse", value: "SPOUSE" },
  { label: "Dependent Child", value: "DEPENDENT_CHILD" },
  { label: "Joint", value: "JOINT" },
  { label: "Unknown", value: "UNKNOWN" },
];

const partyOptions = [
  { label: "Democrat", value: "D" },
  { label: "Republican", value: "R" },
  { label: "Independent", value: "I" },
];

const chamberOptions = [
  { label: "House", value: "House" },
  { label: "Senate", value: "Senate" },
];

const virtualTextFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel,
): DatasetFilterDefinition => ({
  ...textFilter(key, label, group),
  virtual: true,
});

const virtualNumberFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel = "Magnitude",
): DatasetFilterDefinition => ({
  ...numberFilter(key, label, group),
  virtual: true,
});

const booleanFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel,
): DatasetFilterDefinition => ({
  key,
  label,
  kind: "boolean",
  group,
});

const presenceFilter = (
  key: string,
  label: string,
  group: DatasetFilterGroupLabel,
): DatasetFilterDefinition => ({
  key,
  label,
  kind: "presence",
  group,
  nullable: true,
});

export const DATASET_DEFINITIONS = [
  {
    slug: "backfill-jobs",
    label: "Backfill Jobs",
    tableName: "BackfillJob",
    group: "Operations",
    description: "Cursor, status, and error tracking for scheduled source backfills.",
    columns: [
      { key: "dataset", label: "Dataset" },
      { key: "mode", label: "Mode" },
      { key: "status", label: "Status" },
      { key: "cursor", label: "Cursor", kind: "hash" },
      { key: "totalIngested", label: "Rows", kind: "number" },
      { key: "lastRunAt", label: "Last Run", kind: "date" },
      { key: "lastError", label: "Last Error" },
    ],
    searchableColumns: ["dataset", "mode", "status", "cursor", "lastError"],
    defaultSort: { key: "lastRunAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("dataset", "Dataset", "Entity"),
      enumFilter("mode", "Mode", "Direction", [
        { label: "Backfill", value: "backfill" },
        { label: "Live", value: "live" },
      ]),
      enumFilter("status", "Status", "Direction", [
        { label: "Active", value: "active" },
        { label: "Complete", value: "complete" },
        { label: "Error", value: "error" },
        { label: "Paused", value: "paused" },
      ]),
      dateFilter("lastRunAt", "Last Run"),
      numberFilter("totalIngested", "Rows"),
      presenceFilter("cursor", "Cursor Present", "Supplemental"),
      presenceFilter("lastError", "Has Error", "Direction"),
    ],
  },
  {
    slug: "ingest-runs",
    label: "Ingest Runs",
    tableName: "IngestRun",
    group: "Operations",
    description: "Point-in-time import attempts with fetched, inserted, and error counts.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "dataset", label: "Dataset" },
      { key: "mode", label: "Mode" },
      { key: "startedAt", label: "Started", kind: "date" },
      { key: "finishedAt", label: "Finished", kind: "date" },
      { key: "rowsFetched", label: "Fetched", kind: "number" },
      { key: "rowsInserted", label: "Inserted", kind: "number" },
      { key: "error", label: "Error" },
    ],
    searchableColumns: ["dataset", "mode", "error"],
    defaultSort: { key: "startedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("dataset", "Dataset", "Entity"),
      enumFilter("mode", "Mode", "Direction", [
        { label: "Backfill", value: "backfill" },
        { label: "Live", value: "live" },
      ]),
      dateFilter("startedAt", "Started"),
      dateFilter("finishedAt", "Finished"),
      numberFilter("rowsFetched", "Rows Fetched"),
      numberFilter("rowsInserted", "Rows Inserted"),
      presenceFilter("error", "Has Error", "Direction"),
    ],
  },
  {
    slug: "politicians",
    label: "Politicians",
    tableName: "Politician",
    group: "Reference",
    description: "Normalized elected official records used to join congressional trades.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "name", label: "Name", kind: "politician" },
      { key: "party", label: "Party" },
      { key: "state", label: "State" },
      { key: "chamber", label: "Chamber" },
      { key: "trades30d", label: "30d Trades", kind: "number" },
      { key: "trades60d", label: "60d Trades", kind: "number" },
      { key: "trades90d", label: "90d Trades", kind: "number" },
      { key: "committee", label: "Committee" },
      { key: "ranking", label: "Ranking", kind: "number" },
      { key: "bioguideId", label: "Bioguide" },
      { key: "createdAt", label: "Created", kind: "date" },
    ],
    searchableColumns: ["name", "party", "state", "chamber", "bioguideId"],
    defaultSort: { key: "name", dir: "asc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("name", "Name", "Entity"),
      enumFilter("party", "Party", "Direction", partyOptions),
      textFilter("state", "State", "Entity"),
      enumFilter("chamber", "Chamber", "Entity", chamberOptions),
      virtualNumberFilter("trades30d", "30d Trades", "Magnitude"),
      virtualNumberFilter("trades60d", "60d Trades", "Magnitude"),
      virtualNumberFilter("trades90d", "90d Trades", "Magnitude"),
      virtualTextFilter("committee", "Committee", "Relevance"),
      virtualNumberFilter("ranking", "Committee Rank", "Relevance"),
      presenceFilter("bioguideId", "Bioguide Linked", "Relevance"),
      dateFilter("createdAt", "Created"),
    ],
  },
  {
    slug: "committees",
    label: "Committees",
    tableName: "Committee",
    group: "Reference",
    description: "Current congressional committees and subcommittees from the public legislators dataset.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "code", label: "Code", kind: "hash" },
      { key: "name", label: "Name" },
      { key: "chamber", label: "Chamber" },
      { key: "type", label: "Type" },
      { key: "parentCode", label: "Parent", kind: "hash" },
      { key: "updatedAt", label: "Updated", kind: "date" },
    ],
    searchableColumns: ["code", "name", "chamber", "type", "parentCode"],
    defaultSort: { key: "name", dir: "asc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("name", "Committee", "Entity"),
      textFilter("code", "Code", "Supplemental"),
      enumFilter("chamber", "Chamber", "Entity", [
        { label: "House", value: "house" },
        { label: "Senate", value: "senate" },
        { label: "Joint", value: "joint" },
      ]),
      enumFilter("type", "Type", "Direction", [
        { label: "Committee", value: "committee" },
        { label: "Subcommittee", value: "subcommittee" },
      ]),
      presenceFilter("parentCode", "Has Parent", "Relevance"),
      dateFilter("updatedAt", "Updated"),
    ],
  },
  {
    slug: "committee-assignments",
    label: "Committee Assignments",
    tableName: "PoliticianCommitteeAssignment",
    group: "Reference",
    description: "Join table connecting normalized politicians to committee roles, rank, chair, and ranking status.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "politicianId", label: "Politician", kind: "number" },
      { key: "committeeId", label: "Committee", kind: "number" },
      { key: "role", label: "Role" },
      { key: "rank", label: "Rank", kind: "number" },
      { key: "partySide", label: "Side" },
      { key: "isChair", label: "Chair" },
      { key: "isRanking", label: "Ranking" },
      { key: "updatedAt", label: "Updated", kind: "date" },
    ],
    searchableColumns: ["role", "partySide"],
    defaultSort: { key: "updatedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      numberFilter("politicianId", "Politician ID", "Entity"),
      numberFilter("committeeId", "Committee ID", "Entity"),
      textFilter("role", "Role", "Relevance"),
      numberFilter("rank", "Rank", "Magnitude"),
      enumFilter("partySide", "Party Side", "Direction", [
        { label: "Majority", value: "majority" },
        { label: "Minority", value: "minority" },
      ]),
      booleanFilter("isChair", "Chair", "Relevance"),
      booleanFilter("isRanking", "Ranking Member", "Relevance"),
      dateFilter("updatedAt", "Updated"),
    ],
  },
  {
    slug: "stocks",
    label: "Stocks",
    tableName: "Stock",
    group: "Reference",
    description: "Ticker master data for company profile, sector, exchange, and links.",
    columns: [
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "companyName", label: "Company" },
      { key: "exchange", label: "Exchange" },
      { key: "sector", label: "Sector" },
      { key: "industry", label: "Industry" },
      { key: "country", label: "Country" },
      { key: "marketCap", label: "Market Cap", kind: "number" },
      { key: "website", label: "Website", kind: "url" },
      { key: "updatedAt", label: "Updated", kind: "date" },
    ],
    searchableColumns: ["ticker", "companyName", "exchange", "sector", "industry", "country"],
    defaultSort: { key: "ticker", dir: "asc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("companyName", "Company", "Entity"),
      textFilter("exchange", "Exchange", "Supplemental"),
      textFilter("sector", "Sector", "Relevance"),
      textFilter("industry", "Industry", "Relevance"),
      textFilter("country", "Country", "Supplemental"),
      presenceFilter("marketCap", "Has Market Cap", "Magnitude"),
      presenceFilter("website", "Has Website", "Supplemental"),
      presenceFilter("logoUrl", "Has Logo", "Supplemental"),
      dateFilter("createdAt", "Created"),
      dateFilter("updatedAt", "Updated"),
    ],
  },
  {
    slug: "ticker-prices",
    label: "Ticker Price Cache",
    tableName: "TickerPriceCache",
    group: "Reference",
    description: "Daily close prices cached from the market data provider for chart overlays.",
    columns: [
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "date", label: "Date", kind: "date" },
      { key: "close", label: "Close", kind: "cents" },
    ],
    searchableColumns: ["ticker"],
    defaultSort: { key: "date", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      dateFilter("date", "Price Date"),
      numberFilter("close", "Close Price", "Magnitude"),
    ],
  },
  {
    slug: "congress-trades",
    label: "Congress Trades",
    tableName: "CongressTrade",
    group: "Congress",
    description: "Unified congressional trades joined to normalized politician records.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "representative", label: "Politician", kind: "politician" },
      { key: "ownerType", label: "Owner" },
      { key: "party", label: "Party" },
      { key: "state", label: "State" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "transactionType", label: "Type" },
      { key: "transactionDate", label: "Trade Date", kind: "date" },
      { key: "disclosureDate", label: "Disclosed", kind: "date" },
      { key: "amountMinCents", label: "Min", kind: "cents" },
      { key: "amountMaxCents", label: "Max", kind: "cents" },
      { key: "ownerName", label: "Owner Name" },
      { key: "documentId", label: "Document", kind: "hash" },
    ],
    searchableColumns: ["representative", "ticker", "assetDescription", "transactionType", "state", "ownerType", "ownerName", "ownerRaw", "documentId", "amountRangeRaw"],
    defaultSort: { key: "disclosureDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("representative", "Politician", "Entity"),
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("assetDescription", "Asset / Company", "Entity"),
      enumFilter("ownerType", "Owner", "Relevance", ownerTypeOptions),
      textFilter("ownerName", "Owner Name", "Supplemental"),
      textFilter("ownerRaw", "Raw Owner", "Supplemental"),
      enumFilter("party", "Party", "Direction", partyOptions),
      enumFilter("house", "Chamber", "Entity", chamberOptions),
      textFilter("state", "State", "Entity"),
      enumFilter("transactionType", "Trade Type", "Direction", [
        { label: "Purchase", value: "Purchase" },
        { label: "Sale", value: "Sale" },
        { label: "Exchange", value: "Exchange" },
      ]),
      dateFilter("transactionDate", "Trade Date"),
      dateFilter("reportDate", "Report Date"),
      dateFilter("disclosureDate", "Disclosure Date"),
      dateFilter("ingestedAt", "Ingested"),
      numberFilter("amountMinCents", "Minimum Amount", "Magnitude", disclosureAmountRangeOptions),
      numberFilter("amountMaxCents", "Maximum Amount", "Magnitude", disclosureAmountRangeOptions),
      presenceFilter("filingUrl", "Has Filing Link", "Supplemental"),
      presenceFilter("documentId", "Has Document ID", "Supplemental"),
    ],
  },
  {
    slug: "signal-snapshots",
    label: "Signal Snapshots",
    tableName: "SignalSnapshot",
    group: "Operations",
    description: "Persisted ticker scores and explanations generated by the analysis layer.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "signalType", label: "Type" },
      { key: "stance", label: "Stance" },
      { key: "score", label: "Score", kind: "number" },
      { key: "confidence", label: "Confidence" },
      { key: "source", label: "Source" },
      { key: "generatedAt", label: "Generated", kind: "date" },
    ],
    searchableColumns: ["ticker", "signalType", "stance", "confidence", "source"],
    defaultSort: { key: "generatedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("signalType", "Signal Type", "Direction"),
      textFilter("stance", "Stance", "Direction"),
      numberFilter("score", "Score"),
      textFilter("confidence", "Confidence", "Supplemental"),
      textFilter("source", "Source", "Supplemental"),
      dateFilter("generatedAt", "Generated"),
    ],
  },
  {
    slug: "backtest-runs",
    label: "Backtest Runs",
    tableName: "BacktestRun",
    group: "Operations",
    description: "Disclosure-date strategy runs with aggregate return, win-rate, and capital statistics.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "name", label: "Name" },
      { key: "strategy", label: "Strategy" },
      { key: "horizonDays", label: "Days", kind: "number" },
      { key: "tradeCount", label: "Trades", kind: "number" },
      { key: "averageReturnPercent", label: "Avg Return", kind: "percent" },
      { key: "winRate", label: "Win Rate", kind: "percent" },
      { key: "startedAt", label: "Started", kind: "date" },
    ],
    searchableColumns: ["name", "strategy", "source"],
    defaultSort: { key: "startedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("name", "Run", "Entity"),
      textFilter("strategy", "Strategy", "Direction"),
      numberFilter("horizonDays", "Horizon Days", "Time"),
      numberFilter("tradeCount", "Trade Count"),
      numberFilter("averageReturnPercent", "Average Return"),
      numberFilter("winRate", "Win Rate"),
      textFilter("source", "Source", "Supplemental"),
      dateFilter("startedAt", "Started"),
    ],
  },
  {
    slug: "backtest-positions",
    label: "Backtest Positions",
    tableName: "BacktestPosition",
    group: "Operations",
    description: "Position-level entries and exits for disclosure-date backtest runs.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "runId", label: "Run", kind: "number" },
      { key: "tradeId", label: "Trade", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "side", label: "Side" },
      { key: "entryDate", label: "Entry", kind: "date" },
      { key: "exitDate", label: "Exit", kind: "date" },
      { key: "returnBps", label: "Return bps", kind: "number" },
    ],
    searchableColumns: ["ticker", "side"],
    defaultSort: { key: "entryDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      numberFilter("runId", "Run ID", "Supplemental"),
      numberFilter("tradeId", "Trade ID", "Supplemental"),
      textFilter("ticker", "Ticker", "Entity"),
      enumFilter("side", "Side", "Direction", [
        { label: "Long", value: "long" },
        { label: "Short", value: "short" },
      ]),
      dateFilter("entryDate", "Entry Date"),
      dateFilter("exitDate", "Exit Date"),
      numberFilter("returnBps", "Return bps"),
    ],
  },
  {
    slug: "senate-trades",
    label: "Senate Trades",
    tableName: "SenateTrade",
    group: "Congress",
    description: "Raw Senate trading disclosures before unification into CongressTrade.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "senator", label: "Senator", kind: "politician" },
      { key: "ownerType", label: "Owner" },
      { key: "party", label: "Party" },
      { key: "state", label: "State" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "transactionType", label: "Type" },
      { key: "transactionDate", label: "Trade Date", kind: "date" },
      { key: "reportDate", label: "Reported", kind: "date" },
      { key: "amountMinCents", label: "Min", kind: "cents" },
      { key: "amountMaxCents", label: "Max", kind: "cents" },
      { key: "ownerName", label: "Owner Name" },
      { key: "documentId", label: "Document", kind: "hash" },
    ],
    searchableColumns: ["senator", "ticker", "transactionType", "state", "ownerType", "ownerName", "ownerRaw", "documentId"],
    defaultSort: { key: "transactionDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("senator", "Senator", "Entity"),
      textFilter("ticker", "Ticker", "Entity"),
      enumFilter("ownerType", "Owner", "Relevance", ownerTypeOptions),
      textFilter("ownerName", "Owner Name", "Supplemental"),
      textFilter("ownerRaw", "Raw Owner", "Supplemental"),
      enumFilter("party", "Party", "Direction", [
        { label: "Democrat", value: "D" },
        { label: "Republican", value: "R" },
      ]),
      textFilter("state", "State", "Entity"),
      enumFilter("transactionType", "Trade Type", "Direction", [
        { label: "Purchase", value: "Purchase" },
        { label: "Sale", value: "Sale" },
        { label: "Exchange", value: "Exchange" },
      ]),
      dateFilter("transactionDate", "Trade Date"),
      dateFilter("reportDate", "Report Date"),
      numberFilter("amountMinCents", "Minimum Amount", "Magnitude", disclosureAmountRangeOptions),
      numberFilter("amountMaxCents", "Maximum Amount", "Magnitude", disclosureAmountRangeOptions),
      presenceFilter("filingUrl", "Has Filing Link", "Supplemental"),
      presenceFilter("documentId", "Has Document ID", "Supplemental"),
    ],
  },
  {
    slug: "house-trades",
    label: "House Trades",
    tableName: "HouseTrade",
    group: "Congress",
    description: "Raw House trading disclosures before unification into CongressTrade.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "representative", label: "Representative", kind: "politician" },
      { key: "ownerType", label: "Owner" },
      { key: "party", label: "Party" },
      { key: "state", label: "State" },
      { key: "district", label: "District" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "transactionType", label: "Type" },
      { key: "transactionDate", label: "Trade Date", kind: "date" },
      { key: "reportDate", label: "Reported", kind: "date" },
      { key: "ownerName", label: "Owner Name" },
      { key: "documentId", label: "Document", kind: "hash" },
    ],
    searchableColumns: ["representative", "ticker", "transactionType", "state", "district", "ownerType", "ownerName", "ownerRaw", "documentId"],
    defaultSort: { key: "transactionDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("representative", "Representative", "Entity"),
      textFilter("ticker", "Ticker", "Entity"),
      enumFilter("ownerType", "Owner", "Relevance", ownerTypeOptions),
      textFilter("ownerName", "Owner Name", "Supplemental"),
      textFilter("ownerRaw", "Raw Owner", "Supplemental"),
      enumFilter("party", "Party", "Direction", [
        { label: "Democrat", value: "D" },
        { label: "Republican", value: "R" },
      ]),
      textFilter("state", "State", "Entity"),
      textFilter("district", "District", "Supplemental"),
      textFilter("transactionType", "Trade Type", "Direction"),
      dateFilter("transactionDate", "Trade Date"),
      dateFilter("reportDate", "Report Date"),
      presenceFilter("filingUrl", "Has Filing Link", "Supplemental"),
      presenceFilter("documentId", "Has Document ID", "Supplemental"),
    ],
  },
  {
    slug: "executive-trades",
    label: "Executive Trades",
    tableName: "ExecutiveTrade",
    group: "Executive",
    description: "Periodic transaction reports from executive-branch officials (OGE-278) via Open Cabinet.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      // `kind: "official"` links to /officials/<officialId>. DatasetTable
      // resolves the id via row.officialId (NOT row.id, which is the trade id).
      { key: "official", label: "Official", kind: "official" },
      { key: "agency", label: "Agency" },
      { key: "title", label: "Title" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "transactionType", label: "Type" },
      { key: "transactionDate", label: "Trade Date", kind: "date" },
      { key: "amountMinCents", label: "Min", kind: "cents" },
      { key: "amountMaxCents", label: "Max", kind: "cents" },
      { key: "amountMidCents", label: "Mid", kind: "cents" },
      { key: "lateFilingFlag", label: "Late" },
      { key: "assetDescription", label: "Asset" },
      { key: "amountRangeRaw", label: "Range" },
    ],
    searchableColumns: ["ticker", "transactionType", "assetDescription", "amountRangeRaw"],
    defaultSort: { key: "transactionDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      numberFilter("officialId", "Official ID", "Entity"),
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("assetDescription", "Asset", "Entity"),
      enumFilter("transactionType", "Trade Type", "Direction", [
        { label: "Purchase", value: "Purchase" },
        { label: "Sale", value: "Sale" },
        { label: "Sale (Partial)", value: "Sale (Partial)" },
        { label: "Sale (Full)", value: "Sale (Full)" },
        { label: "Exchange", value: "Exchange" },
      ]),
      dateFilter("transactionDate", "Trade Date"),
      numberFilter("amountMinCents", "Minimum Amount", "Magnitude", disclosureAmountRangeOptions),
      numberFilter("amountMaxCents", "Maximum Amount", "Magnitude", disclosureAmountRangeOptions),
      booleanFilter("lateFilingFlag", "Late Filing", "Relevance"),
      textFilter("source", "Source", "Supplemental"),
    ],
  },
  {
    slug: "executive-officials",
    label: "Executive Officials",
    tableName: "ExecutiveOfficial",
    group: "Reference",
    description: "Normalized executive-branch officials (Cabinet, agency heads) used to join executive trades.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      // `kind: "official"` links to /officials/<id> where id is the row id.
      { key: "name", label: "Name", kind: "official" },
      { key: "title", label: "Title" },
      { key: "agency", label: "Agency" },
      { key: "party", label: "Party" },
      { key: "level", label: "Level" },
      { key: "filingType", label: "Filing Type" },
      { key: "tookOfficeDate", label: "Took Office", kind: "date" },
      { key: "departedDate", label: "Departed", kind: "date" },
      { key: "mostRecentFilingDate", label: "Last Filing", kind: "date" },
      { key: "slug", label: "Slug", kind: "hash" },
      { key: "source", label: "Source" },
    ],
    searchableColumns: ["name", "title", "slug", "party", "level", "filingType"],
    defaultSort: { key: "mostRecentFilingDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("name", "Name", "Entity"),
      textFilter("title", "Title", "Relevance"),
      numberFilter("agencyId", "Agency ID", "Entity"),
      enumFilter("party", "Party", "Direction", [
        { label: "Democrat", value: "D" },
        { label: "Republican", value: "R" },
        { label: "Independent", value: "I" },
      ]),
      textFilter("level", "Level", "Relevance"),
      textFilter("filingType", "Filing Type", "Supplemental"),
      dateFilter("tookOfficeDate", "Took Office"),
      dateFilter("departedDate", "Departed"),
      dateFilter("mostRecentFilingDate", "Last Filing"),
      presenceFilter("departedDate", "Departed", "Direction"),
    ],
  },
  {
    slug: "executive-agencies",
    label: "Executive Agencies",
    tableName: "ExecutiveAgency",
    group: "Reference",
    description: "Cabinet departments and federal agencies referenced by executive officials.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "name", label: "Name" },
      { key: "createdAt", label: "Created", kind: "date" },
      { key: "updatedAt", label: "Updated", kind: "date" },
    ],
    searchableColumns: ["name"],
    defaultSort: { key: "name", dir: "asc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("name", "Agency", "Entity"),
      dateFilter("createdAt", "Created"),
      dateFilter("updatedAt", "Updated"),
    ],
  },
  {
    slug: "insider-trades",
    label: "Insider Trades",
    tableName: "InsiderTrade",
    group: "Alternative Data",
    description: "Corporate insider trading activity by ticker, title, shares, and value.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "insiderName", label: "Insider" },
      { key: "insiderTitle", label: "Title" },
      { key: "transactionType", label: "Type" },
      { key: "transactionDate", label: "Trade Date", kind: "date" },
      { key: "shares", label: "Shares", kind: "number" },
      { key: "pricePerShareCents", label: "Price", kind: "cents" },
      { key: "totalValueCents", label: "Value", kind: "cents" },
    ],
    searchableColumns: ["ticker", "insiderName", "insiderTitle", "transactionType"],
    defaultSort: { key: "transactionDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("insiderName", "Insider", "Entity"),
      textFilter("insiderTitle", "Title", "Relevance"),
      textFilter("transactionType", "Trade Type", "Direction"),
      dateFilter("transactionDate", "Trade Date"),
      numberFilter("shares", "Shares"),
      numberFilter("pricePerShareCents", "Price Per Share"),
      numberFilter("totalValueCents", "Total Value"),
    ],
  },
  {
    slug: "lobbying-disclosures",
    label: "Lobbying Disclosures",
    tableName: "LobbyingDisclosure",
    group: "Alternative Data",
    description: "Lobbying spend by client, registrant, ticker, issue, and filing period.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "client", label: "Client" },
      { key: "registrant", label: "Registrant" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "amountCents", label: "Amount", kind: "cents" },
      { key: "filingYear", label: "Year", kind: "number" },
      { key: "filingQuarter", label: "Qtr", kind: "number" },
      { key: "filingType", label: "Type" },
      { key: "filedAt", label: "Filed", kind: "date" },
    ],
    searchableColumns: ["client", "registrant", "ticker", "filingType"],
    defaultSort: { key: "filedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("client", "Client", "Entity"),
      textFilter("registrant", "Registrant", "Entity"),
      textFilter("ticker", "Ticker", "Entity"),
      numberFilter("amountCents", "Spend"),
      numberFilter("filingYear", "Filing Year", "Time"),
      numberFilter("filingQuarter", "Quarter", "Time"),
      textFilter("filingType", "Filing Type", "Direction"),
      dateFilter("filedAt", "Filed"),
    ],
  },
  {
    slug: "wsb-mentions",
    label: "WSB Mentions",
    tableName: "WsbMention",
    group: "Alternative Data",
    description: "WallStreetBets mention counts and sentiment by ticker and date.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "date", label: "Date", kind: "date" },
      { key: "mentions", label: "Mentions", kind: "number" },
      { key: "sentiment", label: "Sentiment", kind: "number" },
      { key: "rank", label: "Rank", kind: "number" },
    ],
    searchableColumns: ["ticker"],
    defaultSort: { key: "date", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      dateFilter("date", "Date"),
      numberFilter("mentions", "Mentions"),
      numberFilter("sentiment", "Sentiment"),
      numberFilter("rank", "Rank"),
    ],
  },
  {
    slug: "twitter-mentions",
    label: "Twitter Mentions",
    tableName: "TwitterMention",
    group: "Alternative Data",
    description: "Social mention counts, sentiment, and follower reach by ticker and date.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "date", label: "Date", kind: "date" },
      { key: "mentions", label: "Mentions", kind: "number" },
      { key: "sentiment", label: "Sentiment", kind: "number" },
      { key: "followers", label: "Followers", kind: "number" },
    ],
    searchableColumns: ["ticker"],
    defaultSort: { key: "date", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      dateFilter("date", "Date"),
      numberFilter("mentions", "Mentions"),
      numberFilter("sentiment", "Sentiment"),
      numberFilter("followers", "Followers"),
    ],
  },
  {
    slug: "gov-contracts",
    label: "Government Contracts",
    tableName: "GovContract",
    group: "Alternative Data",
    description: "Federal contract awards connected to public company tickers.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "agency", label: "Agency" },
      { key: "amountCents", label: "Amount", kind: "cents" },
      { key: "awardedAt", label: "Awarded", kind: "date" },
      { key: "contractId", label: "Contract", kind: "hash" },
      { key: "description", label: "Description" },
    ],
    searchableColumns: ["ticker", "agency", "contractId", "description"],
    defaultSort: { key: "awardedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("agency", "Agency", "Entity"),
      numberFilter("amountCents", "Award Amount"),
      dateFilter("awardedAt", "Awarded"),
      presenceFilter("contractId", "Has Contract ID", "Relevance"),
      textFilter("description", "Description", "Supplemental"),
    ],
  },
  {
    slug: "patents",
    label: "Patents",
    tableName: "Patent",
    group: "Alternative Data",
    description: "Patent filings and grants by ticker, number, inventor, and abstract.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "patentNumber", label: "Patent", kind: "hash" },
      { key: "title", label: "Title" },
      { key: "filedAt", label: "Filed", kind: "date" },
      { key: "grantedAt", label: "Granted", kind: "date" },
      { key: "inventors", label: "Inventors" },
    ],
    searchableColumns: ["ticker", "patentNumber", "title", "inventors"],
    defaultSort: { key: "grantedAt", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("patentNumber", "Patent", "Supplemental"),
      textFilter("title", "Title", "Entity"),
      dateFilter("filedAt", "Filed"),
      dateFilter("grantedAt", "Granted"),
      textFilter("inventors", "Inventors", "Supplemental"),
    ],
  },
  {
    slug: "off-exchange-activity",
    label: "Off Exchange Activity",
    tableName: "OffExchangeActivity",
    group: "Alternative Data",
    description: "Short volume, total volume, and dark-pool share by ticker and date.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "date", label: "Date", kind: "date" },
      { key: "shortVolume", label: "Short Vol", kind: "number" },
      { key: "totalVolume", label: "Total Vol", kind: "number" },
      { key: "shortVolumePercent", label: "Short %", kind: "percent" },
      { key: "darkPoolPercent", label: "Dark Pool %", kind: "percent" },
    ],
    searchableColumns: ["ticker"],
    defaultSort: { key: "date", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      dateFilter("date", "Date"),
      numberFilter("shortVolume", "Short Volume"),
      numberFilter("totalVolume", "Total Volume"),
      numberFilter("shortVolumePercent", "Short Volume %"),
      numberFilter("darkPoolPercent", "Dark Pool %"),
    ],
  },
  {
    slug: "thirteen-f-holdings",
    label: "13F Holdings",
    tableName: "ThirteenFHolding",
    group: "Alternative Data",
    description: "Institutional 13F holdings, value, report date, and share changes.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "filer", label: "Filer" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "shares", label: "Shares", kind: "number" },
      { key: "valueCents", label: "Value", kind: "cents" },
      { key: "filingDate", label: "Filing", kind: "date" },
      { key: "reportDate", label: "Report", kind: "date" },
      { key: "changeShares", label: "Change", kind: "number" },
    ],
    searchableColumns: ["filer", "ticker"],
    defaultSort: { key: "reportDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("filer", "Filer", "Entity"),
      textFilter("ticker", "Ticker", "Entity"),
      numberFilter("shares", "Shares"),
      numberFilter("valueCents", "Value"),
      dateFilter("filingDate", "Filing"),
      dateFilter("reportDate", "Report"),
      numberFilter("changeShares", "Share Change"),
    ],
  },
  {
    slug: "spacs",
    label: "SPACs",
    tableName: "Spac",
    group: "Alternative Data",
    description: "SPAC profile, IPO date, trust value, status, and target ticker.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "name", label: "Name" },
      { key: "ipoDate", label: "IPO", kind: "date" },
      { key: "trustValueCents", label: "Trust", kind: "cents" },
      { key: "status", label: "Status" },
      { key: "targetTicker", label: "Target", kind: "ticker" },
    ],
    searchableColumns: ["ticker", "name", "status", "targetTicker"],
    defaultSort: { key: "ticker", dir: "asc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      textFilter("name", "Name", "Entity"),
      dateFilter("ipoDate", "IPO Date"),
      numberFilter("trustValueCents", "Trust Value"),
      textFilter("status", "Status", "Direction"),
      presenceFilter("targetTicker", "Has Target", "Relevance"),
    ],
  },
  {
    slug: "wikipedia-views",
    label: "Wikipedia Views",
    tableName: "WikipediaView",
    group: "Alternative Data",
    description: "Wikipedia page-view counts by ticker and date.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "date", label: "Date", kind: "date" },
      { key: "views", label: "Views", kind: "number" },
    ],
    searchableColumns: ["ticker"],
    defaultSort: { key: "date", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      dateFilter("date", "Date"),
      numberFilter("views", "Views"),
    ],
  },
  {
    slug: "political-beta",
    label: "Political Beta",
    tableName: "PoliticalBeta",
    group: "Alternative Data",
    description: "Ticker-level political sensitivity scores by as-of date.",
    columns: [
      { key: "id", label: "ID", kind: "number" },
      { key: "ticker", label: "Ticker", kind: "ticker" },
      { key: "beta", label: "Beta", kind: "number" },
      { key: "asOfDate", label: "As Of", kind: "date" },
    ],
    searchableColumns: ["ticker"],
    defaultSort: { key: "asOfDate", dir: "desc" },
    filterGroups: commonGroups,
    filters: [
      textFilter("ticker", "Ticker", "Entity"),
      numberFilter("beta", "Beta"),
      dateFilter("asOfDate", "As Of"),
    ],
  },
] satisfies DatasetDefinition[];

export function getDatasetDefinition(slug: string) {
  return DATASET_DEFINITIONS.find((dataset) => dataset.slug === slug);
}

export function normalizeDatasetPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "1", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function formatDatasetValue(value: unknown, column: DatasetColumn) {
  if (value === null || value === undefined || value === "") return "-";

  switch (column.kind) {
    case "ticker":
      return `$${String(value).toUpperCase()}`;
    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : format(date, "MMM d, yyyy");
    }
    case "cents":
      return formatCents(value);
    case "number":
      return formatNumber(value);
    case "percent":
      return `${formatNumber(value, 2)}%`;
    case "hash": {
      const text = String(value);
      return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-4)}` : text;
    }
    default:
      return String(value);
  }
}

function formatCents(value: unknown) {
  const cents = Number(value);

  if (!Number.isFinite(cents)) return String(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatNumber(value: unknown, maximumFractionDigits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(number);
}
