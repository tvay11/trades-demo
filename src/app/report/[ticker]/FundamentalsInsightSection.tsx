import type { FundamentalsInsight } from "@/lib/ledger/types";

export function FundamentalsInsightSection({ insight }: { insight: FundamentalsInsight | null }) {
  if (!insight || (!insight.interpretation && insight.riskFactors.length === 0)) return null;
  return (
    <div className="kl-fund-insight">
      {insight.interpretation && (
        <p className="kl-fund-read">
          <span className="kl-fund-read-label">Reading:</span> {insight.interpretation}
        </p>
      )}
      {insight.riskFactors.length > 0 && (
        <div className="kl-risk-factors">
          <h4 className="kl-risk-title">Key Risk Factors</h4>
          <ul className="kl-risk-list">
            {insight.riskFactors.map((r, i) => (
              <li key={i} className="kl-risk-item">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
