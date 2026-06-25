"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!mounted) {
    return (
      <button
        className="flex items-center gap-3 rounded-sm px-3 py-2 font-mono text-xs text-muted-foreground"
        aria-label="Terminal theme loading"
      >
        <div className="size-4" />
        {!collapsed && <span>Terminal</span>}
      </button>
    );
  }

  const isDark = (resolvedTheme ?? theme) !== "light";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="ledger-stamp flex w-full items-center gap-3 border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-sky-500/50 hover:text-foreground"
      aria-label={`Switch to ${label}`}
    >
      <Icon className="size-4 shrink-0 text-sky-500" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
