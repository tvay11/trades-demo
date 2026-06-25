import type { LedgerInsiderTrade, LedgerOfficialTrade } from "@/lib/ledger/types";

const bigUsd = (n: number | null): string => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtAmount = (t: LedgerOfficialTrade): string => {
  if (t.amountRangeRaw) return t.amountRangeRaw;
  if (t.amountMin != null && t.amountMax != null) return `${bigUsd(t.amountMin)}–${bigUsd(t.amountMax)}`;
  if (t.amountMin != null) return `≥${bigUsd(t.amountMin)}`;
  return "—";
};

const actionColor = (action: "buy" | "sell" | "other"): string =>
  action === "buy" ? "var(--bull)" : action === "sell" ? "var(--bear)" : "var(--muted-foreground)";

interface Props {
  official?: LedgerOfficialTrade[];
  insider?: LedgerInsiderTrade[];
}

export function TradesSection({ official = [], insider = [] }: Props) {
  if (official.length === 0 && insider.length === 0) return null;

  return (
    <div className="sec">
      <div className="secline">
        <h3>VII. Insider &amp; Political Activity</h3>
        <span className="meta">form 4 · congressional disclosures</span>
      </div>

      {official.length > 0 && (
        <div className="kl-trades-block">
          <div className="kl-trades-subtitle">Congressional &amp; Executive Trades</div>
          <div style={{ overflowX: "auto" }}>
            <table className="ledger kl-trades-table">
              <thead>
                <tr>
                  <th>Filer</th>
                  <th>Party / State</th>
                  <th>Action</th>
                  <th>Amount</th>
                  <th>Transacted</th>
                  <th>Disclosed</th>
                </tr>
              </thead>
              <tbody>
                {official.map((t, i) => (
                  <tr key={i}>
                    <td className="k" style={{ whiteSpace: "nowrap" }}>
                      {t.name}{" "}
                      <span className={`kl-branch-badge kl-branch-${t.branch}`}>
                        {t.branch === "congress" ? "Cong" : "Exec"}
                      </span>
                    </td>
                    <td>
                      {t.branch === "executive"
                        ? (t.agency ?? "—")
                        : [t.party, t.state].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ color: actionColor(t.action), fontWeight: 700, textTransform: "uppercase", fontSize: "11px" }}>
                      {t.action}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtAmount(t)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.transactionDate}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.disclosureDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insider.length > 0 && (
        <div className="kl-trades-block" style={{ marginTop: official.length > 0 ? "20px" : "0" }}>
          <div className="kl-trades-subtitle">Corporate Insider Trades (Form 4)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="ledger kl-trades-table">
              <thead>
                <tr>
                  <th>Insider</th>
                  <th>Action</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>Transacted</th>
                  <th>Filed</th>
                </tr>
              </thead>
              <tbody>
                {insider.map((t, i) => (
                  <tr key={i}>
                    <td className="k" style={{ whiteSpace: "nowrap" }}>
                      {t.name}
                      {t.title ? (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>
                          {t.title}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ color: actionColor(t.action), fontWeight: 700, textTransform: "uppercase", fontSize: "11px" }}>
                      {t.action}
                    </td>
                    <td>{t.shares != null ? t.shares.toLocaleString() : "—"}</td>
                    <td>{t.pricePerShare != null ? `$${t.pricePerShare.toFixed(2)}` : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{bigUsd(t.totalValue)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.transactionDate}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.filingDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="filing-note">
        Congressional disclosures via STOCK Act · Corporate Form 4 via SEC EDGAR — disclosures only, not financial advice.
      </p>
    </div>
  );
}
