import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

const setTheme = vi.fn();
let activeTheme = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: activeTheme,
    theme: activeTheme,
    setTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear();
    activeTheme = "dark";
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("switches from dark to light mode", async () => {
    render(<ThemeToggle />);

    const button = await screen.findByRole("button", { name: /switch to light mode/i });
    fireEvent.click(button);

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("switches from light to dark mode", async () => {
    activeTheme = "light";

    render(<ThemeToggle />);

    const button = await screen.findByRole("button", { name: /switch to dark mode/i });
    fireEvent.click(button);

    await waitFor(() => expect(setTheme).toHaveBeenCalledWith("dark"));
  });
});
