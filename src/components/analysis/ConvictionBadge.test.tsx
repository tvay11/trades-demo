import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConvictionBadge } from "./ConvictionBadge";

describe("ConvictionBadge", () => {
  it("renders the score and a breakdown tooltip", () => {
    render(
      <ConvictionBadge
        score={72}
        breakdown={[{ label: "Recency", pts: 20, max: 20 }, { label: "Size", pts: 15, max: 20 }]}
      />,
    );
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByTitle(/Recency 20\/20/)).toBeInTheDocument();
  });
  it("renders a dash for null score", () => {
    render(<ConvictionBadge score={null} breakdown={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
