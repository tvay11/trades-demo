import { PrismaClient } from "@prisma/client";

import * as path from "path";

const db = new PrismaClient({
  datasources: {
    db: {
      url: `file:${path.resolve(__dirname, "demo.db")}`
    }
  }
});

function generateBars(basePrice: number, count = 90) {
  const bars: any[] = [];
  const start = new Date();
  start.setDate(start.getDate() - count);

  let currentPrice = basePrice;
  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * (currentPrice * 0.02); // slight upward bias
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * (currentPrice * 0.01);
    const low = Math.min(open, close) - Math.random() * (currentPrice * 0.01);
    const volume = Math.floor(50_000_000 + Math.random() * 80_000_000);

    bars.push({
      date: date.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
    });
    currentPrice = close;
  }
  return bars;
}

async function main() {
  console.log("Seeding trades-demo database...");

  // 1. Clear existing tables
  console.log("Clearing existing tables...");
  await db.report.deleteMany();
  await db.congressTrade.deleteMany();
  await db.executiveTrade.deleteMany();
  await db.executiveOfficial.deleteMany();
  await db.executiveAgency.deleteMany();
  await db.politician.deleteMany();
  await db.stock.deleteMany();

  // 2. Create Stocks
  console.log("Creating Stocks...");
  const nvda = await db.stock.create({
    data: {
      ticker: "NVDA",
      companyName: "NVIDIA Corporation",
      exchange: "NASDAQ",
      sector: "Technology",
      industry: "Semiconductors",
      marketCap: BigInt(2950000000000),
    },
  });

  const aapl = await db.stock.create({
    data: {
      ticker: "AAPL",
      companyName: "Apple Inc.",
      exchange: "NASDAQ",
      sector: "Technology",
      industry: "Consumer Electronics",
      marketCap: BigInt(3120000000000),
    },
  });

  const msft = await db.stock.create({
    data: {
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
      exchange: "NASDAQ",
      sector: "Technology",
      industry: "Software—Infrastructure",
      marketCap: BigInt(3200000000000),
    },
  });

  // 3. Create Politicians
  console.log("Creating Politicians...");
  const pelosi = await db.politician.create({
    data: { name: "Nancy Pelosi", chamber: "house", party: "D", state: "CA", bioguideId: "P000197" },
  });

  const schultz = await db.politician.create({
    data: { name: "Debbie Wasserman Schultz", chamber: "house", party: "D", state: "FL", bioguideId: "W000797" },
  });

  const tuberville = await db.politician.create({
    data: { name: "Tommy Tuberville", chamber: "senate", party: "R", state: "AL", bioguideId: "T000278" },
  });

  // 4. Create Congressional Trades
  console.log("Creating Congressional Trades...");
  const today = new Date();
  
  const tradesData = [
    {
      representative: "Nancy Pelosi",
      politicianId: pelosi.id,
      ticker: "NVDA",
      transactionType: "purchase",
      tradeType: "Buy",
      amountMinCents: BigInt(100000000),
      amountMaxCents: BigInt(500000000),
      amountRangeRaw: "$1,000,001 - $5,000,000",
      assetDescription: "NVIDIA Corporation - Common Stock",
      house: "house",
      party: "D",
      state: "CA",
      disclosureDate: new Date(today.getTime() - 5 * 24 * 3600 * 1000),
      transactionDate: new Date(today.getTime() - 15 * 24 * 3600 * 1000),
      sourceHash: "hash-c1",
    },
    {
      representative: "Tommy Tuberville",
      politicianId: tuberville.id,
      ticker: "MSFT",
      transactionType: "purchase",
      tradeType: "Buy",
      amountMinCents: BigInt(10000000),
      amountMaxCents: BigInt(25000000),
      amountRangeRaw: "$100,001 - $250,000",
      assetDescription: "Microsoft Corporation - Common Stock",
      house: "senate",
      party: "R",
      state: "AL",
      disclosureDate: new Date(today.getTime() - 8 * 24 * 3600 * 1000),
      transactionDate: new Date(today.getTime() - 20 * 24 * 3600 * 1000),
      sourceHash: "hash-c2",
    },
    {
      representative: "Debbie Wasserman Schultz",
      politicianId: schultz.id,
      ticker: "AAPL",
      transactionType: "sale_full",
      tradeType: "Sell",
      amountMinCents: BigInt(25000000),
      amountMaxCents: BigInt(50000000),
      amountRangeRaw: "$250,001 - $500,000",
      assetDescription: "Apple Inc. - Common Stock",
      house: "house",
      party: "D",
      state: "FL",
      disclosureDate: new Date(today.getTime() - 10 * 24 * 3600 * 1000),
      transactionDate: new Date(today.getTime() - 25 * 24 * 3600 * 1000),
      sourceHash: "hash-c3",
    },
    {
      representative: "Nancy Pelosi",
      politicianId: pelosi.id,
      ticker: "AAPL",
      transactionType: "purchase",
      tradeType: "Buy",
      amountMinCents: BigInt(25000000),
      amountMaxCents: BigInt(50000000),
      amountRangeRaw: "$250,001 - $500,000",
      assetDescription: "Apple Inc. - Common Stock",
      house: "house",
      party: "D",
      state: "CA",
      disclosureDate: new Date(today.getTime() - 12 * 24 * 3600 * 1000),
      transactionDate: new Date(today.getTime() - 30 * 24 * 3600 * 1000),
      sourceHash: "hash-c4",
    }
  ];

  for (const t of tradesData) {
    await db.congressTrade.create({
      data: {
        representative: t.representative,
        politicianId: t.politicianId,
        ticker: t.ticker,
        transactionType: t.transactionType,
        amountMinCents: t.amountMinCents,
        amountMaxCents: t.amountMaxCents,
        amountRangeRaw: t.amountRangeRaw,
        assetDescription: t.assetDescription,
        house: t.house,
        party: t.party,
        state: t.state,
        disclosureDate: t.disclosureDate,
        transactionDate: t.transactionDate,
        sourceHash: t.sourceHash,
      }
    });
  }

  // 5. Create Mock Reports
  console.log("Creating Mock Reports...");
  const tickers = ["NVDA", "AAPL", "MSFT"];
  const basePrices = { NVDA: 125.40, AAPL: 188.50, MSFT: 420.30 };
  const companyNames = { NVDA: "NVIDIA Corporation", AAPL: "Apple Inc.", MSFT: "Microsoft Corporation" };

  for (const ticker of tickers) {
    const basePrice = basePrices[ticker as keyof typeof basePrices];
    const companyName = companyNames[ticker as keyof typeof companyNames];
    const bars = generateBars(basePrice, 90);
    const lastClose = bars[bars.length - 1].close;

    const mockLedgerPayload = {
      ticker,
      companyName,
      generatedAt: new Date().toISOString(),
      lastClose,
      scorecard: [],
      trendGrid: [
        { label: "Technical momentum", verdict: "Strong Up", signal: "BULL" },
        { label: "Analyst consensus", verdict: "Accumulate", signal: "NEUTRAL" },
        { label: "Congressional trade flow", verdict: "Institutional Buys", signal: "BULL" }
      ],
      houseCall: {
        rating: "BUY",
        drivers: ["Recent congressional buy filing of $1.0M+", "Strong volume breakout on moving averages"],
        watchTrigger: "Watch key levels of volume on disclosures",
        synthesis: "Factual mock representation for public display",
        score: 4.5,
        contributions: [
          { label: "Congressional Flow", value: 3.0 },
          { label: "Technical Momentum", value: 1.5 }
        ]
      },
      forecast: null,
      fundamentals: {
        earnings: {
          fiscalLabel: "FY2025",
          periodEnd: "2025-01-26",
          form: "10-K",
          lines: [
            { key: "revenue", label: "Revenue", value: 96300000000, marginPct: 100, yoyPct: 126, kind: "total" },
            { key: "cogs", label: "Cost of Revenue", value: 24000000000, marginPct: 25, yoyPct: 80, kind: "deduction" },
            { key: "grossProfit", label: "Gross Profit", value: 72300000000, marginPct: 75, yoyPct: 150, kind: "subtotal" },
            { key: "netIncome", label: "Net Income", value: 53000000000, marginPct: 55, yoyPct: 286, kind: "total" },
          ],
          trend: [
            { fiscalLabel: "FY2023", revenue: 27000000000, operatingMarginPct: 34, netMarginPct: 16, fcfMarginPct: 14 },
            { fiscalLabel: "FY2024", revenue: 42900000000, operatingMarginPct: 45, netMarginPct: 20, fcfMarginPct: 18 },
            { fiscalLabel: "FY2025", revenue: 96300000000, operatingMarginPct: 62, netMarginPct: 55, fcfMarginPct: 48 },
          ]
        }
      },
      signals: {
        congressNetFlowLabel: "Constructive",
        congressTradeCount: 5,
        insiderTradeCount: 12,
        thirteenFCount: 42,
        govContractCount: 2
      },
      news: [
        {
          title: `${companyName} launches breakthrough hardware integrations`,
          publisher: "Financial Tape",
          url: null,
          publishedAt: new Date(today.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
          summary: `High market interest follows the rollout of new ${ticker} components.`,
          sentiment: "bullish",
          score: 0.90
        },
        {
          title: "Regulatory changes present mild hurdles for sector tech components",
          publisher: "Regulatory Watch",
          url: null,
          publishedAt: new Date(today.getTime() - 4 * 24 * 3600 * 1000).toISOString(),
          summary: "Near-term sector headwind on policy guidelines.",
          sentiment: "bearish",
          score: 0.40
        }
      ],
      newsSkew: 0.6,
      consensusTarget: basePrice * 1.15,
      bars,
      forecastPoints: [],
      analystNote: "Simplified mock note for demo public workbench.",
      analystAnalysis: null,
      geopolitical: null,
      fundamentalsInsight: null,
      longTermPlay: null,
      officialTrades: [
        {
          branch: "congress",
          name: "Nancy Pelosi",
          party: "D",
          state: "CA",
          agency: null,
          action: "buy",
          transactionType: "purchase",
          amountMin: 1000000,
          amountMax: 5000000,
          amountRangeRaw: "$1M-$5M",
          transactionDate: "2026-06-10",
          disclosureDate: "2026-06-15"
        }
      ],
      insiderTrades: [],
      macro: null,
      options: null,
      valuation: null,
      analyst: {
        targetMean: basePrice * 1.15,
        targetHigh: basePrice * 1.25,
        targetLow: basePrice * 0.95,
        numAnalysts: 35,
        recommendationKey: "buy",
        recommendationMean: 1.7,
        upsidePct: 15.0,
        counts: { strongBuy: 20, buy: 12, hold: 3, sell: 0, strongSell: 0 }
      },
      shortInterest: null,
      nextEarnings: {
        date: new Date(today.getTime() + 45 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        daysUntil: 45,
        isEstimate: true
      },
      tradeLens: null,
      forecastTrackRecord: null,
      streetMomentum: {
        revisions: [],
        trendDeltas: [],
        surprises: [],
        beatCount: 4,
        surpriseTotal: 4,
        avgSurprisePct: 10.0,
        upgrades30: 3,
        downgrades30: 0,
        recentActions: [],
        pead: { active: false, daysSinceReport: null, lastSurprisePct: null, direction: null },
        read: "improving"
      },
      altFlow: null,
      riskShift: null,
      forensics: null,
      segments: null
    };

    await db.report.create({
      data: {
        ticker,
        generatedAt: mockLedgerPayload.generatedAt,
        payload: JSON.stringify(mockLedgerPayload)
      }
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
