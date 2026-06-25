export type CommitteeContext = {
  name: string;
  role?: string | null;
  isChair?: boolean | null;
  isRanking?: boolean | null;
};

export type CommitteeRelevanceInput = {
  ticker: string;
  sector?: string | null;
  industry?: string | null;
  committees: CommitteeContext[];
};

export type CommitteeRelevance = {
  score: number;
  label: "High" | "Medium" | "Low";
  matches: string[];
  reasons: string[];
};

type Jurisdiction = {
  committeeTerms: string[];
  sectors: string[];
  industries: string[];
  tickers: string[];
  themes: string[];
};

export const COMMITTEE_JURISDICTIONS: Jurisdiction[] = [
  {
    committeeTerms: ["armed services", "defense", "homeland security", "intelligence"],
    sectors: ["Industrials", "Technology"],
    industries: ["Aerospace & Defense", "Defense", "Security", "Cybersecurity"],
    tickers: ["BA", "LMT", "RTX", "NOC", "GD", "HII", "PLTR", "CRWD", "PANW", "NVDA"],
    themes: ["defense", "national security", "cyber", "chips"],
  },
  {
    committeeTerms: ["energy", "natural resources", "environment", "climate"],
    sectors: ["Energy", "Utilities", "Basic Materials"],
    industries: ["Oil", "Gas", "Renewable", "Solar", "Nuclear", "Electric"],
    tickers: ["XOM", "CVX", "COP", "NEE", "DUK", "SO", "ENPH", "FSLR", "CCJ", "CEG"],
    themes: ["energy", "oil", "gas", "renewables", "nuclear"],
  },
  {
    committeeTerms: ["commerce", "science", "transportation", "judiciary", "technology"],
    sectors: ["Technology", "Communication Services", "Consumer Cyclical"],
    industries: ["Semiconductor", "Software", "Internet", "Telecom", "Electronic"],
    tickers: ["NVDA", "AMD", "INTC", "AVGO", "MSFT", "GOOGL", "META", "AAPL", "TSLA", "AMZN"],
    themes: ["semiconductors", "ai", "platforms", "telecom"],
  },
  {
    committeeTerms: ["health", "finance", "ways and means", "aging"],
    sectors: ["Healthcare"],
    industries: ["Biotechnology", "Drug", "Pharma", "Medical", "Health"],
    tickers: ["LLY", "UNH", "PFE", "MRK", "ABBV", "JNJ", "AMGN", "GILD", "HUM", "CI"],
    themes: ["healthcare", "medicare", "drug pricing"],
  },
  {
    committeeTerms: ["banking", "financial services", "finance", "budget"],
    sectors: ["Financial Services", "Real Estate"],
    industries: ["Bank", "Capital Markets", "Insurance", "Mortgage", "Asset Management"],
    tickers: ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "BRK.B", "SCHW", "COF"],
    themes: ["banking", "credit", "markets"],
  },
  {
    committeeTerms: ["agriculture"],
    sectors: ["Consumer Defensive", "Basic Materials"],
    industries: ["Agricultural", "Food", "Farm", "Fertilizer"],
    tickers: ["DE", "ADM", "BG", "MOS", "NTR", "CF", "TSN", "CAG", "GIS", "K"],
    themes: ["farm", "food", "fertilizer"],
  },
];

export function scoreCommitteeRelevance(input: CommitteeRelevanceInput): CommitteeRelevance {
  const ticker = input.ticker.trim().toUpperCase();
  const sector = normalize(input.sector);
  const industry = normalize(input.industry);
  const matches = new Set<string>();
  const reasons = new Set<string>();
  let score = 0;

  for (const committee of input.committees) {
    const committeeName = normalize(committee.name);
    const jurisdiction = COMMITTEE_JURISDICTIONS.find((candidate) =>
      candidate.committeeTerms.some((term) => committeeName.includes(normalize(term))),
    );

    if (!jurisdiction) continue;

    const tickerMatch = jurisdiction.tickers.includes(ticker);
    const sectorMatch = jurisdiction.sectors.some((value) => normalize(value) === sector);
    const industryMatch = jurisdiction.industries.some((value) => industry.includes(normalize(value)));

    if (!tickerMatch && !sectorMatch && !industryMatch) continue;

    matches.add(committee.name);

    if (tickerMatch) {
      score += 55;
      reasons.add("Committee jurisdiction matches ticker");
    }
    if (sectorMatch || industryMatch) {
      score += 35;
      reasons.add("Committee jurisdiction matches sector or industry");
    }
    if (committee.isChair || normalize(committee.role).includes("chair")) {
      score += 18;
      reasons.add("Chair role increases committee edge");
    } else if (committee.isRanking || normalize(committee.role).includes("ranking")) {
      score += 14;
      reasons.add("Ranking role increases committee edge");
    } else {
      score += 10;
    }
  }

  const bounded = Math.min(100, Math.round(score));

  return {
    score: bounded,
    label: bounded >= 75 ? "High" : bounded >= 35 ? "Medium" : "Low",
    matches: [...matches],
    reasons: [...reasons],
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}
