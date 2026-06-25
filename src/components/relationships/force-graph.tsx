"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type {
  RelationshipNetworkLink,
  RelationshipNetworkNode,
  RelationshipNodeId,
} from "@/lib/queries/relationships";
import { cn } from "@/lib/utils";
import { getChartTheme } from "@/components/charts/chartTheme";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SimNode = SimulationNodeDatum &
  RelationshipNetworkNode & { x: number; y: number; fx?: number | null; fy?: number | null };

type SimLink = SimulationLinkDatum<SimNode> &
  Omit<RelationshipNetworkLink, "source" | "target">;

type ForceGraphProps = {
  nodes: RelationshipNetworkNode[];
  links: RelationshipNetworkLink[];
};

type TooltipState =
  | { kind: "node"; node: SimNode; x: number; y: number }
  | { kind: "link"; link: SimLink; x: number; y: number }
  | null;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const WIDTH = 900;
const HEIGHT = 500;
const NODE_MIN_R = 14;
const NODE_MAX_R = 32;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ForceGraph({ nodes: rawNodes, links: rawLinks }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [isolatedNodeId, setIsolatedNodeId] = useState<RelationshipNodeId | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragging = useRef<{
    nodeId: RelationshipNodeId;
    startMouse: { x: number; y: number };
    startNode: { x: number; y: number };
  } | null>(null);
  const panning = useRef<{ startMouse: { x: number; y: number }; startTransform: { x: number; y: number } } | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);

  /* -- radius helper -- */
  const maxEvents = useMemo(
    () => Math.max(1, ...rawNodes.map((n) => n.pairEventCount)),
    [rawNodes],
  );
  const nodeRadius = useCallback(
    (n: RelationshipNetworkNode) => {
      const t = n.pairEventCount / maxEvents;
      return NODE_MIN_R + t * (NODE_MAX_R - NODE_MIN_R);
    },
    [maxEvents],
  );

  /* -- init simulation -- */
  useEffect(() => {
    if (!rawNodes.length) return;

    const nodes: SimNode[] = rawNodes.map((n) => ({
      ...n,
      x: WIDTH / 2 + (Math.random() - 0.5) * 200,
      y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
    }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = rawLinks
      .filter((l) => nodeById.has(l.source as number) && nodeById.has(l.target as number))
      .map((l) => ({
        ...l,
        source: nodeById.get(l.source as number)!,
        target: nodeById.get(l.target as number)!,
      }));

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(100)
          .strength(0.6),
      )
      .force("charge", forceManyBody<SimNode>().strength(-320))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        forceCollide<SimNode>((d) => nodeRadius(d) + 6),
      )
      .alphaDecay(0.028)
      .on("tick", () => {
        setSimNodes([...nodes]);
        setSimLinks([...links]);
      });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [rawNodes, rawLinks, nodeRadius]);

  /* -- SVG coordinate helper -- */
  const svgPoint = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  /* -- zoom -- */
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const pt = svgPoint(e);
      setTransform((prev) => {
        const newK = Math.max(0.3, Math.min(5, prev.k * factor));
        return {
          k: newK,
          x: pt.x - ((pt.x - prev.x) / prev.k) * newK,
          y: pt.y - ((pt.y - prev.y) / prev.k) * newK,
        };
      });
    },
    [svgPoint],
  );

  /* -- drag / pan handlers -- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pt = svgPoint(e);
      const worldX = (pt.x - transform.x) / transform.k;
      const worldY = (pt.y - transform.y) / transform.k;
      const simulationNodes = simRef.current?.nodes() ?? [];

      // Check if we hit a node
      for (const n of simulationNodes) {
        const r = nodeRadius(n);
        const dx = worldX - n.x;
        const dy = worldY - n.y;
        if (dx * dx + dy * dy < r * r) {
          dragging.current = {
            nodeId: n.id,
            startMouse: pt,
            startNode: { x: n.x, y: n.y },
          };
          n.fx = n.x;
          n.fy = n.y;
          simRef.current?.alphaTarget(0.3).restart();
          (e.target as Element).setPointerCapture(e.pointerId);
          return;
        }
      }

      // No node hit — start panning
      panning.current = {
        startMouse: pt,
        startTransform: { x: transform.x, y: transform.y },
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [svgPoint, transform, nodeRadius],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pt = svgPoint(e);
      if (dragging.current) {
        const dx = (pt.x - dragging.current.startMouse.x) / transform.k;
        const dy = (pt.y - dragging.current.startMouse.y) / transform.k;
        const node = simRef.current?.nodes().find((n) => n.id === dragging.current!.nodeId);
        if (node) {
          node.fx = dragging.current.startNode.x + dx;
          node.fy = dragging.current.startNode.y + dy;
        }
        return;
      }
      if (panning.current) {
        setTransform((prev) => ({
          ...prev,
          x: panning.current!.startTransform.x + (pt.x - panning.current!.startMouse.x),
          y: panning.current!.startTransform.y + (pt.y - panning.current!.startMouse.y),
        }));
      }
    },
    [svgPoint, transform.k],
  );

  const onPointerUp = useCallback(() => {
    if (dragging.current) {
      const node = simRef.current?.nodes().find((n) => n.id === dragging.current!.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      simRef.current?.alphaTarget(0);
      dragging.current = null;
    }
    panning.current = null;
  }, []);

  /* -- isolation -- */
  const connectedIds = useMemo(() => {
    if (isolatedNodeId === null) return null;
    const ids = new Set<RelationshipNodeId>([isolatedNodeId]);
    for (const l of simLinks) {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      if (s === isolatedNodeId) ids.add(t);
      if (t === isolatedNodeId) ids.add(s);
    }
    return ids;
  }, [isolatedNodeId, simLinks]);

  const isLinkVisible = useCallback(
    (l: SimLink) => {
      if (!connectedIds) return true;
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      return connectedIds.has(s) && connectedIds.has(t);
    },
    [connectedIds],
  );

  const theme = getChartTheme();

  if (!rawNodes.length) {
    return (
      <div className="grid min-h-[400px] place-items-center p-6 text-center">
        <div>
          <div className="mx-auto mb-3 size-16 rounded-full border border-border bg-muted/20" />
          <div className="font-semibold">No relationship links found</div>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Backfill CongressTrade rows or widen the window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative h-[500px] overflow-hidden">
        <div className="absolute inset-0" />

        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative graph */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="absolute inset-0 size-full cursor-grab active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Links */}
            {simLinks.map((l) => {
              const src = l.source as SimNode;
              const tgt = l.target as SimNode;
              const sameRatio = l.sameDirectionCount / Math.max(1, l.pairEventCount);
              const strokeWidth = Math.min(5, 1 + l.pairEventCount * 0.5);
              const visible = isLinkVisible(l);

              return (
                <line
                  key={`${src.id}:${tgt.id}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={sameRatio >= 0.5 ? `${theme.profit}80` : `${theme.loss}80`}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  opacity={visible ? 1 : 0.08}
                  className="transition-opacity duration-200"
                  onMouseEnter={(e) => {
                    const pt = svgPoint(e);
                    setTooltip({ kind: "link", link: l, x: pt.x, y: pt.y });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* Nodes */}
            {simNodes.map((n) => {
              const r = nodeRadius(n);
              const isD = n.party?.toUpperCase().startsWith("D");
              const isR = n.party?.toUpperCase().startsWith("R");
              const visible = !connectedIds || connectedIds.has(n.id);

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={visible ? 1 : 0.1}
                  className="transition-opacity duration-200"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setIsolatedNodeId((prev) => (prev === n.id ? null : n.id))
                  }
                  onMouseEnter={(e) => {
                    const pt = svgPoint(e);
                    setTooltip({ kind: "node", node: n, x: pt.x, y: pt.y });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Ring */}
                  <circle
                    r={r + 4}
                    fill="none"
                    stroke={isD ? `${theme.dem}4d` : isR ? `${theme.rep}4d` : `${theme.muted}26`}
                    strokeWidth={2}
                  />
                  {/* Main circle */}
                  <circle
                    r={r}
                    fill={theme.surface}
                    stroke={isD ? `${theme.dem}b3` : isR ? `${theme.rep}b3` : `${theme.muted}40`}
                    strokeWidth={2}
                  />
                  {/* Initials */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isD ? theme.dem : isR ? theme.rep : theme.muted}
                    fontSize={r * 0.65}
                    fontWeight={800}
                    fontFamily="monospace"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {initials(n.name)}
                  </text>
                  {/* Name label */}
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fill={theme.muted}
                    fontSize={9}
                    fontFamily="monospace"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {n.name.length > 18 ? `${n.name.slice(0, 16)}…` : n.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <GraphTooltip tooltip={tooltip} />
        )}
      </div>

      {/* Legend + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-[0.68rem]">
          <LegendItem color={theme.profit} label="Same direction" />
          <LegendItem color={theme.loss} label="Opposite direction" />
          <span className="text-muted-foreground">Line thickness = event count</span>
          <span className="text-muted-foreground">Node size = activity level</span>
        </div>
        <div className="flex items-center gap-2">
          {isolatedNodeId !== null && (
            <button
              type="button"
              onClick={() => setIsolatedNodeId(null)}
              className="rounded border border-border bg-muted/30 px-3 py-1.5 font-mono text-[0.68rem] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Reset isolation
            </button>
          )}
          <button
            type="button"
            onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
            className="rounded border border-border bg-muted/30 px-3 py-1.5 font-mono text-[0.68rem] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Reset zoom
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

function GraphTooltip({ tooltip }: { tooltip: NonNullable<TooltipState> }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `min(${(tooltip.x / WIDTH) * 100}%, calc(100% - 260px))`,
    top: `min(${(tooltip.y / HEIGHT) * 100}%, calc(100% - 120px))`,
    transform: "translate(12px, -50%)",
    pointerEvents: "none",
    zIndex: 50,
  };

  if (tooltip.kind === "node") {
    const { node } = tooltip;
    return (
      <div style={style} className="w-56 rounded border border-border bg-card p-3 shadow-md">
        <div className="font-mono text-xs font-bold text-foreground">{node.name}</div>
        <div className="mt-1 flex items-center gap-2 text-[0.68rem] text-muted-foreground">
          <PartyDot party={node.party} />
          {node.party ?? "Independent"} · {node.state ?? "—"}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <TooltipStat label="Connections" value={node.connectionCount} />
          <TooltipStat label="Pair Events" value={node.pairEventCount} />
        </div>
        <div className="mt-2 font-mono text-[0.62rem] text-muted-foreground/60">
          Click to isolate · Drag to move
        </div>
      </div>
    );
  }

  const { link } = tooltip;
  const src = link.source as SimNode;
  const tgt = link.target as SimNode;
  return (
    <div style={style} className="w-60 rounded border border-border bg-card p-3 shadow-md">
      <div className="font-mono text-[0.68rem] font-bold text-foreground">
        {src.name} ↔ {tgt.name}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <TooltipStat label="Events" value={link.pairEventCount} />
        <TooltipStat label="Same" value={link.sameDirectionCount} color="text-profit" />
        <TooltipStat label="Opposite" value={link.oppositeDirectionCount} color="text-loss" />
      </div>
      {link.tickerHighlights?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {link.tickerHighlights.map((t) => (
            <span key={t.ticker} className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[0.62rem] text-primary">
              ${t.ticker} ×{t.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TooltipStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="font-mono text-[0.58rem] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm font-bold", color ?? "text-foreground")}>{value}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function PartyDot({ party }: { party: string | null }) {
  const isD = party?.toUpperCase().startsWith("D");
  const isR = party?.toUpperCase().startsWith("R");
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        isD && "bg-democrat",
        isR && "bg-republican",
        !isD && !isR && "bg-muted-foreground/30",
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
