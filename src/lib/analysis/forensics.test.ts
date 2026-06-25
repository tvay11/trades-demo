import { describe, expect, it } from "vitest";
import { scoreForensics } from "./forensics";
import type { ForensicsYear } from "@/lib/ledger/types";

function year(p: Partial<ForensicsYear>): ForensicsYear {
  return {
    fiscalLabel: "FY", periodEnd: "2025-12-31", revenue: null, netIncome: null,
    operatingCashFlow: null, capex: null, freeCashFlow: null, sbc: null,
    dilutedShares: null, dilutedEps: null, accountsReceivable: null,
    inventory: null, costOfRevenue: null, deferredRevenue: null, ...p,
  };
}

describe("scoreForensics", () => {
  it("returns unavailable when there is no usable data", () => {
    const out = scoreForensics([]);
    expect(out.overall).toBe("unavailable");
    expect(out.yearsAnalyzed).toBe(0);
  });

  it("flags FCF/NI divergence as concerning when FCF lags net income", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", netIncome: 200, freeCashFlow: 150 }),
      year({ fiscalLabel: "FY2025", netIncome: 150, freeCashFlow: 50 }),
    ]);
    const p = out.patterns.find((x) => x.key === "fcf_vs_ni")!;
    expect(p.verdict).toBe("concerning"); // (150+50)/(200+150)=0.57 < 0.70
  });

  it("rates clean FCF/NI when cash conversion is strong", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", netIncome: 100, freeCashFlow: 95 }),
      year({ fiscalLabel: "FY2025", netIncome: 120, freeCashFlow: 118 }),
    ]);
    expect(out.patterns.find((x) => x.key === "fcf_vs_ni")!.verdict).toBe("clean");
  });

  it("flags SBC dilution when SBC is large and share count is rising", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", revenue: 1000, sbc: 60, dilutedShares: 100 }),
      year({ fiscalLabel: "FY2025", revenue: 1200, sbc: 140, dilutedShares: 110 }),
    ]);
    const p = out.patterns.find((x) => x.key === "sbc_dilution")!;
    expect(p.verdict).toBe("concerning"); // SBC 11.7% of rev, shares +10%
  });

  it("flags channel-stuffing when DSO expands sharply", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", revenue: 1000, accountsReceivable: 100 }), // DSO ~36.5
      year({ fiscalLabel: "FY2025", revenue: 1200, accountsReceivable: 200 }), // DSO ~60.8 (+66%)
    ]);
    expect(out.patterns.find((x) => x.key === "channel_stuffing")!.verdict).toBe("concerning");
  });

  it("flags working-capital signal when deferred revenue contracts", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", revenue: 1000, accountsReceivable: 100, deferredRevenue: 90 }),
      year({ fiscalLabel: "FY2025", revenue: 1200, accountsReceivable: 110, deferredRevenue: 70 }),
    ]);
    expect(out.patterns.find((x) => x.key === "working_capital")!.verdict).toBe("concerning");
  });

  it("overall is concerning when two or more patterns are concerning", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", revenue: 1000, netIncome: 200, freeCashFlow: 150, accountsReceivable: 100 }),
      year({ fiscalLabel: "FY2025", revenue: 1200, netIncome: 150, freeCashFlow: 50, accountsReceivable: 200 }),
    ]);
    expect(out.overall).toBe("concerning");
  });

  it("rates SBC dilution clean when stock comp is small and shares are flat", () => {
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", revenue: 1000, sbc: 20, dilutedShares: 100 }),
      year({ fiscalLabel: "FY2025", revenue: 1200, sbc: 30, dilutedShares: 99 }),
    ]);
    expect(out.patterns.find((x) => x.key === "sbc_dilution")!.verdict).toBe("clean");
  });

  it("returns a watch overall when exactly one pattern is concerning", () => {
    // Only fcf_vs_ni data provided — other scorers are unavailable → overall "watch" (1 concerning)
    const out = scoreForensics([
      year({ fiscalLabel: "FY2024", netIncome: 200, freeCashFlow: 150 }),
      year({ fiscalLabel: "FY2025", netIncome: 150, freeCashFlow: 50 }), // FCF/NI = 0.57 → concerning
    ]);
    expect(out.patterns.find((x) => x.key === "fcf_vs_ni")!.verdict).toBe("concerning");
    expect(out.overall).toBe("watch");
  });
});
