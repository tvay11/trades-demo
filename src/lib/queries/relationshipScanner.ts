import type { RelationshipFacts, RelationshipPairFact } from "./relationships";

export type RelationshipScannerPair = RelationshipPairFact;

export type RelationshipScannerSummary = {
  pairCount: number;
  pairEventCount: number;
  tickerCount: number;
  politicianCount: number;
  sameDirectionPercent: number;
  oppositeDirectionPercent: number;
};

export type RelationshipScannerGroup = {
  title: string;
  subtitle: string;
  empty: string;
  tone: "neutral" | "positive" | "negative" | "accent";
  pairs: RelationshipScannerPair[];
};

type RelationshipSummaryInput = Pick<
  RelationshipFacts["summary"],
  | "pairCount"
  | "pairEventCount"
  | "tickerCount"
  | "politicianCount"
  | "sameDirectionCount"
  | "oppositeDirectionCount"
>;

export function buildRelationshipScannerSummary(
  summary: RelationshipSummaryInput,
): RelationshipScannerSummary {
  const directionalTotal = summary.sameDirectionCount + summary.oppositeDirectionCount;

  return {
    pairCount: summary.pairCount,
    pairEventCount: summary.pairEventCount,
    tickerCount: summary.tickerCount,
    politicianCount: summary.politicianCount,
    sameDirectionPercent: percentOf(summary.sameDirectionCount, directionalTotal),
    oppositeDirectionPercent: percentOf(summary.oppositeDirectionCount, directionalTotal),
  };
}

export function buildRelationshipScannerGroups(
  pairs: RelationshipScannerPair[],
): RelationshipScannerGroup[] {
  const sameDirection = pairs
    .filter((pair) => pair.sameDirectionCount > pair.oppositeDirectionCount)
    .sort(sortRelationshipPairs);
  const oppositeDirection = pairs
    .filter((pair) => pair.oppositeDirectionCount > pair.sameDirectionCount)
    .sort(sortRelationshipPairs);
  const mixed = pairs
    .filter((pair) => pair.sameDirectionCount === pair.oppositeDirectionCount)
    .sort(sortRelationshipPairs);

  return [
    {
      title: "Same Direction",
      subtitle: "Pairs mostly buying or selling the same ticker in the same window.",
      empty: "No pairs are mostly aligned in this window.",
      tone: "positive",
      pairs: sameDirection,
    },
    {
      title: "Opposite Direction",
      subtitle: "Pairs trading against each other on the same ticker.",
      empty: "No pairs are mostly opposite in this window.",
      tone: "negative",
      pairs: oppositeDirection,
    },
    {
      title: "Mixed / Watchlist",
      subtitle: "Pairs with balanced same-direction and opposite-direction events.",
      empty: "No mixed relationship rows in this window.",
      tone: "accent",
      pairs: mixed,
    },
  ];
}

function sortRelationshipPairs(a: RelationshipScannerPair, b: RelationshipScannerPair) {
  return (
    b.sharedTradeCount - a.sharedTradeCount ||
    b.sharedTickerCount - a.sharedTickerCount ||
    b.estimatedVolume - a.estimatedVolume
  );
}

function percentOf(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
