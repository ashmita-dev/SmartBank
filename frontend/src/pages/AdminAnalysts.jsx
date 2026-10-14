import { Bell, Search, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { getAnalystWorkload } from "../api";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
  RefreshButton,
  SummaryCard,
} from "../components/ui";
import useApiData from "../hooks/useApiData";

const BREAKDOWN = [
  { key: "open_alerts", label: "Open", tone: "open" },
  { key: "investigating_alerts", label: "Investigating", tone: "investigating" },
  { key: "confirmed_fraud", label: "Confirmed fraud", tone: "confirmed_fraud" },
  { key: "false_positive", label: "False positive", tone: "false_positive" },
];

function AdminAnalysts() {
  const { data, loading, refreshing, error, refresh } = useApiData(() => getAnalystWorkload());
  const analysts = data || [];

  const sum = (key) => analysts.reduce((total, a) => total + Number(a[key] || 0), 0);

  if (loading) {
    return <LoadingState text="Loading analyst workload…" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="FRAUD OPERATIONS"
        title="Analyst Workload"
        description="GENERATE_ALERT assigns each new alert to the analyst with the fewest OPEN alerts. This view shows how that workload is distributed."
        actions={<RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh workload" />}
      />

      <ErrorBanner error={error} onRetry={refresh} />

      <section className="alert-summary-grid four">
        <SummaryCard icon={<Users size={20} />} label="Analysts" value={analysts.length} />
        <SummaryCard icon={<Bell size={20} />} label="Open" value={sum("open_alerts")} tone="danger" />
        <SummaryCard icon={<Search size={20} />} label="Investigating" value={sum("investigating_alerts")} tone="warning" />
        <SummaryCard icon={<ShieldCheck size={20} />} label="Resolved" value={sum("confirmed_fraud") + sum("false_positive")} />
      </section>

      {analysts.length ? (
        <section className="workload-grid">
          {analysts.map((analyst) => {
            const total = Number(analyst.total_assigned || 0);

            return (
              <article className="panel analyst-card" key={analyst.analyst_id}>
                <div className="analyst-card-head">
                  <div className="analyst-avatar" aria-hidden="true">
                    {(analyst.name || "A").charAt(0).toUpperCase()}
                  </div>

                  <div className="analyst-info">
                    <h3>{analyst.name}</h3>
                    <span>{analyst.department || "Fraud Operations"}</span>
                  </div>

                  <div className="analyst-number">
                    <strong>{total}</strong>
                    <span>assigned</span>
                  </div>
                </div>

                <div
                  className="workload-bar"
                  role="img"
                  aria-label={BREAKDOWN.map((b) => `${b.label}: ${analyst[b.key] || 0}`).join(", ")}
                >
                  {BREAKDOWN.map((b) =>
                    Number(analyst[b.key]) > 0 ? (
                      <span
                        key={b.key}
                        className={`seg ${b.tone}`}
                        style={{ flexGrow: Number(analyst[b.key]) }}
                      />
                    ) : null
                  )}
                </div>

                <dl className="workload-breakdown">
                  {BREAKDOWN.map((b) => (
                    <div key={b.key}>
                      <dt>
                        <span className={`legend-dot ${b.tone}`} />
                        {b.label}
                      </dt>
                      <dd>{analyst[b.key] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel full-panel">
          <EmptyState text="No analysts found in FRAUD_ANALYST." icon={ShieldOff} />
        </section>
      )}
    </>
  );
}

export default AdminAnalysts;
