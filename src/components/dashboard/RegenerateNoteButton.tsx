"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { regenerateMorningNoteAction } from "@/app/actions/morningNote";

export function RegenerateNoteButton({
  label = "Regenerate",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "10.5px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: "var(--foreground)",
    background: "transparent",
    border: "1px solid var(--border)",
    padding: "3px 10px",
    borderRadius: "3px",
    cursor: pending ? "default" : "pointer",
    opacity: pending ? 0.6 : 1,
    whiteSpace: "nowrap",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      {error ? (
        <span style={{ color: "var(--destructive)", fontSize: "10px" }}>{error}</span>
      ) : null}
      <button
        type="button"
        style={btn}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await regenerateMorningNoteAction();
            if (res.ok) router.refresh();
            else setError("Generation failed");
          })
        }
      >
        {pending ? `${label}…` : label}
      </button>
    </span>
  );
}
