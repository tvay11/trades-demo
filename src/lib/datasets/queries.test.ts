import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  congressCount,
  congressFindMany,
  lobbyingCount,
  lobbyingFindMany,
  politicianFindMany,
  assignmentCount,
  assignmentFindMany,
} = vi.hoisted(() => ({
  congressCount: vi.fn(),
  congressFindMany: vi.fn(),
  lobbyingCount: vi.fn(),
  lobbyingFindMany: vi.fn(),
  politicianFindMany: vi.fn(),
  assignmentCount: vi.fn(),
  assignmentFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    congressTrade: {
      count: congressCount,
      findMany: congressFindMany,
    },
    lobbyingDisclosure: {
      count: lobbyingCount,
      findMany: lobbyingFindMany,
    },
    politician: {
      findMany: politicianFindMany,
    },
    politicianCommitteeAssignment: {
      count: assignmentCount,
      findMany: assignmentFindMany,
    },
  },
}));

import { getDatasetPage } from "./queries";

describe("dataset SQL queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes filtered CongressTrade clauses into count and findMany", async () => {
    congressCount.mockResolvedValue(1);
    congressFindMany.mockResolvedValue([{ ticker: "NVDA" }]);

    const page = await getDatasetPage("congress-trades", {
      q: "NVDA",
      f_party: "D",
      sort: "transactionDate",
      dir: "desc",
    });

    expect(page?.totalRows).toBe(1);
    expect(page?.rows).toEqual([{ ticker: "NVDA" }]);
    expect(congressCount).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { representative: { contains: "NVDA" } },
              { ticker: { contains: "NVDA" } },
            ]),
          }),
          { party: "D" },
        ]),
      },
    });
    expect(congressFindMany).toHaveBeenCalledWith({
      skip: 0,
      take: 25,
      where: expect.any(Object),
      orderBy: { transactionDate: "desc" },
    });
  });

  it("passes LobbyingDisclosure filters through the shared query path", async () => {
    lobbyingCount.mockResolvedValue(1);
    lobbyingFindMany.mockResolvedValue([{ ticker: "NVDA" }]);

    await getDatasetPage("lobbying-disclosures", {
      f_ticker: "NVDA",
      f_filingYear_min: "2026",
    });

    expect(lobbyingCount).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          { ticker: { contains: "NVDA" } },
          { filingYear: { gte: 2026 } },
        ]),
      },
    });
    expect(lobbyingFindMany).toHaveBeenCalledWith({
      skip: 0,
      take: 25,
      where: expect.any(Object),
      orderBy: { filedAt: "desc" },
    });
  });

  it("passes committee-assignment boolean filters through the shared query path", async () => {
    assignmentCount.mockResolvedValue(1);
    assignmentFindMany.mockResolvedValue([{ isRanking: true }]);

    await getDatasetPage("committee-assignments", {
      f_isRanking: "true",
    });

    expect(assignmentCount).toHaveBeenCalledWith({
      where: {
        AND: [{ isRanking: true }],
      },
    });
    expect(assignmentFindMany).toHaveBeenCalledWith({
      skip: 0,
      take: 25,
      where: { AND: [{ isRanking: true }] },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("filters politicians by computed activity and committee fields", async () => {
    const now = new Date();
    politicianFindMany.mockResolvedValue([
      {
        id: 1,
        name: "Active Member",
        party: "D",
        state: "CA",
        chamber: "House",
        bioguideId: "A1",
        createdAt: now,
        trades: [{ disclosureDate: now }, { disclosureDate: now }],
        committees: [{ rank: 2, committee: { name: "Finance Committee" } }],
      },
      {
        id: 2,
        name: "Other Member",
        party: "D",
        state: "TX",
        chamber: "House",
        bioguideId: "B2",
        createdAt: now,
        trades: [{ disclosureDate: now }],
        committees: [{ rank: 7, committee: { name: "Energy Committee" } }],
      },
    ]);

    const page = await getDatasetPage("politicians", {
      f_party: "D",
      f_committee: "Finance",
      f_trades90d_min: "2",
      sort: "trades90d",
      dir: "desc",
    });

    expect(politicianFindMany).toHaveBeenCalledWith({
      where: { AND: [{ party: "D" }] },
      include: {
        trades: { select: { disclosureDate: true } },
        committees: { include: { committee: true } },
      },
    });
    expect(page?.totalRows).toBe(1);
    expect(page?.rows).toEqual([
      expect.objectContaining({
        name: "Active Member",
        committee: "Finance Committee",
        trades90d: 2,
      }),
    ]);
  });
});
