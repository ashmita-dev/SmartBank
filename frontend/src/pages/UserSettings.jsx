import { Lock, ShieldCheck, User } from "lucide-react";
import { ErrorBanner, LoadingState, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import useApiData from "../hooks/useApiData";
import { loadCustomerData } from "../utils/customerData";

function UserSettings() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useApiData(
    () => loadCustomerData(user.customerId),
    [user.customerId]
  );

  if (loading) {
    return <LoadingState text="Loading your profile…" />;
  }

  const accounts = data?.accounts || [];
  const homeCity = accounts.find((a) => a.home_city)?.home_city;

  return (
    <>
      <PageHeader
        eyebrow="MY PROFILE"
        title="Profile"
        description="Your customer record in SmartBank and how this demonstration handles sign-in."
      />

      <ErrorBanner error={error} onRetry={refresh} />

      <section className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">CUSTOMER RECORD</div>
              <h3>Personal information</h3>
            </div>
            <div className="panel-icon purple">
              <User size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div><span>Name</span><strong>{accounts[0]?.customer_name || user.name}</strong></div>
            <div><span>Customer ID</span><strong>{user.customerId}</strong></div>
            <div><span>Sign-in email</span><strong>{user.email}</strong></div>
            <div><span>Home city</span><strong>{homeCity || "—"}</strong></div>
            <div><span>Accounts</span><strong>{accounts.map((a) => a.account_number).join(", ") || "—"}</strong></div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">FRAUD PROTECTION</div>
              <h3>How your account is monitored</h3>
            </div>
            <div className="panel-icon cyan">
              <ShieldCheck size={20} />
            </div>
          </div>

          <ul className="limits-list">
            <li>Each new transaction is scored by the database fraud engine as soon as it is recorded.</li>
            <li>
              Transactions from {homeCity ? `outside ${homeCity}` : "outside your home city"}, from new devices,
              large amounts, or bursts of activity raise your risk score.
            </li>
            <li>High-risk transactions are marked FLAGGED and reviewed by a fraud analyst.</li>
          </ul>
        </div>

        <div className="panel settings-panel span-2">
          <div className="panel-header">
            <div>
              <div className="section-label">SIGN-IN</div>
              <h3>Demonstration authentication</h3>
            </div>
            <div className="panel-icon red">
              <Lock size={20} />
            </div>
          </div>

          <p className="muted">
            This project uses a demo sign-in checked in the browser and linked to customer #{user.customerId}.
            It is not production-grade authentication, so profile and password changes are not offered.
          </p>
        </div>
      </section>
    </>
  );
}

export default UserSettings;
