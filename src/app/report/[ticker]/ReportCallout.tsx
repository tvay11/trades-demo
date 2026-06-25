import type { ReactNode } from "react";

export type ReportCalloutTone = "bullish" | "bearish" | "mixed" | "neutral" | "watch";

export function ReportCallout({
  title,
  tone,
  className,
  children,
}: {
  title: string;
  tone: ReportCalloutTone;
  className?: string;
  children: ReactNode;
}) {
  const classes = ["report-callout", `report-callout-${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <h3 className="report-callout-title">{title}</h3>
      <div className="report-callout-body">{children}</div>
    </section>
  );
}
