import { describe, expect, it } from "vitest";

import { formatPickerDateLabel, parsePickerDate } from "./date-picker";

describe("date picker helpers", () => {
  it("parses submitted ISO dates and formats trader-facing labels", () => {
    const date = parsePickerDate("2026-05-11");

    expect(date).toEqual(new Date(2026, 4, 11));
    expect(formatPickerDateLabel("2026-05-11")).toBe("May 11, 2026");
  });

  it("treats missing or invalid values as unset", () => {
    expect(parsePickerDate("")).toBeNull();
    expect(parsePickerDate("bad-date")).toBeNull();
    expect(formatPickerDateLabel("")).toBe("Pick date");
  });
});
