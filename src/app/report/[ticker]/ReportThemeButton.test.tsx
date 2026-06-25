import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ReportThemeButton } from "./ReportThemeButton";

describe("ReportThemeButton", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles the report shell between dark and light mode", () => {
    const { container } = render(
      <div className="kl">
        <ReportThemeButton />
      </div>,
    );

    const shell = container.querySelector(".kl");
    expect(shell).toHaveClass("kl-theme-dark");

    const button = screen.getByRole("button", { name: "Light mode" });
    fireEvent.click(button);

    expect(shell).toHaveClass("kl-theme-light");
    expect(shell).not.toHaveClass("kl-theme-dark");
    expect(button).toHaveTextContent("Dark mode");
    expect(localStorage.getItem("kl-report-theme")).toBe("light");
  });
});
