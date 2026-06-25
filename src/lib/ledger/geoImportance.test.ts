import { describe, expect, it } from "vitest";

import {
  CHANNEL_BASE,
  EXPOSURE_MULT,
  STATUS_MULT,
  computeGeoImportance,
  normGeoChannel,
  normGeoExposure,
  normGeoStatus,
} from "./geoImportance";

describe("computeGeoImportance", () => {
  it("scores an enacted company-targeted export ban at the top", () => {
    expect(computeGeoImportance("company_targeted", "sanctions_export_controls", "in_effect")).toBe(0.9);
  });

  it("multiplies channel base by exposure and status", () => {
    // 0.85 * 0.55 * 0.7 = 0.327 -> 0.33
    expect(computeGeoImportance("sector_supply_chain", "tariffs_trade", "proposed_likely")).toBe(0.33);
  });

  it("scores speculative macro chatter near zero", () => {
    // 0.4 * 0.25 * 0.4 = 0.04
    expect(computeGeoImportance("macro_broad", "elections_political", "speculative_rumor")).toBe(0.04);
  });

  it("rounds to 2 decimals and stays within [0, 1]", () => {
    for (const ch of Object.keys(CHANNEL_BASE) as (keyof typeof CHANNEL_BASE)[]) {
      for (const ex of Object.keys(EXPOSURE_MULT) as (keyof typeof EXPOSURE_MULT)[]) {
        for (const st of Object.keys(STATUS_MULT) as (keyof typeof STATUS_MULT)[]) {
          const s = computeGeoImportance(ex, ch, st);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(1);
          expect(s).toBe(Math.round(s * 100) / 100);
        }
      }
    }
  });
});

describe("facet normalizers fall back conservatively", () => {
  it("normGeoChannel", () => {
    expect(normGeoChannel("tariffs_trade")).toBe("tariffs_trade");
    expect(normGeoChannel(" Sanctions_Export_Controls ")).toBe("sanctions_export_controls");
    expect(normGeoChannel("nuclear_war")).toBe("diplomacy_summits");
    expect(normGeoChannel(undefined)).toBe("diplomacy_summits");
  });

  it("normGeoExposure", () => {
    expect(normGeoExposure("company_targeted")).toBe("company_targeted");
    expect(normGeoExposure("SECTOR_SUPPLY_CHAIN")).toBe("sector_supply_chain");
    expect(normGeoExposure("everything")).toBe("macro_broad");
    expect(normGeoExposure(null)).toBe("macro_broad");
  });

  it("normGeoStatus", () => {
    expect(normGeoStatus("in_effect")).toBe("in_effect");
    expect(normGeoStatus("proposed_likely")).toBe("proposed_likely");
    expect(normGeoStatus("maybe")).toBe("speculative_rumor");
    expect(normGeoStatus(42)).toBe("speculative_rumor");
  });
});
