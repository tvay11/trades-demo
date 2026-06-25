/** Model probabilities are never truly 0/100 — clamp the display. */
export function formatProb(p: number): string {
  if (p > 99) return ">99%";
  if (p < 1) return "<1%";
  return `${p.toFixed(0)}%`;
}
