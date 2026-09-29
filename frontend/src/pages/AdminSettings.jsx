import { useState } from "react";
import {
  Bell,
  Database,
  Lock,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
} from "lucide-react";

function AdminSettings() {
  const [highRiskThreshold, setHighRiskThreshold] = useState(70);
  const [mediumRiskThreshold, setMediumRiskThreshold] = useState(40);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  return (
    <>
      <section className="page-header">
        <div className="section-label">
          SYSTEM CONFIGURATION
        </div>

        <h1>Admin Settings</h1>

        <p>
          Configure SmartBank fraud monitoring preferences,
          alert thresholds, and dashboard behavior.
        </p>
      </section>

      <section className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                FRAUD ENGINE
              </div>

              <h3>Risk Configuration</h3>
            </div>

            <div className="panel-icon red">
              <Shield size={20} />
            </div>
          </div>

          <div className="settings-content">
            <div className="setting-row">
              <div className="setting-info">
                <strong>High Risk Threshold</strong>
                <span>
                  Transactions at or above this score are
                  classified as HIGH risk.
                </span>
              </div>

              <div className="setting-control">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={highRiskThreshold}
                  onChange={(event) =>
                    setHighRiskThreshold(
                      Number(event.target.value)
                    )
                  }
                />

                <span>/ 100</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong>Medium Risk Threshold</strong>
                <span>
                  Transactions at or above this score enter
                  the MEDIUM risk range.
                </span>
              </div>

              <div className="setting-control">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={mediumRiskThreshold}
                  onChange={(event) =>
                    setMediumRiskThreshold(
                      Number(event.target.value)
                    )
                  }
                />

                <span>/ 100</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                ALERT MANAGEMENT
              </div>

              <h3>Notification Settings</h3>
            </div>

            <div className="panel-icon red">
              <Bell size={20} />
            </div>
          </div>

          <div className="settings-content">
            <div className="setting-row">
              <div className="setting-info">
                <strong>Fraud Alerts</strong>
                <span>
                  Display suspicious transaction alerts in
                  the admin dashboard.
                </span>
              </div>

              <button
                className={
                  alertsEnabled
                    ? "toggle active"
                    : "toggle"
                }
                onClick={() =>
                  setAlertsEnabled(!alertsEnabled)
                }
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong>Automatic Refresh</strong>
                <span>
                  Keep dashboard monitoring data refreshed
                  automatically.
                </span>
              </div>

              <button
                className={
                  autoRefresh
                    ? "toggle active"
                    : "toggle"
                }
                onClick={() =>
                  setAutoRefresh(!autoRefresh)
                }
              >
                <span />
              </button>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                LIVE MONITORING
              </div>

              <h3>Refresh Configuration</h3>
            </div>

            <div className="panel-icon cyan">
              <RefreshCw size={20} />
            </div>
          </div>

          <div className="settings-content">
            <div className="setting-row">
              <div className="setting-info">
                <strong>Refresh Interval</strong>
                <span>
                  Frequency used for automatic dashboard
                  updates.
                </span>
              </div>

              <div className="setting-control">
                <select
                  value={refreshInterval}
                  onChange={(event) =>
                    setRefreshInterval(
                      Number(event.target.value)
                    )
                  }
                  disabled={!autoRefresh}
                >
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                  <option value={120}>2 minutes</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                DATABASE
              </div>

              <h3>System Information</h3>
            </div>

            <div className="panel-icon purple">
              <Database size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div>
              <span>Database</span>
              <strong>Oracle Database 21c XE</strong>
            </div>

            <div>
              <span>API Layer</span>
              <strong>Oracle REST Data Services</strong>
            </div>

            <div>
              <span>Schema</span>
              <strong>SMARTBANK_USER</strong>
            </div>

            <div>
              <span>Fraud Engine</span>
              <strong className="online-text">
                ACTIVE
              </strong>
            </div>

            <div>
              <span>Connection</span>
              <strong className="online-text">
                CONNECTED
              </strong>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                SECURITY
              </div>

              <h3>Access Control</h3>
            </div>

            <div className="panel-icon purple">
              <Lock size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div>
              <span>Current Role</span>
              <strong>Fraud Administrator</strong>
            </div>

            <div>
              <span>Authentication</span>
              <strong>Role-Based Access</strong>
            </div>

            <div>
              <span>Session</span>
              <strong className="online-text">
                ACTIVE
              </strong>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                APPLICATION
              </div>

              <h3>Dashboard Preferences</h3>
            </div>

            <div className="panel-icon cyan">
              <SlidersHorizontal size={20} />
            </div>
          </div>

          <div className="settings-content">
            <div className="setting-row">
              <div className="setting-info">
                <strong>Monitoring Mode</strong>
                <span>
                  SmartBank continuously evaluates transaction
                  activity using the configured fraud engine.
                </span>
              </div>

              <span className="status-badge completed">
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-actions">
        {saved && (
          <div className="save-message">
            Settings saved successfully.
          </div>
        )}

        <button
          className="primary-action"
          onClick={handleSave}
        >
          <Save size={17} />
          Save Settings
        </button>
      </section>
    </>
  );
}

export default AdminSettings;