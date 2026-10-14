import { useMemo, useState } from "react";
import { AlertTriangle, Bell, ChevronRight, Search, Shield, ShieldCheck, X } from "lucide-react";
import { getAlerts } from "../api";
import AlertModal from "../components/AlertModal";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Notice,
  PageHeader,
  RefreshButton,
  RiskBadge,
  StatusBadge,
  SummaryCard,
} from "../components/ui";
import useApiData from "../hooks/useApiData";
import { formatCurrency, formatDate, formatLabel, matchesSearch } from "../utils/format";

const RISK_LEVELS = ["ALL", "HIGH", "MEDIUM"];
const STATUSES = ["ACTIVE", "ALL", "OPEN", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE", "CLOSED"];

function isActive(alert) {
  return ["OPEN", "INVESTIGATING"].includes(String(alert.status).toUpperCase());
}

function AdminAlerts() {
  const { data, setData, loading, refreshing, error, refresh } = useApiData(() => getAlerts());
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);

  const alerts = useMemo(() => data || [], [data]);

  const filtered = useMemo(
    () =>
      alerts.filter((alert) => {
        const status = String(alert.status).toUpperCase();

        if (riskFilter !== "ALL" && String(alert.risk_level).toUpperCase() !== riskFilter) return false;
        if (statusFilter === "ACTIVE" && !isActive(alert)) return false;
        if (!["ACTIVE", "ALL"].includes(statusFilter) && status !== statusFilter) return false;

        return matchesSearch(
          [alert.alert_id, alert.transaction_id, alert.reason, alert.analyst_name, alert.location],
          search
        );
      }),
    [alerts, riskFilter, statusFilter, search]
  );

  const activeCount = alerts.filter(isActive).length;
  const highCount = alerts.filter((a) => String(a.risk_level).toUpperCase() === "HIGH").length;
  const confirmedCount = alerts.filter((a) => String(a.status).toUpperCase() === "CONFIRMED_FRAUD").length;

  function handleUpdated(alertId, status) {
    setData((current) =>
      current.map((alert) => (alert.alert_id === alertId ? { ...alert, status } : alert))
    );
    setSelected(null);
    setNotice(`Alert #${alertId} saved as ${formatLabel(status)} in FRAUD_ALERT.`);
    // Reload so counts and ordering reflect what Oracle now stores.
    refresh();
  }

  if (loading) {
    return <LoadingState text="Loading fraud alerts…" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="FRAUD OPERATIONS"
        title="Fraud Alert Center"
        description="Alerts raised by DETECT_FRAUD for MEDIUM and HIGH risk transactions. Open an alert to review its evidence and record a decision."
        actions={<RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh alerts" />}
      />

      <ErrorBanner error={error} onRetry={refresh} />

      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <section className="alert-summary-grid four">
        <SummaryCard icon={<Bell size={20} />} label="Awaiting review" value={activeCount} tone="warning" />
        <SummaryCard icon={<AlertTriangle size={20} />} label="High risk" value={highCount} tone="danger" />
        <SummaryCard icon={<ShieldCheck size={20} />} label="Confirmed fraud" value={confirmedCount} />
        <SummaryCard icon={<Shield size={20} />} label="Total alerts" value={alerts.length} />
      </section>

      <section className="toolbar toolbar-stack">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search alerts</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reason, analyst, location, alert or transaction ID…"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="toolbar-filters">
          <div className="filter-group" role="group" aria-label="Filter by risk level">
            {RISK_LEVELS.map((level) => (
              <button
                type="button"
                key={level}
                className={riskFilter === level ? "filter active" : "filter"}
                aria-pressed={riskFilter === level}
                onClick={() => setRiskFilter(level)}
              >
                {level === "ALL" ? "ALL RISK" : level}
              </button>
            ))}
          </div>

          <label className="select-control">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "ACTIVE"
                    ? "Awaiting review (open + investigating)"
                    : status === "ALL"
                    ? "All statuses"
                    : formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <span className="result-count" aria-live="polite">
            {filtered.length} of {alerts.length}
          </span>
        </div>
      </section>

      <section className="panel full-panel">
        {filtered.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Alert</th>
                  <th scope="col">Risk</th>
                  <th scope="col" className="num">Score</th>
                  <th scope="col">Reasons</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Analyst</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    tabIndex={0}
                    onClick={() => setSelected(alert)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(alert);
                      }
                    }}
                  >
                    <td>
                      <strong>#{alert.alert_id}</strong>
                      <small>Txn #{alert.transaction_id} · {formatDate(alert.created_at, { withTime: false })}</small>
                    </td>
                    <td><RiskBadge level={alert.risk_level} /></td>
                    <td className="num"><strong>{alert.risk_score}</strong></td>
                    <td className="reason-cell">{alert.reason || "—"}</td>
                    <td className="num">{formatCurrency(alert.amount)}</td>
                    <td><small>{alert.analyst_name || "Unassigned"}</small></td>
                    <td><StatusBadge status={alert.status} /></td>
                    <td><ChevronRight size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text={alerts.length ? "No alerts match these filters." : "No fraud alerts in the database."} />
        )}
      </section>

      {selected && (
        <AlertModal alert={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </>
  );
}

export default AdminAlerts;
