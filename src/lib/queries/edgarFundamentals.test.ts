import { describe, expect, it } from "vitest";

import { shapeEdgarFacts } from "./edgarFundamentals";

// ── Fixtures ────────────────────────────────────────────────────────────────
// NVDA-like structure: annual 10-K FY entries + quarterly 10-Q ~90d entries

const makeRevenueEntry = (
  fy: number,
  fp: string,
  form: string,
  start: string,
  end: string,
  val: number,
) => ({ fy, fp, form, start, end, val });

// Annual entries: FY2025 and FY2026 (10-K)
const annualRev2025 = makeRevenueEntry(2025, "FY", "10-K", "2024-01-29", "2025-01-26", 130_500_000_000);
const annualRev2026 = makeRevenueEntry(2026, "FY", "10-K", "2025-01-27", "2026-01-25", 215_938_000_000);

// Quarterly 10-Q entries (~90d)
// Q3 FY2026 (same quarter last year for Q1 FY2027 YoY)
const qRev_Q3_FY2026 = makeRevenueEntry(2026, "Q3", "10-Q", "2025-07-28", "2025-10-26", 57_006_000_000);
// Q1 FY2027 (latest quarter)
const qRev_Q1_FY2027 = makeRevenueEntry(2027, "Q1", "10-Q", "2026-01-26", "2026-04-26", 81_615_000_000);

// YTD 10-Q entry (should be EXCLUDED from quarterly — 181d duration)
const ytdRev_Q2_FY2026 = makeRevenueEntry(2026, "Q2", "10-Q", "2025-01-27", "2025-07-27", 90_805_000_000);

const facts = {
  facts: {
    "us-gaap": {
      Revenues: {
        units: {
          USD: [annualRev2025, annualRev2026, qRev_Q3_FY2026, qRev_Q1_FY2027, ytdRev_Q2_FY2026],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            // Annual
            { fy: 2025, fp: "FY", form: "10-K", start: "2024-01-29", end: "2025-01-26", val: 72_880_000_000 },
            { fy: 2026, fp: "FY", form: "10-K", start: "2025-01-27", end: "2026-01-25", val: 120_067_000_000 },
            // Quarterly ~90d
            { fy: 2026, fp: "Q3", form: "10-Q", start: "2025-07-28", end: "2025-10-26", val: 31_910_000_000 },
            { fy: 2027, fp: "Q1", form: "10-Q", start: "2026-01-26", end: "2026-04-26", val: 58_321_000_000 },
            // YTD ~181d (must not be picked as quarterly)
            { fy: 2026, fp: "Q2", form: "10-Q", start: "2025-01-27", end: "2025-07-27", val: 45_197_000_000 },
          ],
        },
      },
      GrossProfit: {
        units: {
          USD: [
            // Annual
            { fy: 2025, fp: "FY", form: "10-K", start: "2024-01-29", end: "2025-01-26", val: 93_410_000_000 },
            { fy: 2026, fp: "FY", form: "10-K", start: "2025-01-27", end: "2026-01-25", val: 153_463_000_000 },
            // Quarterly ~90d (latest quarter Q1 FY2027)
            { fy: 2026, fp: "Q3", form: "10-Q", start: "2025-07-28", end: "2025-10-26", val: 41_849_000_000 },
            { fy: 2027, fp: "Q1", form: "10-Q", start: "2026-01-26", end: "2026-04-26", val: 61_157_000_000 },
          ],
        },
      },
      EarningsPerShareDiluted: {
        units: {
          "USD/shares": [
            // Annual
            { fy: 2025, fp: "FY", form: "10-K", start: "2024-01-29", end: "2025-01-26", val: 2.94 },
            { fy: 2026, fp: "FY", form: "10-K", start: "2025-01-27", end: "2026-01-25", val: 4.9 },
            // Quarterly ~90d
            { fy: 2026, fp: "Q3", form: "10-Q", start: "2025-07-28", end: "2025-10-26", val: 1.3 },
            { fy: 2027, fp: "Q1", form: "10-Q", start: "2026-01-26", end: "2026-04-26", val: 2.39 },
          ],
        },
      },
    },
  },
};

// Fixture where GrossProfit only exists for a DIFFERENT end than the latest annual revenue
const crossPeriodFacts = {
  facts: {
    "us-gaap": {
      Revenues: {
        units: {
          USD: [
            { fy: 2024, fp: "FY", form: "10-K", start: "2023-01-01", end: "2023-12-31", val: 100_000_000_000 },
            { fy: 2025, fp: "FY", form: "10-K", start: "2024-01-01", end: "2024-12-31", val: 120_000_000_000 },
          ],
        },
      },
      GrossProfit: {
        units: {
          USD: [
            // Only exists for the PRIOR year end — NOT the latest (2024-12-31)
            { fy: 2024, fp: "FY", form: "10-K", start: "2023-01-01", end: "2023-12-31", val: 70_000_000_000 },
          ],
        },
      },
    },
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("shapeEdgarFacts — annual (10-K)", () => {
  it("extracts the latest annual revenue (NOT an old year)", () => {
    const out = shapeEdgarFacts(facts);
    expect(out).not.toBeNull();
    expect(out!.annual).not.toBeNull();
    expect(out!.annual!.revenue).toBe(215_938_000_000);
    expect(out!.annual!.fiscalLabel).toBe("FY2026");
    expect(out!.annual!.periodEnd).toBe("2026-01-25");
    expect(out!.annual!.form).toBe("10-K");
  });

  it("computes correct annual revenue YoY", () => {
    const out = shapeEdgarFacts(facts)!;
    // (215.938B - 130.5B) / 130.5B * 100 ≈ 65.5%
    expect(out.annual!.revenueYoYPct).toBeCloseTo(65.5, 0);
  });

  it("computes plausible gross margin (~70%, NOT >100%) from same period", () => {
    const out = shapeEdgarFacts(facts)!;
    // 153.463B / 215.938B * 100 ≈ 71.1%
    expect(out.annual!.grossMarginPct).toBeCloseTo(71.1, 0);
    expect(out.annual!.grossMarginPct!).toBeLessThan(100);
  });

  it("aligns netIncome and EPS to the SAME period end as revenue", () => {
    const out = shapeEdgarFacts(facts)!;
    expect(out.annual!.netIncome).toBe(120_067_000_000);
    expect(out.annual!.dilutedEps).toBe(4.9);
  });

  it("computes annual netIncome YoY", () => {
    const out = shapeEdgarFacts(facts)!;
    // (120.067B - 72.88B) / 72.88B * 100 ≈ 64.7%
    expect(out.annual!.netIncomeYoYPct).toBeCloseTo(64.7, 0);
  });
});

describe("shapeEdgarFacts — quarterly (10-Q)", () => {
  it("extracts the latest quarter revenue", () => {
    const out = shapeEdgarFacts(facts)!;
    expect(out.quarter).not.toBeNull();
    expect(out.quarter!.revenue).toBe(81_615_000_000);
    expect(out.quarter!.form).toBe("10-Q");
    expect(out.quarter!.periodEnd).toBe("2026-04-26");
  });

  it("produces a fiscalLabel like 'Q1 FY2027'", () => {
    const out = shapeEdgarFacts(facts)!;
    expect(out.quarter!.fiscalLabel).toBe("Q1 FY2027");
  });

  it("excludes YTD (~180d) entries from quarterly selection", () => {
    // Q2 YTD val is 90.805B; if it were selected, revenue would be 90.8B not 81.6B
    const out = shapeEdgarFacts(facts)!;
    expect(out.quarter!.revenue).not.toBe(90_805_000_000);
  });

  it("computes plausible quarterly gross margin (~75%, NOT >100%)", () => {
    const out = shapeEdgarFacts(facts)!;
    // 61.157B / 81.615B * 100 ≈ 74.9%
    expect(out.quarter!.grossMarginPct).toBeCloseTo(74.9, 0);
    expect(out.quarter!.grossMarginPct!).toBeLessThan(100);
  });

  it("aligns quarterly netIncome to the same ~90d end", () => {
    const out = shapeEdgarFacts(facts)!;
    expect(out.quarter!.netIncome).toBe(58_321_000_000);
    expect(out.quarter!.dilutedEps).toBe(2.39);
  });

  it("computes quarterly revenue YoY vs same quarter prior year", () => {
    const out = shapeEdgarFacts(facts)!;
    // Q1 FY2027 (81.615B) vs Q3 FY2026 (57.006B) — ~365d prior
    // (81.615B - 57.006B) / 57.006B * 100 ≈ 43.2%
    expect(out.quarter!.revenueYoYPct).toBeCloseTo(43.2, 0);
  });
});

describe("shapeEdgarFacts — cross-period guard", () => {
  it("returns null grossMarginPct when GrossProfit only exists for a different end than revenue", () => {
    const out = shapeEdgarFacts(crossPeriodFacts);
    expect(out).not.toBeNull();
    expect(out!.annual).not.toBeNull();
    // Latest annual end = 2024-12-31; GrossProfit only at 2023-12-31 → must be null
    expect(out!.annual!.grossMarginPct).toBeNull();
    // Revenue itself should be from the LATEST year
    expect(out!.annual!.revenue).toBe(120_000_000_000);
  });
});

describe("shapeEdgarFacts — edge cases", () => {
  it("returns null when no revenue facts at all", () => {
    expect(shapeEdgarFacts({ facts: { "us-gaap": {} } })).toBeNull();
  });

  it("falls back to ASC 606 revenue concept when 'Revenues' is absent", () => {
    const asc606 = {
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: {
              USD: [
                { fy: 2024, fp: "FY", form: "10-K", start: "2023-09-25", end: "2024-09-28", val: 383_000_000_000 },
                { fy: 2025, fp: "FY", form: "10-K", start: "2024-09-29", end: "2025-09-27", val: 400_000_000_000 },
              ],
            },
          },
        },
      },
    };
    const out = shapeEdgarFacts(asc606);
    expect(out).not.toBeNull();
    expect(out!.annual!.revenue).toBe(400_000_000_000);
    expect(out!.annual!.revenueYoYPct).toBeCloseTo(4.4, 0);
  });
});

// ── Forensics series ─────────────────────────────────────────────────────────

function forensicsFact(fy: number, end: string, val: number) {
  return { fy, fp: "FY", form: "10-K", start: `${fy}-01-01`, end, val };
}
const forensicsFacts = {
  facts: {
    "us-gaap": {
      Revenues: { units: { USD: [forensicsFact(2024, "2024-12-31", 1000), forensicsFact(2025, "2025-12-31", 1200)] } },
      NetIncomeLoss: { units: { USD: [forensicsFact(2024, "2024-12-31", 200), forensicsFact(2025, "2025-12-31", 150)] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [forensicsFact(2024, "2024-12-31", 180), forensicsFact(2025, "2025-12-31", 90)] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [forensicsFact(2024, "2024-12-31", 30), forensicsFact(2025, "2025-12-31", 40)] } },
      ShareBasedCompensation: { units: { USD: [forensicsFact(2024, "2024-12-31", 60), forensicsFact(2025, "2025-12-31", 140)] } },
      WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [forensicsFact(2024, "2024-12-31", 100), forensicsFact(2025, "2025-12-31", 110)] } },
      EarningsPerShareDiluted: { units: { "USD/shares": [forensicsFact(2024, "2024-12-31", 2), forensicsFact(2025, "2025-12-31", 1.36)] } },
      AccountsReceivableNetCurrent: { units: { USD: [forensicsFact(2024, "2024-12-31", 100), forensicsFact(2025, "2025-12-31", 200)] } },
      InventoryNet: { units: { USD: [forensicsFact(2024, "2024-12-31", 50), forensicsFact(2025, "2025-12-31", 60)] } },
      CostOfRevenue: { units: { USD: [forensicsFact(2024, "2024-12-31", 400), forensicsFact(2025, "2025-12-31", 480)] } },
      ContractWithCustomerLiabilityCurrent: { units: { USD: [forensicsFact(2024, "2024-12-31", 90), forensicsFact(2025, "2025-12-31", 70)] } },
    },
  },
};

describe("shapeEdgarFacts forensicsSeries", () => {
  it("emits a trailing annual series oldest→newest with FCF computed", () => {
    const shaped = shapeEdgarFacts(forensicsFacts);
    const series = shaped?.forensicsSeries ?? [];
    expect(series).toHaveLength(2);
    expect(series[0].fiscalLabel).toBe("FY2024");
    expect(series[1].fiscalLabel).toBe("FY2025");
    expect(series[1].revenue).toBe(1200);
    expect(series[1].operatingCashFlow).toBe(90);
    expect(series[1].capex).toBe(40);
    expect(series[1].freeCashFlow).toBe(50); // 90 - 40
    expect(series[1].dilutedShares).toBe(110);
    expect(series[1].deferredRevenue).toBe(70);
  });
});

describe("shapeEdgarFacts earnings breakdown", () => {
  function f2(fy: number, end: string, val: number) {
    return { fy, fp: "FY", form: "10-K", start: `${fy}-01-01`, end, val };
  }
  const facts = {
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: [f2(2024, "2024-12-31", 1000), f2(2025, "2025-12-31", 1200)] } },
        CostOfRevenue: { units: { USD: [f2(2024, "2024-12-31", 400), f2(2025, "2025-12-31", 480)] } },
        GrossProfit: { units: { USD: [f2(2024, "2024-12-31", 600), f2(2025, "2025-12-31", 720)] } },
        ResearchAndDevelopmentExpense: { units: { USD: [f2(2024, "2024-12-31", 100), f2(2025, "2025-12-31", 130)] } },
        SellingGeneralAndAdministrativeExpense: { units: { USD: [f2(2024, "2024-12-31", 90), f2(2025, "2025-12-31", 100)] } },
        OperatingIncomeLoss: { units: { USD: [f2(2024, "2024-12-31", 410), f2(2025, "2025-12-31", 490)] } },
        NetIncomeLoss: { units: { USD: [f2(2024, "2024-12-31", 300), f2(2025, "2025-12-31", 360)] } },
        EarningsPerShareDiluted: { units: { "USD/shares": [f2(2024, "2024-12-31", 3), f2(2025, "2025-12-31", 3.6)] } },
        NetCashProvidedByUsedInOperatingActivities: { units: { USD: [f2(2024, "2024-12-31", 320), f2(2025, "2025-12-31", 400)] } },
        PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [f2(2024, "2024-12-31", 20), f2(2025, "2025-12-31", 40)] } },
      },
    },
  };

  it("builds an ordered waterfall with margins, YoY, and a trend", () => {
    const e = shapeEdgarFacts(facts)?.earnings;
    expect(e).toBeTruthy();
    expect(e!.fiscalLabel).toBe("FY2025");
    const get = (k: string) => e!.lines.find((l) => l.key === k)!;
    expect(get("revenue").value).toBe(1200);
    expect(get("revenue").yoyPct).toBeCloseTo(20, 5);
    expect(get("grossProfit").marginPct).toBeCloseTo(60, 5);
    expect(get("operatingIncome").value).toBe(490);
    expect(get("operatingIncome").marginPct).toBeCloseTo(40.83, 1);
    expect(get("fcf").value).toBe(360); // OCF 400 - CapEx 40
    expect(get("netIncome").yoyPct).toBeCloseTo(20, 5);
    expect(e!.trend).toHaveLength(2);
    expect(e!.trend[1].netMarginPct).toBeCloseTo(30, 5);
  });
});

describe("periodToEarningsBreakdown", () => {
  it("derives COGS/gross profit and builds an income-statement breakdown with no trend", async () => {
    const { periodToEarningsBreakdown } = await import("./edgarFundamentals");
    const out = periodToEarningsBreakdown({
      fiscalLabel: "Q1 FY2026", periodEnd: "2026-03-31", form: "10-Q",
      revenue: 3000, revenueYoYPct: 14, grossMarginPct: 20,
      netIncome: 150, netIncomeYoYPct: -208, dilutedEps: -0.81,
      operatingIncome: 240, rdExpense: null, sgaExpense: 300,
    });
    expect(out).not.toBeNull();
    expect(out!.trend).toEqual([]);
    const get = (k: string) => out!.lines.find((l) => l.key === k)!;
    expect(get("grossProfit").value).toBeCloseTo(600, 5);   // 3000 * 20%
    expect(get("cogs").value).toBeCloseTo(2400, 5);          // 3000 - 600
    expect(get("operatingIncome").value).toBe(240);
    expect(get("operatingIncome").marginPct).toBeCloseTo(8, 5);
    expect(get("revenue").yoyPct).toBe(14);
    expect(get("rnd").value).toBeNull();
  });
});
