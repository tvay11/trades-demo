export interface TradeOutcome {
  politician: string;
  excess30: number | null;
  excess90: number | null;
}

export interface TrackRecordRow {
  politician: string;
  samples: number;
  hitRate30: number;
  avgExcess30: number;
  avgExcess90: number | null;
}

export function aggregateTrackRecords(outcomes: TradeOutcome[]): TrackRecordRow[] {
  const byPol = new Map<string, TradeOutcome[]>();
  for (const o of outcomes) {
    if (o.excess30 == null) continue;
    const list = byPol.get(o.politician) ?? [];
    list.push(o);
    byPol.set(o.politician, list);
  }
  const rows: TrackRecordRow[] = [];
  for (const [politician, list] of byPol) {
    const ex30 = list.map((o) => o.excess30!);
    const ex90 = list.map((o) => o.excess90).filter((v): v is number => v != null);
    rows.push({
      politician,
      samples: list.length,
      hitRate30: (ex30.filter((v) => v > 0).length / ex30.length) * 100,
      avgExcess30: ex30.reduce((s, v) => s + v, 0) / ex30.length,
      avgExcess90: ex90.length ? ex90.reduce((s, v) => s + v, 0) / ex90.length : null,
    });
  }
  return rows;
}
