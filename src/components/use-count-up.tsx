"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function useCountUp(
  target: number,
  options: {
    duration?: number;
    enabled?: boolean;
  } = {}
) {
  const { duration = 1200, enabled = true } = options;
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const animated = useRef(false);

  const animate = useCallback(() => {
    if (animated.current) return;
    animated.current = true;

    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [target, duration]);

  // Reset the "already animated" guard when target changes so the hook
  // re-animates to the new value. Without this the count stuck at the first
  // observed value when the parent re-rendered with a different `target`.
  useEffect(() => {
    animated.current = false;
  }, [target]);

  useEffect(() => {
    if (!enabled) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    // Check for reduced motion preference
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    const el = ref.current;
    if (!el) {
      animate();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, enabled, animate]);

  return { value, ref };
}
