import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { getAnalystWorkload } from "../api";

function AdminAnalysts() {
  const [analysts, setAnalysts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalysts(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const data = await getAnalystWorkload();

      setAnalysts(
        Array.isArray(data)
          ? data
          : data?.items || []
      );
    } catch (err) {
      setError(
        err?.message || "Unable to load analyst workload."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAnalysts();
  }, []);

  const totalAlerts = analysts.reduce(
    (total, analyst) =>
      total +
      Number(
        analyst.open_alerts ??
          analyst.alert_count ??
          analyst.total_alerts ??
          0
      ),
    0
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading analyst workload...</span>
      </div>
    );
  }

  return (
    <>
      <section className="page-header">
        <div className="section-label">
          FRAUD OPERATIONS
        </div>

        <h1>Analyst Workload</h1>

        <p>
          Monitor fraud investigation workload and analyst
          activity using live SmartBank alert data.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>

          <button onClick={() => loadAnalysts(true)}>
            Retry
          </button>
        </div>
      )}

      <section className="alert-summary-grid">
        <div className="summary-card">
          <div className="summary-icon">
            <Users size={20} />
          </div>

          <div>
            <span>Total Analysts</span>
            <strong>{analysts.length}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Shield size={20} />
          </div>

          <div>
            <span>Assigned Alerts</span>
            <strong>{totalAlerts}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Activity size={20} />
          </div>

          <div>
            <span>System Status</span>
            <strong>ACTIVE</strong>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <div>
          <div className="section-label">
            ANALYST MONITORING
          </div>
        </div>

        <button
          className="refresh-button"
          onClick={() => loadAnalysts(true)}
          disabled={refreshing}
          title="Refresh analyst workload"
        >
          <RefreshCw
            size={18}
            className={refreshing ? "spin" : ""}
          />
        </button>
      </section>

      <section className="workload-grid">
        {analysts.length ? (
          analysts.map((analyst) => {
            const alertCount = Number(
              analyst.open_alerts ??
                analyst.alert_count ??
                analyst.total_alerts ??
                0
            );

            const name = analyst.name || "Analyst";

            return (
              <div
                className="panel analyst-card"
                key={analyst.analyst_id}
              >
                <div className="analyst-avatar">
                  {name.charAt(0).toUpperCase()}
                </div>

                <div className="analyst-info">
                  <h3>{name}</h3>

                  <span>
                    {analyst.department ||
                      "Fraud Operations"}
                  </span>

                  {analyst.email && (
                    <small>{analyst.email}</small>
                  )}
                </div>

                <div className="analyst-number">
                  <strong>{alertCount}</strong>
                  <span>Open Alerts</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="panel full-panel">
            <div className="empty-state">
              <Database size={20} />
              <span>
                No analyst workload data available.
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default AdminAnalysts;