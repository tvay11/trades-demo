import { db } from "@/lib/db";

type LegislatorTerm = {
  type: string;
  state: string;
  start: string;
  end: string;
};

type Legislator = {
  id: {
    bioguide: string;
  };
  terms: LegislatorTerm[];
};

async function fetchLegislators(url: string): Promise<Legislator[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
}

export async function syncPoliticianStates() {
  console.log("Fetching legislators data from github...");
  const current = await fetchLegislators("https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json");
  const historical = await fetchLegislators("https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-historical.json");
  
  const allLegislators = [...current, ...historical];
  
  // Map bioguide to latest state
  const bioguideToState = new Map<string, string>();
  for (const leg of allLegislators) {
    if (leg.id && leg.id.bioguide && leg.terms && leg.terms.length > 0) {
      // get the most recent term
      const lastTerm = leg.terms[leg.terms.length - 1];
      if (lastTerm && lastTerm.state) {
        bioguideToState.set(leg.id.bioguide, lastTerm.state);
      }
    }
  }

  const politicians = await db.politician.findMany({
    where: { bioguideId: { not: null } }
  });

  let updated = 0;
  for (const pol of politicians) {
    if (pol.bioguideId && bioguideToState.has(pol.bioguideId)) {
      const state = bioguideToState.get(pol.bioguideId)!;
      if (pol.state !== state) {
        await db.politician.update({
          where: { id: pol.id },
          data: { state }
        });
        updated++;
      }
    }
  }

  return { processed: politicians.length, updated };
}
