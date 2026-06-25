"use client";

import { useEffect, useMemo, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import { getChartTheme } from "@/components/charts/chartTheme";
import type {
  SmartMoneyNetworkLink,
  SmartMoneyNetworkNode,
  SmartMoneySignalSide,
} from "@/lib/queries/smartMoney";
import { cn } from "@/lib/utils";

type SimNode = SimulationNodeDatum &
  SmartMoneyNetworkNode & {
    x: number;
    y: number;
  };

type SimLink = SimulationLinkDatum<SimNode> &
  Omit<SmartMoneyNetworkLink, "source" | "target">;

type SmartMoneyNetworkGraphProps = {
  nodes: SmartMoneyNetworkNode[];
  links: SmartMoneyNetworkLink[];
};

const WIDTH = 920;
const HEIGHT = 480;
const SVG_DECIMAL_PLACES = 3;

export function SmartMoneyNetworkGraph({ nodes, links }: SmartMoneyNetworkGraphProps) {
  const theme = getChartTheme();
  const graphKey = useMemo(() => buildGraphKey(nodes, links), [nodes, links]);
  const initialLayout = useMemo(() => layoutNodes(nodes), [nodes]);
  const initialLinks = useMemo(() => materializeLinks(initialLayout, links), [initialLayout, links]);
  const [simulationState, setSimulationState] = useState<{
    key: string;
    nodes: SimNode[];
    links: SimLink[];
  } | null>(null);
  const simNodes = simulationState?.key === graphKey ? simulationState.nodes : initialLayout;
  const simLinks = simulationState?.key === graphKey ? simulationState.links : initialLinks;

  useEffect(() => {
    const layout = layoutNodes(nodes);
    const linked = materializeLinks(layout, links);

    if (!layout.length) return;

    const simulation = forceSimulation<SimNode>(layout)
      .force(
        "link",
        forceLink<SimNode, SimLink>(linked)
          .id((node) => node.id)
          .distance((link) => {
            const target = link.target as SimNode;
            return target.kind === "stock" ? 118 : 92;
          })
          .strength(0.62),
      )
      .force("charge", forceManyBody<SimNode>().strength((node) => (node.kind === "stock" ? -520 : -260)))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide<SimNode>((node) => nodeRadius(node) + 12))
      .alphaDecay(0.04)
      .on("tick", () => {
        setSimulationState({ key: graphKey, nodes: [...layout], links: [...linked] });
      });

    return () => {
      simulation.stop();
    };
  }, [graphKey, nodes, links]);

  if (!nodes.length || !links.length) {
    return (
      <div className="grid min-h-[360px] place-items-center p-6 text-center">
        <div>
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-sm border border-sky-900/40 bg-sky-950/20 font-mono text-xs text-sky-400">
            13F
          </div>
          <div className="font-semibold">No 13F convergence links</div>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Backfill 13F holdings and stock market caps, then rerun the scan after the next filing window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative h-[480px] overflow-hidden">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="absolute inset-0 size-full"
          role="img"
          aria-label="13F smart money network graph"
        >
          <title>13F smart money network graph</title>
          <defs>
            <radialGradient id="smart-money-stock-long" cx="45%" cy="35%" r="70%">
              <stop offset="0%" stopColor={theme.accent} stopOpacity="0.5" />
              <stop offset="100%" stopColor={theme.surface} stopOpacity="0.95" />
            </radialGradient>
            <radialGradient id="smart-money-stock-sell" cx="45%" cy="35%" r="70%">
              <stop offset="0%" stopColor={theme.loss} stopOpacity="0.52" />
              <stop offset="100%" stopColor={theme.surface} stopOpacity="0.95" />
            </radialGradient>
            <radialGradient id="smart-money-stock-put" cx="45%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor={theme.surface} stopOpacity="0.95" />
            </radialGradient>
          </defs>
          <g>
            {simLinks.map((link) => {
              const source = link.source as SimNode;
              const target = link.target as SimNode;
              const strokeWidth = Math.max(1.4, Math.min(6, Math.log10((link.value ?? 0) + 10_000) - 3));
              const color = signalColor(link.signalSide, theme);
              return (
                <line
                  key={`${source.id}:${target.id}:${link.ticker}:${link.signalSide}`}
                  x1={formatSvgNumber(source.x)}
                  y1={formatSvgNumber(source.y)}
                  x2={formatSvgNumber(target.x)}
                  y2={formatSvgNumber(target.y)}
                  stroke={color}
                  strokeOpacity={0.28}
                  strokeWidth={formatSvgNumber(strokeWidth)}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
          <g>
            {simNodes.map((node) => {
              const radius = nodeRadius(node);
              const isStock = node.kind === "stock";
              const color = isStock ? signalColor(node.signalSide, theme) : theme.muted;
              return (
                <g key={node.id} transform={`translate(${formatSvgNumber(node.x)},${formatSvgNumber(node.y)})`}>
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke={color}
                    strokeOpacity={isStock ? 0.38 : 0.18}
                    strokeWidth={2}
                  />
                  <circle
                    r={radius}
                    fill={isStock ? stockGradient(node.signalSide) : theme.surface}
                    stroke={isStock ? color : theme.grid}
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isStock ? color : theme.ink}
                    fontFamily={theme.fontMono}
                    fontWeight={800}
                    fontSize={isStock ? 12 : 9}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {isStock ? `$${node.label}` : shortFundName(node.label)}
                  </text>
                  <text
                    y={radius + 16}
                    textAnchor="middle"
                    fill={theme.muted}
                    fontFamily={theme.fontMono}
                    fontSize={9}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {isStock ? `${node.fundCount ?? 0} funds` : trimLabel(node.label, 18)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-[0.68rem] text-muted-foreground">
          <LegendItem color={theme.accent} label="Bullish buy" />
          <LegendItem color={theme.loss} label="Sell/reduction" />
          <LegendItem color="#f59e0b" label="Put exposure" />
          <LegendItem color={theme.muted} label="13F filer" />
          <span>Node size = score / cluster size</span>
          <span>Line width = reported value</span>
        </div>
        <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-sky-400">
          Delayed 13F snapshot
        </div>
      </div>
    </div>
  );
}

function buildGraphKey(nodes: SmartMoneyNetworkNode[], links: SmartMoneyNetworkLink[]) {
  const nodeKey = nodes
    .map((node) => `${node.id}:${node.kind}:${node.score}:${node.signalSide ?? ""}:${node.fundCount ?? ""}`)
    .join("|");
  const linkKey = links
    .map((link) => `${link.source}:${link.target}:${link.ticker}:${link.signalSide}:${link.value ?? ""}:${link.changeShares ?? ""}`)
    .join("|");
  return `${nodeKey}::${linkKey}`;
}

function layoutNodes(nodes: SmartMoneyNetworkNode[]): SimNode[] {
  const stockNodes = nodes.filter((node) => node.kind === "stock");
  const fundNodes = nodes.filter((node) => node.kind === "fund");
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;

  return [
    ...stockNodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, stockNodes.length);
      const ring = stockNodes.length > 1 ? 82 : 0;
      return {
        ...node,
        x: roundSvgNumber(centerX + Math.cos(angle) * ring),
        y: roundSvgNumber(centerY + Math.sin(angle) * ring),
      };
    }),
    ...fundNodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, fundNodes.length);
      return {
        ...node,
        x: roundSvgNumber(centerX + Math.cos(angle) * 210),
        y: roundSvgNumber(centerY + Math.sin(angle) * 165),
      };
    }),
  ];
}

function formatSvgNumber(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.000";
  return value.toFixed(SVG_DECIMAL_PLACES);
}

function roundSvgNumber(value: number) {
  return Number(formatSvgNumber(value));
}

function materializeLinks(nodes: SimNode[], links: SmartMoneyNetworkLink[]): SimLink[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return links
    .filter((link) => nodeById.has(link.source) && nodeById.has(link.target))
    .map((link) => ({
      ...link,
      source: nodeById.get(link.source)!,
      target: nodeById.get(link.target)!,
    }));
}

function nodeRadius(node: SmartMoneyNetworkNode) {
  if (node.kind === "stock") return 22 + Math.min(20, (node.fundCount ?? 0) * 2 + node.score / 12);
  return 14 + Math.min(10, node.score / 16);
}

function shortFundName(name: string) {
  const clean = name
    .replace(/\b(LLC|LP|L\.P\.|INC|CO\.?|ADVISORS?|MANAGEMENT|CAPITAL)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length <= 1) return trimLabel(clean || name, 7).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function trimLabel(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function signalColor(signalSide: SmartMoneySignalSide | undefined, theme: ReturnType<typeof getChartTheme>) {
  if (signalSide === "LONG_SELL") return theme.loss;
  if (signalSide === "PUT_BEARISH") return "#f59e0b";
  return theme.accent;
}

function stockGradient(signalSide: SmartMoneySignalSide | undefined) {
  if (signalSide === "LONG_SELL") return "url(#smart-money-stock-sell)";
  if (signalSide === "PUT_BEARISH") return "url(#smart-money-stock-put)";
  return "url(#smart-money-stock-long)";
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-2.5 rounded-full")} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
