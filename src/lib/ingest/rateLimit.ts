export type RateLimiter = { acquire: () => Promise<void> };

export type RateLimiterDeps = {
  ratePerMinute: number;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
};

export function createRateLimiter(deps: RateLimiterDeps): RateLimiter {
  const { ratePerMinute } = deps;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const clock = deps.clock ?? (() => Date.now());

  const capacity = ratePerMinute;
  const refillPerMs = ratePerMinute / 60_000;

  let tokens = capacity;
  let lastRefillAt = clock();

  function refill() {
    const now = clock();
    const elapsed = now - lastRefillAt;
    if (elapsed > 0) {
      tokens = Math.min(capacity, tokens + elapsed * refillPerMs);
      lastRefillAt = now;
    }
  }

  return {
    async acquire() {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      const needed = 1 - tokens;
      const wait = Math.ceil(needed / refillPerMs);
      await sleep(wait);
      refill();
      tokens -= 1;
    },
  };
}
