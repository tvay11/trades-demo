import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Providers } from "./providers";

const providerSpy = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="theme-provider">{props.children as React.ReactNode}</div>
));

vi.mock("next-themes", () => ({
  ThemeProvider: (props: Record<string, unknown>) => providerSpy(props),
}));

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Providers", () => {
  it("defaults to dark while allowing light mode selection", () => {
    render(
      <Providers>
        <main>App</main>
      </Providers>,
    );

    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
    expect(providerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: "class",
        defaultTheme: "dark",
        enableSystem: false,
      }),
    );
    expect(providerSpy.mock.calls[0][0]).not.toHaveProperty("forcedTheme");
  });
});
