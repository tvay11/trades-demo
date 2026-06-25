"use client";

import { useState, useTransition } from "react";
import { askReportAction } from "./actions";

export function AskReportBox({ ticker }: { ticker: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      const res = await askReportAction(ticker, q);
      if (res.ok && res.answer) setAnswer(res.answer);
      else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="kl-ask">
      <h3 className="kl-ask-title">Ask the Report</h3>
      <p className="kl-ask-sub">Answers come only from this report&apos;s data. Research, not financial advice.</p>
      <div className="kl-ask-row">
        <input
          className="kl-ask-input"
          type="text"
          value={question}
          maxLength={500}
          placeholder={`Ask about ${ticker} — e.g. "Why is the rating HOLD?"`}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          disabled={pending}
        />
        <button className="kl-ask-btn" onClick={submit} disabled={pending || !question.trim()}>
          {pending ? "Asking…" : "Ask"}
        </button>
      </div>
      {answer && <p className="kl-ask-answer">{answer}</p>}
      {error && <p className="kl-ask-error">{error}</p>}
    </div>
  );
}
