"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function toCsv(
  headers: string[],
  rows: (string | number | null)[][],
): string {
  function escapeField(field: string | number | null): string {
    if (field === null) return "";
    const str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const lines: string[] = [
    headers.map(escapeField).join(","),
    ...rows.map((row) => row.map(escapeField).join(",")),
  ];
  return lines.join("\r\n");
}

export function DownloadCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
}) {
  function download() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" onClick={download}>
      <Download className="size-4" />
      Download CSV
    </Button>
  );
}
