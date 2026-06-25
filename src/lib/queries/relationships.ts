import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";
import { minimumDollars } from "@/lib/money";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_TRADE_LIMIT = 4_000;
const DAY_MS = 86_400_000;

export type TradeAction = "buy" | "sell" | "other";

/**
 * Stable identifier for a relationship-graph node. Numbers come from
 * congressional Politician.id; strings come from executive officials with
 * the "O-<officialId>" shape so they don't collide with politician IDs.
 */
export type RelationshipNodeId = number | string;

export type RelationshipTradeInput = {
  id: string;
  politicianId: RelationshipNodeId;
  politicianName: string;
  party: string | null;
  state: string | null;
  ticker: string;
  companyName: string | null;
  sector: string | null;
  transactionType: string;
  action: TradeAction;
  transactionDate: Date;
  disclosureDate: Date;
  amountMinimum: number;
  amountRangeRaw: string | null;
  committees: string[];
};

export type RelationshipPolitician = {
  id: RelationshipNodeId;
  name: string;
  party: string | null;
  state: string | null;
};

export type RelationshipExample = {
  ticker: string;
  companyName: string | null;
  direction: "same" | "opposite" | "mixed";
  daysBetween: number;
  transactionDateA: Date;
  transactionDateB: Date;
  disclosureDateA: Date;
  disclosureDateB: Date;
  actionA: TradeAction;
  actionB: TradeAction;
  amountA: number;
  amountB: number;
};

export type RelationshipTickerHighlight = {
  ticker: string;
  companyName: string | null;
  count: number;
};

export type RelationshipPairFact = {
  pairKey: string;
  politicianA: RelationshipPolitician;
  politicianB: RelationshipPolitician;
  sharedTradeCount: number;
  sharedTickerCount: number;
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  buyTogetherCount: number;
  sellTogetherCount: number;
  estimatedVolume: number;
  latestActivityDate: Date;
  sharedCommittees: string[];
  tickerHighlights: RelationshipTickerHighlight[];
  examples: RelationshipExample[];
};

export type RelationshipClusterFact = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  politicianCount: number;
  pairCount: number;
  pairEventCount: number;
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  estimatedVolume: number;
  latestActivityDate: Date;
  politicians: RelationshipPolitician[];
};

export type RelationshipNetworkNode = RelationshipPolitician & {
  pairEventCount: number;
  connectionCount: number;
};

export type RelationshipNetworkLink = {
  source: RelationshipNodeId;
  target: RelationshipNodeId;
  pairEventCount: number;
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  tickerHighlights: RelationshipTickerHighlight[];
};

export type RelationshipFacts = {
  source: "database" | "empty";
  generatedAt: Date;
  windowDays: number;
  tradeCount: number;
  summary: {
    tradeCount: number;
    pairCount: number;
    pairEventCount: number;
    tickerCount: number;
    politicianCount: number;
    sameDirectionCount: number;
    oppositeDirectionCount: number;
  };
  pairs: RelationshipPairFact[];
  clusters: RelationshipClusterFact[];
  network: {
    nodes: RelationshipNetworkNode[];
    links: RelationshipNetworkLink[];
  };
};

type RelationshipOptions = {
  windowDays?: number;
  ticker?: string | null;
  limit?: number;
};

type PairEvent = {
  pairKey: string;
  politicianA: RelationshipPolitician;
  politicianB: RelationshipPolitician;
  tradeA: RelationshipTradeInput;
  tradeB: RelationshipTradeInput;
  ticker: string;
  companyName: string | null;
  sector: string | null;
  direction: "same" | "opposite" | "mixed";
  daysBetween: number;
  estimatedVolume: number;
  latestActivityDate: Date;
  sharedCommittees: string[];
};

export async function getRelationshipFacts(
  options: RelationshipOptions = {},
): Promise<RelationshipFacts> {
  "use cache";
  applyCacheLife("minutes");

  const windowDays = normalizeWindow(options.windowDays);
  const ticker = options.ticker?.trim().toUpperCase();

  try {
    const tradeLimit = options.limit ?? DEFAULT_TRADE_LIMIT;
    const [rows, executiveRows] = await Promise.all([
      db.congressTrade.findMany({
        where: ticker ? { ticker } : undefined,
        orderBy: { transactionDate: "desc" },
        take: tradeLimit,
        include: {
          politician: {
            include: {
              committees: {
                include: { committee: true },
              },
            },
          },
        },
      }),
      // Executive officials enter the graph as nodes with `id = "O-<n>"`
      // (string), distinguishing them from numeric politicianIds. No
      // committees — executive disclosures join with congressional only
      // by ticker + time window in `findPairEvents`.
      db.executiveTrade.findMany({
        where: {
          ticker: { not: null },
          ...(ticker ? { ticker } : {}),
        },
        orderBy: { transactionDate: "desc" },
        take: tradeLimit,
        include: {
          official: {
            select: {
              id: true,
              name: true,
              party: true,
              agency: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    if (!rows.length && !executiveRows.length) {
      return buildRelationshipFacts([], { windowDays });
    }

    const tickers = [
      ...new Set([
        ...rows.map((row) => row.ticker.toUpperCase()),
        ...executiveRows
          .map((row) => row.ticker?.toUpperCase())
          .filter((t): t is string => t != null),
      ]),
    ];
    const stocks = tickers.length
      ? await db.stock.findMany({ where: { ticker: { in: tickers } } })
      : [];
    const stockByTicker = new Map(stocks.map((stock) => [stock.ticker.toUpperCase(), stock]));

    const congressInputs = rows.map<RelationshipTradeInput>((row) => {
      const normalizedTicker = row.ticker.toUpperCase();
      const stock = stockByTicker.get(normalizedTicker);
      return {
        id: `cong-${row.id}`,
        politicianId: row.politicianId,
        politicianName: row.politician.name ?? row.representative,
        party: row.party ?? row.politician.party,
        state: row.state ?? row.politician.state,
        ticker: normalizedTicker,
        companyName: stock?.companyName ?? row.assetDescription ?? normalizedTicker,
        sector: stock?.sector ?? null,
        transactionType: row.transactionType,
        action: classifyAction(row.transactionType),
        transactionDate: row.transactionDate,
        disclosureDate: row.disclosureDate,
        amountMinimum: minimumDollars(row.amountMinCents, row.amountMaxCents),
        amountRangeRaw: row.amountRangeRaw,
        committees: row.politician.committees.map((a) => a.committee.name),
      };
    });

    const executiveInputs = executiveRows
      .filter((row): row is typeof row & { ticker: string } => row.ticker != null)
      .map<RelationshipTradeInput>((row) => {
        const normalizedTicker = row.ticker.toUpperCase();
        const stock = stockByTicker.get(normalizedTicker);
        return {
          id: `exec-${row.id}`,
          politicianId: `O-${row.official.id}`,
          politicianName: row.official.name,
          party: row.official.party ?? null,
          // Agency goes in the `state` slot for display compatibility; the
          // relationships UI shows this label next to the node name.
          state: row.official.agency?.name ?? null,
          ticker: normalizedTicker,
          companyName: stock?.companyName ?? row.assetDescription ?? normalizedTicker,
          sector: stock?.sector ?? null,
          transactionType: row.transactionType,
          action: classifyAction(row.transactionType),
          transactionDate: row.transactionDate,
          // Executive feeds don't expose a separate disclosure date.
          disclosureDate: row.transactionDate,
          amountMinimum: minimumDollars(row.amountMinCents, row.amountMaxCents),
          amountRangeRaw: row.amountRangeRaw,
          committees: [],
        };
      });

    return buildRelationshipFacts([...congressInputs, ...executiveInputs], { windowDays });
  } catch {
    return buildRelationshipFacts([], { windowDays });
  }
}

export function buildRelationshipFacts(
  trades: RelationshipTradeInput[],
  options: Pick<RelationshipOptions, "windowDays"> = {},
): RelationshipFacts {
  const windowDays = normalizeWindow(options.windowDays);
  const events = findPairEvents(trades, windowDays);
  const pairs = summarizePairs(events);
  const clusters = summarizeClusters(events);

  return {
    source: trades.length ? "database" : "empty",
    generatedAt: new Date(),
    windowDays,
    tradeCount: trades.length,
    summary: {
      tradeCount: trades.length,
      pairCount: pairs.length,
      pairEventCount: events.length,
      tickerCount: new Set(events.map((event) => event.ticker)).size,
      politicianCount: new Set(
        events.flatMap((event) => [event.politicianA.id, event.politicianB.id]),
      ).size,
      sameDirectionCount: events.filter((event) => event.direction === "same").length,
      oppositeDirectionCount: events.filter((event) => event.direction === "opposite").length,
    },
    pairs,
    clusters,
    network: summarizeNetwork(pairs),
  };
}

function findPairEvents(trades: RelationshipTradeInput[], windowDays: number): PairEvent[] {
  const events: PairEvent[] = [];
  const byTicker = groupBy(trades, (trade) => trade.ticker.toUpperCase());

  for (const [ticker, tickerTrades] of byTicker.entries()) {
    const sorted = [...tickerTrades].sort(
      (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime(),
    );

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i];
        const second = sorted[j];
        const daysBetween = dayDiff(first.transactionDate, second.transactionDate);
        if (daysBetween > windowDays) break;
        if (first.politicianId === second.politicianId) continue;

        const [a, b] =
          first.politicianId < second.politicianId ? [first, second] : [second, first];
        const direction = classifyPairDirection(a.action, b.action);

        events.push({
          pairKey: `${a.politicianId}:${b.politicianId}`,
          politicianA: toPolitician(a),
          politicianB: toPolitician(b),
          tradeA: a,
          tradeB: b,
          ticker,
          companyName: a.companyName ?? b.companyName,
          sector: a.sector ?? b.sector,
          direction,
          daysBetween,
          estimatedVolume: a.amountMinimum + b.amountMinimum,
          latestActivityDate:
            a.transactionDate.getTime() > b.transactionDate.getTime()
              ? a.transactionDate
              : b.transactionDate,
          sharedCommittees: intersection(a.committees, b.committees),
        });
      }
    }
  }

  return events;
}

function summarizePairs(events: PairEvent[]): RelationshipPairFact[] {
  return [...groupBy(events, (event) => event.pairKey).entries()]
    .map(([pairKey, pairEvents]) => {
      const tickerHighlights = [...groupBy(pairEvents, (event) => event.ticker).entries()]
        .map(([ticker, rows]) => ({
          ticker,
          companyName: rows[0]?.companyName ?? null,
          count: rows.length,
        }))
        .sort((a, b) => b.count - a.count || a.ticker.localeCompare(b.ticker))
        .slice(0, 5);
      const sharedCommittees = [
        ...new Set(pairEvents.flatMap((event) => event.sharedCommittees)),
      ].sort();

      return {
        pairKey,
        politicianA: pairEvents[0].politicianA,
        politicianB: pairEvents[0].politicianB,
        sharedTradeCount: pairEvents.length,
        sharedTickerCount: tickerHighlights.length,
        sameDirectionCount: pairEvents.filter((event) => event.direction === "same").length,
        oppositeDirectionCount: pairEvents.filter((event) => event.direction === "opposite")
          .length,
        buyTogetherCount: pairEvents.filter(
          (event) => event.tradeA.action === "buy" && event.tradeB.action === "buy",
        ).length,
        sellTogetherCount: pairEvents.filter(
          (event) => event.tradeA.action === "sell" && event.tradeB.action === "sell",
        ).length,
        estimatedVolume: pairEvents.reduce((sum, event) => sum + event.estimatedVolume, 0),
        latestActivityDate: latestDate(pairEvents.map((event) => event.latestActivityDate)),
        sharedCommittees,
        tickerHighlights,
        examples: pairEvents
          .sort(
            (a, b) =>
              b.latestActivityDate.getTime() - a.latestActivityDate.getTime() ||
              b.estimatedVolume - a.estimatedVolume,
          )
          .slice(0, 4)
          .map(toExample),
      } satisfies RelationshipPairFact;
    })
    .sort(
      (a, b) =>
        b.sharedTradeCount - a.sharedTradeCount ||
        b.sharedTickerCount - a.sharedTickerCount ||
        b.estimatedVolume - a.estimatedVolume ||
        a.politicianA.name.localeCompare(b.politicianA.name),
    );
}

function summarizeClusters(events: PairEvent[]): RelationshipClusterFact[] {
  return [...groupBy(events, (event) => event.ticker).entries()]
    .map(([ticker, rows]) => {
      const politicianById = new Map<RelationshipNodeId, RelationshipPolitician>();
      const pairKeys = new Set<string>();

      for (const row of rows) {
        politicianById.set(row.politicianA.id, row.politicianA);
        politicianById.set(row.politicianB.id, row.politicianB);
        pairKeys.add(row.pairKey);
      }

      return {
        ticker,
        companyName: rows[0]?.companyName ?? null,
        sector: rows[0]?.sector ?? null,
        politicianCount: politicianById.size,
        pairCount: pairKeys.size,
        pairEventCount: rows.length,
        sameDirectionCount: rows.filter((event) => event.direction === "same").length,
        oppositeDirectionCount: rows.filter((event) => event.direction === "opposite").length,
        estimatedVolume: rows.reduce((sum, event) => sum + event.estimatedVolume, 0),
        latestActivityDate: latestDate(rows.map((event) => event.latestActivityDate)),
        politicians: [...politicianById.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 6),
      } satisfies RelationshipClusterFact;
    })
    .sort(
      (a, b) =>
        b.pairEventCount - a.pairEventCount ||
        b.politicianCount - a.politicianCount ||
        b.estimatedVolume - a.estimatedVolume ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, 20);
}

function summarizeNetwork(pairs: RelationshipPairFact[]) {
  const nodeMap = new Map<RelationshipNodeId, RelationshipNetworkNode>();
  const links = pairs.slice(0, 18).map<RelationshipNetworkLink>((pair) => {
    const a = getOrCreateNode(nodeMap, pair.politicianA);
    const b = getOrCreateNode(nodeMap, pair.politicianB);

    a.pairEventCount += pair.sharedTradeCount;
    b.pairEventCount += pair.sharedTradeCount;
    a.connectionCount += 1;
    b.connectionCount += 1;

    return {
      source: pair.politicianA.id,
      target: pair.politicianB.id,
      pairEventCount: pair.sharedTradeCount,
      sameDirectionCount: pair.sameDirectionCount,
      oppositeDirectionCount: pair.oppositeDirectionCount,
      tickerHighlights: pair.tickerHighlights.slice(0, 3),
    };
  });

  return {
    nodes: [...nodeMap.values()]
      .sort(
        (a, b) =>
          b.pairEventCount - a.pairEventCount ||
          b.connectionCount - a.connectionCount ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 16),
    links,
  };
}

function getOrCreateNode(
  nodes: Map<RelationshipNodeId, RelationshipNetworkNode>,
  politician: RelationshipPolitician,
) {
  const existing = nodes.get(politician.id);
  if (existing) return existing;

  const node = { ...politician, pairEventCount: 0, connectionCount: 0 };
  nodes.set(politician.id, node);
  return node;
}

function toExample(event: PairEvent): RelationshipExample {
  return {
    ticker: event.ticker,
    companyName: event.companyName,
    direction: event.direction,
    daysBetween: event.daysBetween,
    transactionDateA: event.tradeA.transactionDate,
    transactionDateB: event.tradeB.transactionDate,
    disclosureDateA: event.tradeA.disclosureDate,
    disclosureDateB: event.tradeB.disclosureDate,
    actionA: event.tradeA.action,
    actionB: event.tradeB.action,
    amountA: event.tradeA.amountMinimum,
    amountB: event.tradeB.amountMinimum,
  };
}

function toPolitician(trade: RelationshipTradeInput): RelationshipPolitician {
  return {
    id: trade.politicianId,
    name: trade.politicianName,
    party: trade.party,
    state: trade.state,
  };
}

function classifyAction(value: string): TradeAction {
  const normalized = value.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("purchase")) return "buy";
  if (normalized.includes("sell") || normalized.includes("sale")) return "sell";
  return "other";
}

function classifyPairDirection(
  first: TradeAction,
  second: TradeAction,
): "same" | "opposite" | "mixed" {
  if (first === second && first !== "other") return "same";
  if ((first === "buy" && second === "sell") || (first === "sell" && second === "buy")) {
    return "opposite";
  }
  return "mixed";
}

function normalizeWindow(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return DEFAULT_WINDOW_DAYS;
  return Math.min(60, Math.max(1, Math.round(value)));
}

function dayDiff(first: Date, second: Date) {
  return Math.round(Math.abs(second.getTime() - first.getTime()) / DAY_MS);
}

function latestDate(dates: Date[]) {
  return dates.reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest));
}

function intersection(first: string[], second: string[]) {
  const secondSet = new Set(second);
  return [...new Set(first.filter((item) => secondSet.has(item)))].sort();
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
