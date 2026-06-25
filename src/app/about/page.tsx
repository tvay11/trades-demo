import { Database, Gauge, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-3 py-5 sm:px-5 lg:px-7">
      <section className="terminal-card p-6">
        <div className="data-label text-primary">About this terminal</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          About This Terminal
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          This build is a SQL-backed intelligence surface for U.S.
          congressional stock-trade disclosures. It combines market-data ingest,
          ticker profiles, price-cache data, committee context, and alternative
          datasets into trader-focused screens.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={Database}
          title="SQL-First Data"
          body="Dashboards and search read from normalized tables, with empty states when required ingest data is missing."
        />
        <InfoCard
          icon={Gauge}
          title="Fast Navigation"
          body="Server Components, cached data functions, streaming fallbacks, and URL-state filtering keep the interface responsive."
        />
        <InfoCard
          icon={ShieldCheck}
          title="Analyst Ready"
          body="Dense tables, party badges, ticker flow, and chart tooltips are tuned for scan-heavy financial workflows."
        />
      </section>
    </main>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <article className="terminal-card p-5">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}
