export type Party = "D" | "R";
export type TradeType = "Buy" | "Sell" | "Exchange";
/**
 * "congress" — disclosed via the Stock Act (House/Senate). Backed by
 *   CongressTrade rows.
 * "executive" — disclosed by executive-branch officials (OGE Form 278).
 *   Backed by ExecutiveTrade rows.
 */
export type Branch = "congress" | "executive";

/** A chamber-like label. Widened from "House" | "Senate" to also cover
 *  executive officials (rendered as the agency name or "Executive"). */
export type ChamberOrBranch = "House" | "Senate" | "Executive";

export type SortKey =
  | "politician"
  | "ticker"
  | "company"
  | "type"
  | "amount"
  | "filedDate"
  | "transactionDate";

export type SortDir = "asc" | "desc";

export type Politician = {
  id: string;
  name: string;
  party: Party;
  state: string;
  chamber: "House" | "Senate";
  role: string;
  committees: string[];
  district?: string;
};

export type Trade = {
  /**
   * Globally unique. Either a CongressTrade id ("cong-<n>") or an
   * ExecutiveTrade id ("exec-<n>"). Legacy callers may also pass a
   * bare numeric string for congress rows — see `parseTradeId`.
   */
  id: string;
  /** Which feed the row came from. */
  branch: Branch;
  /**
   * For congress: `"P-<politicianId>"`. For executive: `"O-<officialId>"`.
   * `/politicians/[id]` only resolves the congress form today; executive
   * links are best avoided until a dedicated /executive/[slug] page exists.
   */
  politicianId: string;
  politicianName: string;
  /** Null for executive officials whose party isn't known/applicable. */
  party: Party | null;
  /** State for congress; agency name for executive; "-" if unknown. */
  state: string;
  chamber: ChamberOrBranch;
  ticker: string;
  companyName: string;
  sector: string;
  tradeType: TradeType;
  amount: string;
  amountMin: number;
  amountMax: number;
  filedDate: string;
  transactionDate: string;
  description: string;
  filingUrl: string;
};

export type PoliticianSummary = Politician & {
  totalTrades: number;
  totalVolume: number;
  latestFiledDate: string;
  buyCount: number;
  sellCount: number;
  sparkline: Array<{ date: string; value: number }>;
};

export type TradeQuery = {
  q?: string;
  party?: Party | "all";
  type?: TradeType | "all";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: SortKey;
  dir?: SortDir;
  politicianId?: string;
};

export type TradeQueryResult = {
  items: Trade[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};
