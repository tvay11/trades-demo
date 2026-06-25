import sectors from "@/data/sectors.json";

const map = sectors as Record<string, string>;

export function sectorOf(ticker: string): string {
  const key = ticker.trim().toUpperCase();
  if (!key) return "Unknown";
  return map[key] ?? "Unknown";
}
