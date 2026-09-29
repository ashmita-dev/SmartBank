import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Database,
  Shield,
  X,
} from "lucide-react";
import { getAlerts, updateAlert } from "../api";

function riskClass(level) {
  return String(level || "LOW").toLowerCase();
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [updating, setUpdating] = useState(false);

  async function loadAlerts(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const data = await getAlerts();

      setAlerts(
        Array.isArray(data)
          ? data
          : data?.items || []
      );
    } catch (err) {
      setError(err?.message || "Unable to load fraud alerts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    if (filter === "ALL") {
      return alerts;
    }

    return alerts.filter(
      (alert) =>
        String(alert.risk_level || "").toUpperCase() === filter
    );
  }, [alerts, filter]);

  const openAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const status = String(alert.status || "").toUpperCase();

        return status === "OPEN" || status === "INVESTIGATING";
      }),
    [alerts]
  );

  const highRiskAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(alert.risk_level || "").toUpperCase() === "HIGH"
      ),
    [alerts]
  );

  async function handleStatusUpdate(alertId, status) {
    try {
      setUpdating(true);
      setError("");

      await updateAlert(alertId, status);

      await loadAlerts(true);

      setSelectedAlert(null);
    } catch (err) {
      setError(err?.message || "Unable to update alert.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading fraud alerts...</span>
      </div>
    );
  }

  return (
    <>
      <section className="page-header">
        <div className="section-label">FRAUD OPERATIONS</div>
        <h1>Fraud Alert Center</h1>
        <p>
          Review suspicious transactions, investigate risk signals,
          and manage fraud alerts from the SmartBank database.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => loadAlerts(true)}>
            Retry
          </button>
        </div>
      )}

      <section className="alert-summary-grid">
        <div className="summary-card">
          <div className="summary-icon">
            <Bell size={20} />
          </div>

          <div>
            <span>Open Alerts</span>
            <strong>{openAlerts.length}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <AlertTriangle size={20} />
          </div>

          <div>
            <span>High Risk</span>
            <strong>{highRiskAlerts.length}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Shield size={20} />
          </div>

          <div>
            <span>Total Alerts</span>
            <strong>{alerts.length}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <div className="filter-group">
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((level) => (
            <button
              key={level}
              className={
                filter === level
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setFilter(level)}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <span className="result-count">
            {filteredAlerts.length} alerts
          </span>

          <button
            className="refresh-button"
            onClick={() => loadAlerts(true)}
            disabled={refreshing}
            title="Refresh alerts"
          >
            <span className={refreshing ? "spin" : ""}>
              ↻
            </span>
          </button>
        </div>
      </section>

      <section className="panel full-panel">
        <div className="alert-table">
          <div className="alert-table-head">
            <span>Alert</span>
            <span>Risk</span>
            <span>Score</span>
            <span>Reason</span>
            <span>Status</span>
            <span />
          </div>

          {filteredAlerts.length ? (
            filteredAlerts.map((alert) => (
              <button
                className="alert-table-row"
                key={alert.alert_id}
                onClick={() => setSelectedAlert(alert)}
              >
                <span className="alert-id">
                  #{alert.alert_id}
                </span>

                <span>
                  <span
                    className={`risk-badge ${riskClass(
                      alert.risk_level
                    )}`}
                  >
                    {alert.risk_level || "LOW"}
                  </span>
                </span>

                <span className="score">
                  {alert.risk_score ?? 0}/100
                </span>

                <span className="reason-cell">
                  {alert.reason || "Suspicious activity detected"}
                </span>

                <span>
                  <span
                    className={`status-badge ${String(
                      alert.status || "OPEN"
                    ).toLowerCase()}`}
                  >
                    {alert.status || "OPEN"}
                  </span>
                </span>

                <span>
                  <ChevronRight size={17} />
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <Database size={20} />
              <span>No alerts match this filter.</span>
            </div>
          )}
        </div>
      </section>

      {selectedAlert && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="alert-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="section-label">
                  FRAUD ALERT
                </div>

                <h2>
                  Alert #{selectedAlert.alert_id}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedAlert(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-risk">
              <div>
                <span className="modal-label">
                  Risk level
                </span>

                <span
                  className={`risk-badge ${riskClass(
                    selectedAlert.risk_level
                  )}`}
                >
                  {selectedAlert.risk_level || "LOW"}
                </span>
              </div>

              <div>
                <span className="modal-label">
                  Risk score
                </span>

                <strong className="large-score">
                  {selectedAlert.risk_score ?? 0}
                  <small>/100</small>
                </strong>
              </div>
            </div>

            <div className="modal-details">
              <div>
                <span>Transaction</span>
                <strong>
                  #{selectedAlert.transaction_id ?? "—"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {selectedAlert.status || "OPEN"}
                </strong>
              </div>

              <div className="full-detail">
                <span>Fraud reasoning</span>
                <strong>
                  {selectedAlert.reason ||
                    "Suspicious transaction detected"}
                </strong>
              </div>

              <div className="full-detail">
                <span>Created</span>
                <strong>
                  {formatDate(selectedAlert.created_at)}
                </strong>
              </div>

              {selectedAlert.analyst_name && (
                <div className="full-detail">
                  <span>Assigned Analyst</span>
                  <strong>
                    {selectedAlert.analyst_name}
                  </strong>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="secondary-action"
                disabled={updating}
                onClick={() =>
                  handleStatusUpdate(
                    selectedAlert.alert_id,
                    "FALSE_POSITIVE"
                  )
                }
              >
                Mark False Positive
              </button>

              <button
                className="primary-action"
                disabled={updating}
                onClick={() =>
                  handleStatusUpdate(
                    selectedAlert.alert_id,
                    "CONFIRMED_FRAUD"
                  )
                }
              >
                <CheckCircle2 size={17} />
                Confirm Fraud
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminAlerts;