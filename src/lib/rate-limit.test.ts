// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { consume, _resetForTest } from "./rate-limit";

beforeEach(() => _resetForTest());

describe("consume", () => {
  it("allows up to 10 within a 60s window", () => {
    for (let i = 0; i < 10; i++) {
      expect(consume("ip:1.2.3.4", 1000 + i)).toBe(true);
    }
    expect(consume("ip:1.2.3.4", 1010)).toBe(false);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 10; i++) consume("ip:1.2.3.4", 1000);
    expect(consume("ip:1.2.3.4", 1000)).toBe(false);
    // 60s later
    expect(consume("ip:1.2.3.4", 1000 + 60_001)).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 10; i++) consume("ip:1.2.3.4", 1000);
    expect(consume("ip:5.6.7.8", 1000)).toBe(true);
  });
});
