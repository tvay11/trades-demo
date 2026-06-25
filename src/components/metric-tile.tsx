"use client";

import { motion, useInView } from "framer-motion";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Landmark,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const icons = {
  activity: Activity,
  dollars: BadgeDollarSign,
  bars: BarChart3,
  landmark: Landmark,
  up: TrendingUp,
  down: TrendingDown,
};

function useCountUp(value: number, enabled: boolean) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const duration = 900;
    const started = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, value]);

  return display;
}

export function MetricTile({
  label,
  value,
  formatted,
  icon,
  accent = "cyan",
  delta,
}: {
  label: string;
  value: number;
  formatted?: string;
  icon: keyof typeof icons;
  accent?: "cyan" | "positive" | "blue" | "red";
  delta?: string;
}) {
  const Icon = icons[icon];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  // Skip the rAF count-up loop when a preformatted string is provided — its
  // value is what gets rendered, so the animated `count` was discarded
  // anyway. Saves frames on heavily-tiled dashboards.
  const count = useCountUp(value, inView && formatted == null);
  const accentClass = {
    cyan: "text-sky-400 bg-sky-950/20 border-sky-900/40",
    positive: "text-sky-500 bg-sky-950/20 border-sky-900/40",
    blue: "text-sky-400 bg-sky-950/20 border-sky-900/40",
    red: "text-rose-500 bg-rose-950/20 border-rose-900/40",
  }[accent];

  return (
    <motion.div
      ref={ref}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="qq-panel p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="data-label">{label}</div>
          <div className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <span className="data-value">{formatted ?? count.toLocaleString()}</span>
          </div>
        </div>
        <div className={cn("ledger-stamp p-1.5", accentClass)}>
          <Icon className="size-3.5" />
        </div>
      </div>
      {delta ? (
        <div className="mt-3 truncate border-t border-zinc-700/70 pt-2 font-mono text-[0.68rem] text-zinc-500">
          {delta}
        </div>
      ) : null}
    </motion.div>
  );
}
