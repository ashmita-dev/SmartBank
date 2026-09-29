import { useState } from "react";
import {
  Bell,
  Check,
  Lock,
  Save,
  Shield,
  User,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

function UserSettings() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
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
        <div className="section-label">MY PROFILE</div>

        <h1>Account Settings</h1>

        <p>
          Manage your SmartBank profile, notifications, and
          security preferences.
        </p>
      </section>

      <section className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">PROFILE</div>
              <h3>Personal Information</h3>
            </div>

            <div className="panel-icon purple">
              <User size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div>
              <span>Name</span>
              <strong>
                {user?.name || "SmartBank Customer"}
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong>
                {user?.email || "user@smartbank.com"}
              </strong>
            </div>

            <div>
              <span>Account Type</span>
              <strong>SmartBank Customer</strong>
            </div>

            <div>
              <span>Access Level</span>
              <strong>Customer</strong>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                NOTIFICATIONS
              </div>

              <h3>Notification Preferences</h3>
            </div>

            <div className="panel-icon cyan">
              <Bell size={20} />
            </div>
          </div>

          <div className="settings-content">
            <div className="setting-row">
              <div className="setting-info">
                <strong>Transaction Notifications</strong>

                <span>
                  Receive notifications about important account
                  and transaction activity.
                </span>
              </div>

              <button
                className={
                  notifications
                    ? "toggle active"
                    : "toggle"
                }
                onClick={() =>
                  setNotifications(!notifications)
                }
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong>Security Alerts</strong>

                <span>
                  Receive alerts when suspicious activity is
                  detected on your account.
                </span>
              </div>

              <button
                className={
                  securityAlerts
                    ? "toggle active"
                    : "toggle"
                }
                onClick={() =>
                  setSecurityAlerts(!securityAlerts)
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
                SECURITY
              </div>

              <h3>Account Security</h3>
            </div>

            <div className="panel-icon red">
              <Shield size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div>
              <span>Authentication</span>
              <strong>Role-Based Access</strong>
            </div>

            <div>
              <span>Account Status</span>
              <strong className="online-text">
                ACTIVE
              </strong>
            </div>

            <div>
              <span>Security Monitoring</span>
              <strong className="online-text">
                ENABLED
              </strong>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                PASSWORD
              </div>

              <h3>Authentication</h3>
            </div>

            <div className="panel-icon purple">
              <Lock size={20} />
            </div>
          </div>

          <div className="settings-content">
            <div className="setting-row">
              <div className="setting-info">
                <strong>Password</strong>

                <span>
                  Your password is protected and used for
                  SmartBank account authentication.
                </span>
              </div>

              <span className="status-badge completed">
                PROTECTED
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-actions">
        {saved && (
          <div className="save-message">
            <Check size={16} />
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

export default UserSettings;