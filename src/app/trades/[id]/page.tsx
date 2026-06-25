import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  Landmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CommitteeTags } from "@/components/committee-tags";
import { PartyBadge, TradeTypeBadge } from "@/components/trade-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applyCacheLife } from "@/lib/cache";
import { getCommitteeTagsForPolitician } from "@/lib/committees/queries";
import { db } from "@/lib/db";
import { compactDate, formatMoney } from "@/lib/format";
import { minimumDollars } from "@/lib/money";
import { parseTradeId } from "@/lib/trades/parseId";
import { TradeBranchBadge } from "@/components/trade-branch-badge";
import type { Party, TradeType } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function normalizeParty(value: string | null): Party {
  return value?.toUpperCase().startsWith("R") ? "R" : "D";
}

function normalizeChamber(value: string | null): "House" | "Senate" {
  return value?.toLowerCase().includes("sen") ? "Senate" : "House";
}

function classifyTradeType(value: string): TradeType {
  const normalized = value.toLowerCase();
  if (normalized.includes("sell") || normalized.includes("sale")) return "Sell";
  if (normalized.includes("exchange")) return "Exchange";
  return "Buy";
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatAmountRange(minCents: bigint | null, maxCents: bigint | null, raw: string | null): string {
  if (raw) return raw;
  const min = Number(minCents ?? 0) / 100;
  const max = Number(maxCents ?? min) / 100;
  if (min === 1_000 && max === 15_000) return "$1K-$15K";
  if (min === 15_000 && max === 50_000) return "$15K-$50K";
  if (min === 50_000 && max === 100_000) return "$50K-$100K";
  if (min === 100_000 && max === 250_000) return "$100K-$250K";
  if (min === 250_000 && max === 500_000) return "$250K-$500K";
  if (min === 500_000 && max === 1_000_000) return "$500K-$1M";
  if (min === 1_000_000 && max === 5_000_000) return "$1M-$5M";
  return `$${Math.round(min / 1_000)}K-$${Math.round(max / 1_000)}K`;
}

function formatOwnerLabel(
  ownerType: string | null,
  ownerName: string | null,
  ownerRaw: string | null,
) {
  const label =
    ownerType === "SPOUSE"
      ? "Spouse"
      : ownerType === "DEPENDENT_CHILD"
        ? "Dependent child"
        : ownerType === "JOINT"
          ? "Joint"
          : ownerType === "SELF"
            ? "Self"
            : ownerRaw || "Not specified";

  return ownerName && ownerName !== label ? `${label} · ${ownerName}` : label;
}

// ── Metadata ────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  "use cache";
  applyCacheLife("minutes");

  const { id } = await params;
  const parsed = parseTradeId(id);
  if (!parsed) return { title: "Trade Not Found" };
  if (parsed.branch === "executive") {
    const t = await db.executiveTrade.findUnique({
      where: { id: parsed.numericId },
      select: { ticker: true, transactionType: true, official: { select: { name: true } } },
    });
    if (!t) return { title: "Trade Not Found" };
    return {
      title: `${t.official.name} ${classifyTradeType(t.transactionType)} $${t.ticker ?? "—"}`,
    };
  }
  const trade = await db.congressTrade.findUnique({
    where: { id: parsed.numericId },
    select: { ticker: true, representative: true, transactionType: true },
  });
  if (!trade) return { title: "Trade Not Found" };
  return {
    title: `${trade.representative} ${classifyTradeType(trade.transactionType)} $${trade.ticker}`,
  };
}

// ── Page ────────────────────────────────────────────────────────────────

export default function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<TradeDetailFallback />}>
      {params.then(({ id }) => (
        <TradeDetailContent id={id} />
      ))}
    </Suspense>
  );
}

async function TradeDetailContent({ id }: { id: string }) {
  const parsed = parseTradeId(id);
  if (!parsed) notFound();
  if (parsed.branch === "executive") {
    return <ExecutiveTradeDetailContent numericId={parsed.numericId} />;
  }
  const payload = await getTradeDetailPayload(parsed.numericId);
  if (!payload) notFound();

  const { trade, relatedTrades } = payload;

  const tradeType = classifyTradeType(trade.transactionType);
  const party = normalizeParty(trade.party ?? trade.politician?.party);
  const chamber = normalizeChamber(trade.politician?.chamber ?? trade.house);
  const state = trade.state ?? trade.politician?.state ?? "-";
  const politicianName = trade.politician?.name ?? trade.representative;
  const minimum = minimumDollars(trade.amountMinCents, trade.amountMaxCents);
  const amountRange = formatAmountRange(
    trade.amountMinCents,
    trade.amountMaxCents,
    trade.amountRangeRaw,
  );

  const committees = await getCommitteeTagsForPolitician({
    name: politicianName,
    state,
    chamber,
  });

  return (
    <main className="qq-page max-w-6xl">
      <Button nativeButton={false} variant="ghost" render={<Link href="/trades" />}>
        <ArrowLeft className="size-4" />
        Back to trades
      </Button>

      {/* Hero */}
      <section className="qq-panel p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TradeTypeBadge type={tradeType} />
              <PartyBadge party={party} />
              <span className="data-label">#{trade.id}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              <span className="font-mono text-sky-400">${trade.ticker}</span>
            </h1>
            {trade.assetDescription ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                {trade.assetDescription}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Details + Member profile */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="qq-panel">
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem icon={Landmark} label="Politician">
                <Link
                  href={`/politicians/${trade.politicianId}`}
                  className="inline-flex items-center gap-2 hover:text-sky-300"
                >
                  {politicianName}
                  <PartyBadge party={party} />
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </Link>
              </DetailItem>
              <DetailItem icon={FileText} label="Disclosure Owner">
                <span className="font-mono">
                  {formatOwnerLabel(trade.ownerType, trade.ownerName, trade.ownerRaw)}
                </span>
              </DetailItem>
              <DetailItem icon={Building2} label="Chamber">
                {chamber} · {state}
              </DetailItem>
              <DetailItem icon={CalendarDays} label="Transaction Date">
                {compactDate(dateKey(trade.transactionDate))}
              </DetailItem>
              <DetailItem icon={FileText} label="Disclosed">
                {compactDate(dateKey(trade.disclosureDate))}
              </DetailItem>
              <DetailItem icon={Building2} label="Amount Range">
                <span className="font-mono">{amountRange}</span>
              </DetailItem>
              <DetailItem icon={Building2} label="Min Disclosed">
                <span className="font-mono text-profit">{formatMoney(minimum)}</span>
              </DetailItem>
              {trade.documentId ? (
                <DetailItem icon={FileText} label="Document ID">
                  <span className="font-mono">{trade.documentId}</span>
                </DetailItem>
              ) : null}
              {trade.filingUrl ? (
                <DetailItem icon={FileText} label="Source Filing">
                  <Link
                    href={trade.filingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-sky-300"
                  >
                    Open filing
                    <ArrowUpRight className="size-3" />
                  </Link>
                </DetailItem>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="qq-panel">
          <CardHeader>
            <CardTitle>Member Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">State</span>
              <span className="font-mono">{state}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chamber</span>
              <span>{chamber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Disclosure Delay</span>
              <span className="font-mono">
                {Math.max(
                  0,
                  Math.round(
                    (trade.disclosureDate.getTime() - trade.transactionDate.getTime()) /
                      86_400_000,
                  ),
                )}
                d
              </span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="data-label mb-2">Committees</div>
              <CommitteeTags committees={committees} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Related trades */}
      <section className="qq-table-shell">
        <div className="qq-section-header">
          <h2 className="font-semibold tracking-tight">Related Trades In ${trade.ticker}</h2>
          <p className="text-xs text-muted-foreground">
            Other politicians trading the same stock.
          </p>
        </div>
        {relatedTrades.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted hover:bg-muted">
                <TableHead className="data-label">Politician</TableHead>
                <TableHead className="data-label">Type</TableHead>
                <TableHead className="data-label text-right">Amount</TableHead>
                <TableHead className="data-label">Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatedTrades.map((related) => (
                <TableRow key={related.id} className="row-stripe">
                  <TableCell>
                    <Link href={`/trades/${related.id}`} className="hover:text-sky-300">
                      {related.politician?.name ?? related.representative}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TradeTypeBadge type={classifyTradeType(related.transactionType)} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatAmountRange(
                      related.amountMinCents,
                      related.amountMaxCents,
                      related.amountRangeRaw,
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {compactDate(dateKey(related.disclosureDate))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid place-items-center px-6 py-14 text-center">
            <div className="empty-orb mb-4 size-20 rounded-full" />
            <h3 className="font-semibold">No related trades</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No other congressional trades found for ${trade.ticker}.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

async function getTradeDetailPayload(id: number) {
  "use cache";
  applyCacheLife("minutes");

  if (!Number.isFinite(id)) return null;

  const trade = await db.congressTrade.findUnique({
    where: { id: Number(id) },
    include: {
      politician: {
        select: {
          id: true,
          name: true,
          party: true,
          state: true,
          chamber: true,
        },
      },
    },
  });

  if (!trade) return null;

  // Related trades (same ticker, different trade)
  const relatedTrades = await db.congressTrade.findMany({
    where: {
      ticker: trade.ticker,
      id: { not: trade.id },
    },
    orderBy: { disclosureDate: "desc" },
    take: 8,
    include: {
      politician: {
        select: { name: true, party: true },
      },
    },
  });

  return { trade, relatedTrades };
}

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-card p-4">
      <dt className="data-label flex items-center gap-2">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-2 text-sm">{children}</dd>
    </div>
  );
}

// ── Executive trade detail ──────────────────────────────────────────────

async function ExecutiveTradeDetailContent({ numericId }: { numericId: number }) {
  "use cache";
  applyCacheLife("minutes");

  if (!Number.isFinite(numericId)) notFound();

  const trade = await db.executiveTrade.findUnique({
    where: { id: numericId },
    include: {
      official: {
        include: {
          agency: { select: { name: true } },
          sourceFilings: { orderBy: { filingDate: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!trade) notFound();

  const tradeType = classifyTradeType(trade.transactionType);
  const minimum = minimumDollars(trade.amountMinCents, trade.amountMaxCents);
  const amountRange = formatAmountRange(
    trade.amountMinCents,
    trade.amountMaxCents,
    trade.amountRangeRaw,
  );
  const filing = trade.official.sourceFilings[0];

  return (
    <main className="qq-page max-w-6xl">
      <Button nativeButton={false} variant="ghost" render={<Link href="/" />}>
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Button>

      <section className="qq-panel p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TradeTypeBadge type={tradeType} />
              <TradeBranchBadge branch="executive" />
              <span className="data-label">#{trade.id}</span>
              {trade.lateFilingFlag ? (
                <span className="rounded border border-rose-900/40 bg-rose-950/20 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-rose-300">
                  Late filing
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              <span className="font-mono text-sky-400">
                ${trade.ticker ?? "—"}
              </span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {trade.assetDescription}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="qq-panel">
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem icon={Landmark} label="Official">
                <span className="inline-flex items-center gap-2">
                  {trade.official.name}
                </span>
              </DetailItem>
              <DetailItem icon={Building2} label="Title">
                {trade.official.title ?? "—"}
              </DetailItem>
              <DetailItem icon={Building2} label="Agency">
                {trade.official.agency?.name ?? "—"}
              </DetailItem>
              <DetailItem icon={CalendarDays} label="Transaction Date">
                {compactDate(dateKey(trade.transactionDate))}
              </DetailItem>
              <DetailItem icon={Building2} label="Amount Range">
                <span className="font-mono">{amountRange}</span>
              </DetailItem>
              <DetailItem icon={Building2} label="Min Disclosed">
                <span className="font-mono text-profit">{formatMoney(minimum)}</span>
              </DetailItem>
              {filing?.url ? (
                <DetailItem icon={FileText} label="Source Filing">
                  <Link
                    href={filing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sky-400 hover:underline"
                  >
                    {filing.label ?? "View filing"}
                    <ArrowUpRight className="size-3" />
                  </Link>
                </DetailItem>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function TradeDetailFallback() {
  return (
    <main className="qq-page max-w-6xl">
      <div className="h-8 w-40 rounded border border-border bg-muted" />
      <div className="h-40 rounded border border-border bg-muted" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-72 rounded border border-border bg-muted" />
        <div className="h-72 rounded border border-border bg-muted" />
      </div>
    </main>
  );
}
