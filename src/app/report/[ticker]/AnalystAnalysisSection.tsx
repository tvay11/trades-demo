import type { AnalystAnalysis } from "@/lib/ledger/types";
import { humanizeEvidence } from "@/lib/llm/humanizeEvidence";

import { ReportCallout } from "./ReportCallout";

export function AnalystAnalysisSection({
  analysis,
  legacyNote,
}: {
  analysis: AnalystAnalysis | null | undefined;
  legacyNote: string | null | undefined;
}) {
  if (!analysis && !legacyNote) return null;

  if (!analysis && legacyNote) {
    return (
      <div className="sec">
        <div className="secline"><h3>Analyst&rsquo;s Note</h3><span className="meta">AI-generated · interpretive</span></div>
        {legacyNote.split(/\n\n+/).map((para, i) => (
          <p key={i} className="analyst-legacy-note">{para}</p>
        ))}
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="sec analyst-structured">
      <div className="secline"><h3>Analyst&rsquo;s Note</h3><span className="meta">AI-generated · structured</span></div>
      {analysis.verdict ? (
        <div className={`analyst-verdict verdict-${analysis.verdict.action.toLowerCase()}`}>
          <span className="verdict-action">{analysis.verdict.action}</span>
          <span className="verdict-conviction">{analysis.verdict.conviction} conviction</span>
          <p className="verdict-bottom-line">{analysis.verdict.bottomLine}</p>
        </div>
      ) : null}
      <h4 className="analyst-headline">{analysis.headline}</h4>
      <p className="analyst-thesis">{analysis.thesis}</p>
      <div className="lens-grid">
        {analysis.lensReads.map((lens) => (
          <div className={`lens-card lens-${lens.posture}`} key={lens.lens}>
            <div className={`pill ${lens.posture}`}>{lens.lens}</div>
            <p>{lens.summary}</p>
            {lens.evidence.length > 0 ? (
              <ul>{lens.evidence.map((item) => <li key={item}>{humanizeEvidence(item)}</li>)}</ul>
            ) : null}
          </div>
        ))}
      </div>
      <div className="takeaways">
        {analysis.takeaways.map((item) => (
          <p className={`takeaway takeaway-${item.kind}`} key={`${item.kind}-${item.label}`}>
            <b>{item.label}:</b> {item.text}
          </p>
        ))}
      </div>
      <div className="analyst-conclusion-grid">
        <ReportCallout title="Key tension" tone="mixed" className="analyst-key-tension">
          <p>{analysis.keyTension}</p>
        </ReportCallout>
        <ReportCallout title="What would change" tone="watch" className="analyst-what-would-change">
          <p>{analysis.whatWouldChange}</p>
        </ReportCallout>
      </div>
    </div>
  );
}
