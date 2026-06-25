// @vitest-environment node
import { describe, it, expect } from "vitest";

// Real smoke test: the previous version asserted 1+1 === 2, which guaranteed
// nothing about the build. Importing the core modules catches packaging or
// alias regressions (e.g. broken `@/` resolution, stale Prisma client, etc).
describe("smoke", () => {
  it("core modules import without throwing", async () => {
    const db = await import("@/lib/db");
    const money = await import("@/lib/money");
    const format = await import("@/lib/format");

    expect(db).toBeDefined();
    expect(typeof money.minimumDollars).toBe("function");
    expect(typeof format.formatMoney).toBe("function");
  });
});
