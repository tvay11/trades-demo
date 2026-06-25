import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandSearch } from "./command-search";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CommandSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    push.mockClear();
  });

  it("ignores abort rejections from stale search requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);

    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("signal is aborted without reason", "AbortError")),
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<CommandSearch open onOpenChange={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText(/search pelosi/i), {
        target: { value: "NVDA" },
      });

      act(() => {
        vi.advanceTimersByTime(120);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByPlaceholderText(/search pelosi/i), {
        target: { value: "AAPL" },
      });

      await Promise.resolve();

      expect(unhandledRejections).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
});
