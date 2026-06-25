import { describe, expect, it, vi } from "vitest";

import type { DatasetSpec } from "@/lib/ingest/types";
import {
  buildProbeUrl,
  normalizeQuiverResponse,
  probeEndpoint,
  summarizeDatasetCoverage,
} from "./probe";

describe("normalizeQuiverResponse", () => {
  it("accepts raw array responses", () => {
    expect(normalizeQuiverResponse([{ Ticker: "NVDA" }])).toEqual({
      envelopeShape: "array",
      rows: [{ Ticker: "NVDA" }],
      warnings: [],
    });
  });

  it("accepts documented { data: [...] } responses", () => {
    expect(normalizeQuiverResponse({ data: [{ Name: "Nancy Pelosi" }] })).toEqual({
      envelopeShape: "data-array",
      rows: [{ Name: "Nancy Pelosi" }],
      warnings: [],
    });
  });

  it("flags object responses that do not expose an array", () => {
    expect(normalizeQuiverResponse({ message: "ok" })).toMatchObject({
      envelopeShape: "object",
      rows: [],
      warnings: ["Response was an object without a data array."],
    });
  });
});

describe("buildProbeUrl", () => {
  it("preserves /beta in base URLs for unpaginated endpoints", () => {
    expect(
      buildProbeUrl({
        baseUrl: "https://api.quiverquant.com/beta",
        endpoint: "/live/congresstrading",
        pagination: { type: "none" },
      }),
    ).toBe("https://api.quiverquant.com/beta/live/congresstrading");
  });

  it("adds page and page_size for page-based probe requests", () => {
    expect(
      buildProbeUrl({
        baseUrl: "https://api.quiverquant.com/beta",
        endpoint: "/bulk/patents",
        pagination: { type: "page", pageSize: 1000, param: "page" },
      }),
    ).toBe("https://api.quiverquant.com/beta/bulk/patents?page=1&page_size=5");
  });

  it("uses today's ISO date for date-window probe requests", () => {
    expect(
      buildProbeUrl({
        baseUrl: "https://api.quiverquant.com/beta",
        endpoint: "/bulk/twitter",
        pagination: { type: "date-window", param: "date", windowDays: 7 },
        now: () => new Date("2026-05-09T12:00:00Z"),
      }),
    ).toBe("https://api.quiverquant.com/beta/bulk/twitter?date=2026-05-09");
  });
});

describe("probeEndpoint", () => {
  const spec: DatasetSpec<unknown, unknown> = {
    name: "ProbeDataset",
    endpoints: { bulk: "/bulk/probe" },
    pagination: { type: "none" },
    parse: (raw) => {
      if (!Array.isArray(raw)) throw new Error("array expected");
      if (raw.some((row) => typeof row !== "object" || row === null || !("Ticker" in row))) {
        throw new Error("Ticker field expected");
      }
      return raw;
    },
    dedup: () => "x",
    upsert: async () => ({ inserted: 0 }),
  };

  it("marks accessible parser-compatible endpoints green", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ Ticker: "NVDA", Amount: 123 }],
      text: async () => JSON.stringify([{ Ticker: "NVDA", Amount: 123 }]),
    }));

    const result = await probeEndpoint({
      spec,
      mode: "bulk",
      baseUrl: "https://api.quiverquant.com/beta",
      apiKey: "secret-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toMatchObject({
      dataset: "ProbeDataset",
      mode: "bulk",
      status: 200,
      access: "ok",
      envelopeShape: "array",
      rowCount: 1,
      sampleFields: ["Amount", "Ticker"],
      parser: "ok",
      color: "green",
    });
    expect(result.url).not.toContain("secret-key");
  });

  it("reports parser failures without throwing", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: [{ unexpected: true }] }),
      text: async () => JSON.stringify({ data: [{ unexpected: true }] }),
    }));

    const result = await probeEndpoint({
      spec,
      mode: "bulk",
      baseUrl: "https://api.quiverquant.com/beta",
      apiKey: "secret-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toMatchObject({
      envelopeShape: "data-array",
      parser: "failed",
      color: "yellow",
    });
    expect(result.parserError).toContain("Ticker field expected");
  });

  it("marks unauthorized and missing endpoints red", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "forbidden" }),
      text: async () => "{\"error\":\"forbidden\"}",
    }));

    const result = await probeEndpoint({
      spec,
      mode: "bulk",
      baseUrl: "https://api.quiverquant.com/beta",
      apiKey: "secret-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toMatchObject({
      status: 403,
      access: "forbidden",
      color: "red",
    });
  });
});

describe("summarizeDatasetCoverage", () => {
  it("flags public datasets that are not represented by implemented specs", () => {
    expect(
      summarizeDatasetCoverage([
        "CongressTrade",
        "SenateTrade",
        "HouseTrade",
        "InsiderTrade",
        "LobbyingDisclosure",
        "GovContract",
        "Patent",
        "ThirteenFHolding",
        "OffExchangeActivity",
      ]).missing,
    ).toEqual([
      "Politician Net Worth",
      "Corporate Donors",
      "Executive Compensation",
      "ETF Holdings",
      "Top Shareholders",
      "Quiver Newsfeed",
      "App Ratings",
    ]);
  });
});
