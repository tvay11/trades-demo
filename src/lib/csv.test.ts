import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("escapes commas, quotes, and newlines", () => {
    const csv = toCsv(
      [
        { key: "ticker", label: "Ticker" },
        { key: "company", label: "Company" },
        { key: "note", label: "Note" },
      ],
      [
        {
          ticker: "NVDA",
          company: 'NVIDIA, "Corp"',
          note: "line one\nline two",
        },
      ],
    );

    expect(csv).toBe('Ticker,Company,Note\r\nNVDA,"NVIDIA, ""Corp""","line one\nline two"');
  });

  it("serializes dates, bigints, booleans, and nulls", () => {
    const csv = toCsv(
      [
        { key: "date", label: "Date" },
        { key: "amount", label: "Amount" },
        { key: "active", label: "Active" },
        { key: "blank", label: "Blank" },
      ],
      [
        {
          date: new Date("2026-05-20T00:00:00.000Z"),
          amount: 2500000000n,
          active: true,
          blank: null,
        },
      ],
    );

    expect(csv).toBe("Date,Amount,Active,Blank\r\n2026-05-20T00:00:00.000Z,2500000000,true,");
  });
});
