import { DEMO_MODE } from "../api";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  ShieldAlert,
  Wallet,
} from "lucide-react";
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
import { useAuth } from "../context/AuthContext";
import useApiData from "../hooks/useApiData";
import { loadCustomerData } from "../utils/customerData";
import { isUnderReview } from "../utils/fraud";
import { formatCurrency, formatDate, transactionStatus } from "../utils/format";

const INCOMING_TYPES = ["CREDIT", "DEPOSIT"];

function UserDashboard() {
  const { user } = useAuth();
  const { data, loading, refreshing, error, refresh } = useApiData(
    () => loadCustomerData(user.customerId),
    [user.customerId]
  );

  if (loading) {
    return <LoadingState text="Loading your SmartBank dashboard…" />;
  }

  const accounts = data?.accounts || [];
  const transactions = data?.transactions || [];
  const balancesKnown = accounts.length > 0 && accounts.every((a) => a.balance != null);
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  // Payment status FLAGGED = scored HIGH. Fraud review = any OPEN/INVESTIGATING
  // alert (MEDIUM or HIGH) on this customer's own transactions.
  const flagged = transactions.filter((t) => transactionStatus(t) === "FLAGGED");
  const alertsKnown = Boolean(data) && !data.alertsError;
  const underReview = transactions.filter((t) => isUnderReview(t.alert));
  const firstName = data?.profile?.first_name || data?.profile?.customer_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="PERSONAL BANKING"
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={DEMO_MODE
          ? "Your accounts and recent activity in the demo simulation (synthetic data in this browser, not Oracle)."
          : "Your accounts and recent activity, read live from the SmartBank Oracle database."}
        actions={
          <>
            <RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh dashboard" />
            <Link className="primary-action" to="/user/transfer">
              <ArrowLeftRight size={16} />
              New transfer
            </Link>
          </>
        }
      />

      <ErrorBanner error={error} onRetry={refresh} />

      {data?.alertsError && (
        <ErrorBanner
          error={{ message: `Fraud review status is unavailable: ${data.alertsError.message}` }}
          onRetry={refresh}
        />
      )}

      {alertsKnown && underReview.length > 0 && (
        <Notice tone="warning">
          {underReview.length} of your transactions {underReview.length === 1 ? "has" : "have"} an open
          fraud alert awaiting analyst review
          {flagged.length > 0
            ? `, including ${flagged.length} flagged as high risk.`
            : ". None scored high risk, so their payments stayed COMPLETED."}
        </Notice>
      )}

      <section className="alert-summary-grid four">
        <SummaryCard
          icon={<Wallet size={20} />}
          label="Total balance"
          value={balancesKnown ? formatCurrency(totalBalance) : "—"}
        />
        <SummaryCard icon={<Activity size={20} />} label="Transactions" value={data ? transactions.length : "—"} />
        <SummaryCard
          icon={<ShieldAlert size={20} />}
          label="Under fraud review"
          value={alertsKnown ? underReview.length : "—"}
          tone={underReview.length ? "warning" : ""}
        />
        <SummaryCard
          icon={<AlertTriangle size={20} />}
          label="Flagged (high risk)"
          value={data ? flagged.length : "—"}
          tone={flagged.length ? "danger" : ""}
        />
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">MY ACCOUNTS</div>
              <h3>Accounts</h3>
            </div>
            <Link className="text-button" to="/user/accounts">
              Details <ChevronRight size={15} />
            </Link>
          </div>

          {accounts.length ? (
            <div className="mini-list">
              {accounts.map((account) => (
                <div className="mini-row" key={account.account_id}>
                  <div className="transaction-icon">
                    <Wallet size={16} />
                  </div>
                  <div className="mini-main">
                    <strong>{account.account_type ? `${account.account_type} account` : "Account"}</strong>
                    <span>{account.account_number}</span>
                  </div>
                  <div className="mini-side">
                    <strong>{account.balance != null ? formatCurrency(account.balance) : "—"}</strong>
                    {account.status && <StatusBadge status={account.status} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No accounts found for this customer." />
          )}

          {data?.accountsError && (
            <p className="muted small-note">
              Balances unavailable: {data.accountsError.message}
            </p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">RECENT ACTIVITY</div>
              <h3>Latest transactions</h3>
            </div>
            <Link className="text-button" to="/user/transactions">
              View all <ChevronRight size={15} />
            </Link>
          </div>

          {transactions.length ? (
            <div className="mini-list">
              {transactions.slice(0, 6).map((t) => {
                const incoming = INCOMING_TYPES.includes(String(t.transaction_type).toUpperCase());

                return (
                  <div className="mini-row" key={t.transaction_id}>
                    <div className={`transaction-icon ${incoming ? "in" : "out"}`}>
                      {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="mini-main">
                      <strong>{t.merchant_name || t.transaction_type}</strong>
                      <span>
                        {t.transaction_type} · {t.location || "Unknown"} · {formatDate(t.transaction_time, { withTime: false })}
                      </span>
                    </div>
                    <div className="mini-side">
                      <strong>{formatCurrency(t.amount)}</strong>
                      <span className="review-cell">
                        <StatusBadge status={transactionStatus(t)} />
                        {t.alert && <RiskBadge level={t.alert.risk_level} />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No transactions yet." />
          )}
        </div>
      </section>
    </>
  );
}

export default UserDashboard;
