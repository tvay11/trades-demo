import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppSelect } from "./select";

describe("AppSelect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not emit Base UI uncontrolled default-value warnings when URL-driven defaults change", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { rerender } = render(
      <AppSelect
        defaultValue="desc"
        options={[
          { label: "Descending", value: "desc" },
          { label: "Ascending", value: "asc" },
        ]}
      />,
    );

    rerender(
      <AppSelect
        defaultValue="asc"
        options={[
          { label: "Descending", value: "desc" },
          { label: "Ascending", value: "asc" },
        ]}
      />,
    );

    await waitFor(() => {
      expect(
        consoleError.mock.calls.some((call) =>
          call.some((part) =>
            String(part).includes(
              "changing the default value state of an uncontrolled Select",
            ),
          ),
        ),
      ).toBe(false);
    });
  });
});
