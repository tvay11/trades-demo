// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const nextCache = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => nextCache);

import { applyCacheLife, applyCacheTag, revalidateCacheTag } from "./cache";

const originalDisableNextCache = process.env.TRADES_DISABLE_NEXT_CACHE;

describe("cache helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    if (originalDisableNextCache == null) {
      delete process.env.TRADES_DISABLE_NEXT_CACHE;
    } else {
      process.env.TRADES_DISABLE_NEXT_CACHE = originalDisableNextCache;
    }
  });

  it("skips Next cache APIs when running a standalone script", () => {
    process.env.TRADES_DISABLE_NEXT_CACHE = "1";

    applyCacheLife("minutes");
    applyCacheTag("report:NVDA");
    revalidateCacheTag("report:NVDA", "max");

    expect(nextCache.cacheLife).not.toHaveBeenCalled();
    expect(nextCache.cacheTag).not.toHaveBeenCalled();
    expect(nextCache.revalidateTag).not.toHaveBeenCalled();
  });

  it("uses Next cache APIs by default", () => {
    delete process.env.TRADES_DISABLE_NEXT_CACHE;

    applyCacheLife("hours");
    applyCacheTag("report:NVDA");
    revalidateCacheTag("report:NVDA", "max");

    expect(nextCache.cacheLife).toHaveBeenCalledWith("hours");
    expect(nextCache.cacheTag).toHaveBeenCalledWith("report:NVDA");
    expect(nextCache.revalidateTag).toHaveBeenCalledWith("report:NVDA", "max");
  });
});
