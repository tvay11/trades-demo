import { describe, it, expect, vi } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("rateLimiter", () => {
  it("allows N requests immediately, then waits for refill", async () => {
    const now = { ms: 0 };
    const sleep = vi.fn(async (ms: number) => {
      now.ms += ms;
    });
    const clock = () => now.ms;

    const limiter = createRateLimiter({ ratePerMinute: 60, sleep, clock });

    for (let i = 0; i < 60; i++) await limiter.acquire();
    expect(sleep).not.toHaveBeenCalled();

    await limiter.acquire();
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThanOrEqual(900);
    expect(sleep.mock.calls[0][0]).toBeLessThanOrEqual(1100);
  });
});
