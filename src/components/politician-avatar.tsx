import Image from "next/image";

import type { Party } from "@/lib/types";
import { cn } from "@/lib/utils";

function svgDataUrl(name: string, party: Party) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const accent = party === "D" ? "%232563EB" : "%23DC2626";
  const mid = party === "D" ? "%232f5fae" : "%23b23b3b";

  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><defs><radialGradient id='g' cx='35%25' cy='20%25' r='80%25'><stop offset='0%25' stop-color='${mid}' stop-opacity='.9'/><stop offset='42%25' stop-color='${accent}' stop-opacity='.7'/><stop offset='100%25' stop-color='%231a1714'/></radialGradient><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 .22'/></feComponentTransfer></filter></defs><rect width='160' height='160' rx='28' fill='url(%23g)'/><rect width='160' height='160' rx='28' filter='url(%23n)' opacity='.25'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='ui-monospace, SFMono-Regular, Menlo, monospace' font-size='48' fill='white' font-weight='800'>${initials}</text></svg>`;
}

export function PoliticianAvatar({
  name,
  party,
  className,
  priority = false,
}: {
  name: string;
  party: Party;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={svgDataUrl(name, party)}
      alt={`${name} avatar`}
      width={160}
      height={160}
      unoptimized
      priority={priority}
      className={cn("rounded-lg border border-border object-cover", className)}
    />
  );
}
