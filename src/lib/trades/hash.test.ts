// @vitest-environment node
import { describe, it, expect } from "vitest";
import { tradeHash } from "./hash";

describe("tradeHash", () => {
  it("produces stable hash for same inputs", () => {
    const a = tradeHash({ name: "Pelosi, Nancy", ticker: "NVDA", date: "2025-09-01", type: "Purchase", amount: "$1,001 - $15,000" });
    const b = tradeHash({ name: "Pelosi, Nancy", ticker: "NVDA", date: "2025-09-01", type: "Purchase", amount: "$1,001 - $15,000" });
    expect(a).toBe(b);
  });

  it("differs when ticker differs", () => {
    const a = tradeHash({ name: "Pelosi, Nancy", ticker: "NVDA", date: "2025-09-01", type: "Purchase", amount: "$1,001 - $15,000" });
    const b = tradeHash({ name: "Pelosi, Nancy", ticker: "AAPL", date: "2025-09-01", type: "Purchase", amount: "$1,001 - $15,000" });
    expect(a).not.toBe(b);
  });

  it("trims and lowercases consistently", () => {
    const a = tradeHash({ name: " Pelosi, Nancy ", ticker: "nvda", date: "2025-09-01", type: "Purchase", amount: "$1,001 - $15,000" });
    const b = tradeHash({ name: "Pelosi, Nancy", ticker: "NVDA", date: "2025-09-01", type: "Purchase", amount: "$1,001 - $15,000" });
    expect(a).toBe(b);
  });
});
