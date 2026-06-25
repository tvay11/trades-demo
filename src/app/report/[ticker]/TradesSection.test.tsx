import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TradesSection } from "./TradesSection";

describe("TradesSection", () => {
  it("renders nothing when legacy report payloads omit trade arrays", () => {
    const { container } = render(
      <TradesSection official={undefined as never} insider={undefined as never} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
