import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawUnsafe = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    $queryRawUnsafe: queryRawUnsafe,
  },
}));

import { getStocksList } from "./stocksList";

describe("getStocksList", () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    queryRawUnsafe
      .mockResolvedValueOnce([
        {
          ticker: "NVDA",
          companyName: "NVIDIA Corporation",
          sector: "Technology",
          industry: "Semiconductors",
          country: "US",
          marketCap: "3000000000000",
          tradeCount14: 1,
          tradeCount30: 2,
          tradeCount60: 3,
          tradeCount90: 4,
          tradeCount365: 5,
        },
      ])
      .mockResolvedValueOnce([{ n: 1 }]);
  });

  it("counts recent activity from CongressTrade by disclosureDate", async () => {
    await getStocksList({ activity: "active90", pageSize: 10 });

    const sql = String(queryRawUnsafe.mock.calls[0]?.[0]);
    expect(sql).toContain('c."disclosureDate" >= ?');
  });

  it("also counts ExecutiveTrade by transactionDate (unified ticker count)", async () => {
    await getStocksList({ activity: "active90", pageSize: 10 });

    const sql = String(queryRawUnsafe.mock.calls[0]?.[0]);
    expect(sql).toContain('"ExecutiveTrade"');
    expect(sql).toContain('e."transactionDate" >= ?');
  });

  it("adds stock universe filters for profile, industry, exchange, country, and 90d activity floor", async () => {
    await getStocksList({
      exchange: "nasdaq",
      industry: "semi",
      country: "us",
      profile: "completeProfile",
      minTrades90: "5",
      pageSize: 10,
    });

    const dataSql = String(queryRawUnsafe.mock.calls[0]?.[0]);
    const countSql = String(queryRawUnsafe.mock.calls[1]?.[0]);
    const dataParams = queryRawUnsafe.mock.calls[0]?.slice(1);
    const countParams = queryRawUnsafe.mock.calls[1]?.slice(1);

    expect(dataSql).toContain('UPPER(COALESCE(s."exchange", \'\')) LIKE ?');
    expect(dataSql).toContain('UPPER(COALESCE(s."industry", \'\')) LIKE ?');
    expect(dataSql).toContain('UPPER(COALESCE(s."country", \'\')) LIKE ?');
    expect(dataSql).toContain('s."marketCap" IS NOT NULL');
    expect(dataSql).toContain('s."sector" IS NOT NULL');
    expect(dataSql).toContain('>= ?');
    expect(countSql).toContain('"ExecutiveTrade"');
    expect(dataParams).toContain("%NASDAQ%");
    expect(dataParams).toContain("%SEMI%");
    expect(dataParams).toContain("%US%");
    expect(dataParams).toContain(5);
    expect(countParams).toContain(5);
  });
});
