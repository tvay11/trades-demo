import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DownloadCsvButton, toCsv } from "./DownloadCsvButton";

describe("toCsv", () => {
  it("joins header and rows with \\r\\n", () => {
    const result = toCsv(["Name", "Value"], [["Alice", "1"]]);
    expect(result).toBe("Name,Value\r\nAlice,1");
  });

  it("quotes fields containing commas", () => {
    const result = toCsv(["Text"], [["hello, world"]]);
    expect(result).toBe('Text\r\n"hello, world"');
  });

  it("quotes fields containing double quotes and doubles embedded quotes", () => {
    const result = toCsv(["Text"], [['say "hi"']]);
    expect(result).toBe('Text\r\n"say ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    const result = toCsv(["Text"], [["line1\nline2"]]);
    expect(result).toBe('Text\r\n"line1\nline2"');
  });

  it("quotes fields containing carriage returns and newlines", () => {
    const result = toCsv(["Text"], [["line1\r\nline2"]]);
    expect(result).toBe('Text\r\n"line1\r\nline2"');
  });

  it("renders null as empty string", () => {
    const result = toCsv(["A", "B"], [[null, "x"]]);
    expect(result).toBe("A,B\r\n,x");
  });

  it("handles multiple rows", () => {
    const result = toCsv(["A"], [["1"], ["2"], ["3"]]);
    expect(result).toBe("A\r\n1\r\n2\r\n3");
  });
});

describe("DownloadCsvButton", () => {
  it('renders a button with text "Download CSV"', () => {
    render(
      <DownloadCsvButton
        filename="test.csv"
        headers={["Col"]}
        rows={[["val"]]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /download csv/i }),
    ).toBeInTheDocument();
  });
});
