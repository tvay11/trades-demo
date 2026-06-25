// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseSummaryCsv,
  parseResultsCsv,
  perTickerByHorizon,
  buildVerdict,
} from "./backtestResults";

const SUMMARY_CSV = `horizon,n,krMapePct,rwMapePct,driftMapePct,coveragePct,meanBandWidthPct
5,228,19.0,3.4,4.0,9.6,8.9
60,228,33.9,15.5,24.8,4.8,7.8`;

const RESULTS_CSV = `ticker,cutoff,horizon,anchor,predClose,p10,p90,realClose,predChangePct,realChangePct,krAbsErrPct,rwAbsErrPct,driftAbsErrPct,withinBand,bandWidthPct,samples,temperature
NVDA,2023-01-18,5,100,98,95,101,110,-2,10,12,10,11,1,6,30,0.6
NVDA,2023-02-16,5,100,99,96,102,108,-1,8,9,8,9,0,6,30,0.6
AAPL,2023-01-18,5,100,101,98,104,103,1,3,2,3,2.5,1,6,30,0.6`;

describe("parseSummaryCsv", () => {
  it("parses numeric summary rows", () => {
    const rows = parseSummaryCsv(SUMMARY_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ horizon: 5, n: 228, krMapePct: 19.0, rwMapePct: 3.4 });
    expect(rows[1].horizon).toBe(60);
  });
});

describe("parseResultsCsv", () => {
  it("parses rows with numeric fields and withinBand", () => {
    const rows = parseResultsCsv(RESULTS_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ ticker: "NVDA", horizon: 5, krAbsErrPct: 12, withinBand: 1 });
    expect(rows[2].ticker).toBe("AAPL");
  });
});

describe("perTickerByHorizon", () => {
  it("aggregates mean errors and coverage per (ticker, horizon)", () => {
    const rows = perTickerByHorizon(parseResultsCsv(RESULTS_CSV));
    const nvda5 = rows.find((r) => r.ticker === "NVDA" && r.horizon === 5)!;
    expect(nvda5.n).toBe(2);
    expect(nvda5.krMapePct).toBeCloseTo(10.5, 5);   // mean of krAbsErrPct 12 and 9
    expect(nvda5.coveragePct).toBeCloseTo(50, 5);    // 1 of 2 within band
  });
});

describe("buildVerdict", () => {
  it("flags that Kronos loses to both baselines at every horizon", () => {
    const v = buildVerdict(parseSummaryCsv(SUMMARY_CSV));
    expect(v.totalHorizons).toBe(2);
    expect(v.beatsBaselineHorizons).toBe(0);
    expect(v.beatsBaseline).toBe(false);
    expect(v.coverageState).toBe("under"); // avg coverage ~7% << 80
  });

  it("flags a win when Kronos MAPE beats both baselines", () => {
    const v = buildVerdict([
      { horizon: 5, n: 10, krMapePct: 2.0, rwMapePct: 3.0, driftMapePct: 4.0, coveragePct: 80, meanBandWidthPct: 6 },
    ]);
    expect(v.beatsBaselineHorizons).toBe(1);
    expect(v.beatsBaseline).toBe(true);
    expect(v.coverageState).toBe("ok");
  });
});
