import { DEMO_MODE } from "../api";
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
  const profile = data?.profile;
  const homeCity = profile?.home_city || accounts.find((a) => a.home_city)?.home_city;

  return (
    <>
      <PageHeader
        eyebrow="MY PROFILE"
        title="Profile"
        description="Your customer record in SmartBank and how this demonstration handles sign-in."
      />

      <ErrorBanner error={error} onRetry={refresh} />
      {profile?.source === "transactions" && (
        <ErrorBanner
          error={{
            message: `Showing the name recorded on your transactions; the full profile is unavailable. ${profile.error?.message || ""}`,
          }}
          onRetry={refresh}
        />
      )}

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
            <div><span>Name</span><strong>{profile?.customer_name || "Unavailable"}</strong></div>
            <div><span>Customer ID</span><strong>{user.customerId}</strong></div>
            {profile?.customer_type && (
              <div><span>Customer type</span><strong>{profile.customer_type}</strong></div>
            )}
            {profile?.email && (
              <div><span>Email on file</span><strong>{profile.email}</strong></div>
            )}
            <div><span>Demo sign-in</span><strong>{user.email}</strong></div>
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
            <li>
              {DEMO_MODE
                ? "In this demo build, new transactions are scored by a JavaScript copy of the fraud rules in your browser, not by Oracle."
                : "Each new transaction is scored by the database fraud engine as soon as it is recorded."}
            </li>
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

          {DEMO_MODE ? (
            <p className="muted">
              Demo mode: this sign-in is simulated in your browser (no password is checked and no server is
              involved). In the real Oracle deployment the password is verified by the database.
            </p>
          ) : (
          <p className="muted">
            You are signed in with the demonstration login linked to customer #{user.customerId}. The
            password was checked by the Oracle database, which issued this session and only returns
            this customer&apos;s accounts, transactions and alerts. The demo login is shared, so profile
            and password changes are not offered.
          </p>
          )}
        </div>
      </section>
    </>
  );
}

export default UserSettings;
