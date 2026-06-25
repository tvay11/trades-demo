// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseSqliteUtc } from "./sql-dates";

describe("parseSqliteUtc", () => {
  it("returns null on null/undefined/empty", () => {
    expect(parseSqliteUtc(null)).toBeNull();
    expect(parseSqliteUtc(undefined)).toBeNull();
    expect(parseSqliteUtc("")).toBeNull();
    expect(parseSqliteUtc("   ")).toBeNull();
  });

  it("treats 'YYYY-MM-DD HH:MM:SS' as UTC (the libSQL default)", () => {
    const d = parseSqliteUtc("2026-05-12 09:23:00");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-05-12T09:23:00.000Z");
  });

  it("trusts pre-marked ISO strings", () => {
    const d = parseSqliteUtc("2026-05-12T09:23:00Z");
    expect(d!.toISOString()).toBe("2026-05-12T09:23:00.000Z");
  });

  it("trusts pre-marked offset strings", () => {
    const d = parseSqliteUtc("2026-05-12T09:23:00+02:00");
    expect(d!.toISOString()).toBe("2026-05-12T07:23:00.000Z");
  });

  it("forces UTC on bare ISO-ish strings without Z", () => {
    // Without a Z, JS parses as local — wrap forces UTC.
    const d = parseSqliteUtc("2026-05-12T09:23:00");
    expect(d!.toISOString()).toBe("2026-05-12T09:23:00.000Z");
  });
});
