"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { refreshForecastAction } from "./actions";

export function RefreshForecastButton({
  ticker,
  label = "↻ Refresh forecast",
  onDark = true,
}: {
  ticker: string;
  label?: string;
  onDark?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fg = onDark ? "var(--background)" : "var(--foreground)";

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "10.5px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: fg,
    background: "transparent",
    border: `1px solid ${fg}`,
    padding: "3px 10px",
    cursor: pending ? "default" : "pointer",
    opacity: pending ? 0.6 : 1,
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      {error ? <span style={{ color: "var(--bear)", fontSize: "10px" }}>{error}</span> : null}
      <button
        type="button"
        style={btn}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await refreshForecastAction(ticker);
            if (res.ok) router.refresh();
            else setError(res.error ?? "Failed");
          })
        }
      >
        {pending ? `${label}…` : label}
      </button>
    </span>
  );
}
