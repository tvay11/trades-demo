"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CreateReportButton({
  ticker,
  action,
}: {
  ticker: string;
  action: (ticker: string) => Promise<{ ok: boolean; ticker: string; error?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await action(ticker);
            if (res.ok) router.push(`/report/${res.ticker}`);
            else setError(res.error ?? "Report generation failed.");
          })
        }
      >
        <FileText className="size-4" />
        {pending ? "Generating…" : "Create Report"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
