export type QuiverTrade = {
  Representative: string;
  Ticker: string;
  Transaction: string;
  TransactionDate: string;
  ReportDate?: string;
  Disclosed?: string;
  Range?: string;
  Amount?: string | number;
  House?: "House" | "Senate";
  Party?: string;
  State?: string;
  AssetDescription?: string;
  BioGuideID?: string;
  Name?: string;
  Traded?: string;
  Filed?: string;
  last_modified?: string;
  Chamber?: string;
  Company?: string | null;
  Description?: string | null;
  Trade_Size_USD?: string | number;
  Owner?: string | null;
  OwnerType?: string | null;
  OwnerName?: string | null;
  OwnerRaw?: string | null;
  FilingUrl?: string | null;
  FilingURL?: string | null;
  DocumentId?: string | null;
  DocumentID?: string | number | null;
};

export type QuiverSenateTrade = {
  Senator: string;
  Ticker: string;
  Transaction: string;
  TransactionDate?: string;
  Date?: string;
  ReportDate?: string;
  last_modified?: string;
  Range?: string;
  Amount?: string | number;
  Party?: string;
  State?: string;
  Comments?: string;
  Owner?: string | null;
  OwnerType?: string | null;
  OwnerName?: string | null;
  FilingUrl?: string | null;
  FilingURL?: string | null;
  DocumentId?: string | null;
  DocumentID?: string | number | null;
};

export type QuiverHouseTrade = {
  Representative: string;
  Ticker: string;
  Transaction: string;
  TransactionDate?: string;
  Date?: string;
  ReportDate?: string;
  last_modified?: string;
  Range?: string;
  Amount?: string | number;
  Party?: string;
  State?: string;
  District?: string;
  Owner?: string | null;
  OwnerType?: string | null;
  OwnerName?: string | null;
  FilingUrl?: string | null;
  FilingURL?: string | null;
  DocumentId?: string | null;
  DocumentID?: string | number | null;
};

export type QuiverWsbMention = {
  Ticker: string;
  Date?: string;
  Mentions?: number | string;
  Count?: number | string;
  Sentiment?: number | string;
  Rank?: number | string;
};

export type QuiverTwitterMention = {
  Ticker: string;
  Date: string;
  Mentions: number;
  Sentiment?: number;
  Followers?: number;
};

export type QuiverSpac = {
  Ticker: string;
  Name?: string;
  IpoDate?: string;
  TrustValue?: number;
  Status?: string;
  TargetTicker?: string;
};

export type QuiverPoliticalBeta = {
  Ticker: string;
  TrumpBeta?: number | string;
  TrumpOdds?: number | string;
  Beta?: number | string;
  AsOfDate?: string;
};

export type QuiverWikipediaView = {
  Ticker: string;
  Date: string;
  Views: number;
};

export type QuiverPatent = {
  Ticker: string;
  PatentNumber?: string;
  Title?: string;
  Date?: string;
  FiledAt?: string;
  GrantedAt?: string;
  Inventors?: string | string[];
  Abstract?: string;
  IPC?: string;
  Claims?: number;
};

export type QuiverGovContract = {
  Ticker: string;
  Agency?: string;
  Description?: string;
  Amount?: number | string;
  AwardedAt?: string;
  ContractId?: string;
  Year?: number;
  Qtr?: number;
};

export type QuiverThirteenFHolding = {
  Filer?: string;
  Fund?: string;
  Name?: string;
  Ticker: string;
  Shares?: number | string;
  Held?: number | string;
  Held_Normalized?: number | string;
  Value?: number | string;
  Close?: number | string;
  FilingDate?: string;
  Date?: string;
  ReportDate?: string;
  ReportPeriod?: string;
  ChangeShares?: number | string;
  ChangeShare?: number | string;
  Change_Share?: number | string;
  Class?: string;
  Direction?: string;
  "SH/PRN"?: string;
  "Put/Call"?: string;
};

export type QuiverOffExchangeActivity = {
  Ticker: string;
  Date: string;
  ShortVolume?: number | string;
  TotalVolume?: number | string;
  ShortVolumePercent?: number | string;
  DarkPoolPercent?: number | string;
  OTC_Short?: number | string;
  OTC_Total?: number | string;
  DPI?: number | string;
};

export type QuiverInsiderTrade = {
  Ticker: string;
  Name: string;
  Title?: string;
  Transaction?: string;
  TransactionCode?: string;
  AcquiredDisposedCode?: string;
  Date: string;
  FilingDate?: string;
  fileDate?: string;
  Shares?: number | string;
  PricePerShare?: number | string;
  TotalValue?: number | string;
  SharesOwnedAfter?: number | string;
  SharesOwnedFollowing?: number | string;
  FormType?: string;
  officerTitle?: string | null;
  isDirector?: boolean;
  isOfficer?: boolean;
  isOther?: boolean;
  isTenPercentOwner?: boolean;
};

export type QuiverLobbyingDisclosure = {
  Client: string;
  Registrant: string;
  Ticker?: string;
  Amount?: number | string;
  Year?: number;
  Qtr?: number;
  Quarter?: number;
  Type?: string;
  Issues?: string;
  Issue?: string;
  Specific_Issue?: string;
  Date?: string;
  FiledAt?: string;
};
