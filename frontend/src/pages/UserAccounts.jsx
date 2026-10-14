import { useState } from "react";
import { CreditCard, Eye, EyeOff, Landmark, Wallet } from "lucide-react";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
  RefreshButton,
  StatusBadge,
  SummaryCard,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import useApiData from "../hooks/useApiData";
import { loadCustomerData } from "../utils/customerData";
import { formatCurrency, formatDate } from "../utils/format";

function UserAccounts() {
  const { user } = useAuth();
  const { data, loading, refreshing, error, refresh } = useApiData(
    () => loadCustomerData(user.customerId),
    [user.customerId]
  );
  const [showBalances, setShowBalances] = useState(true);

  if (loading) {
    return <LoadingState text="Loading your accounts…" />;
  }

  const accounts = data?.accounts || [];
  const transactions = data?.transactions || [];
  const balancesKnown = accounts.length > 0 && accounts.every((a) => a.balance != null);
  const total = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const hide = (value) => (showBalances ? value : "••••••");

  return (
    <>
      <PageHeader
        eyebrow="MY BANKING"
        title="My Accounts"
        description="ACCOUNT rows for your customer record, with savings and current account details from their subtype tables."
        actions={
          <>
            <button
              type="button"
              className="refresh-button"
              onClick={() => setShowBalances((v) => !v)}
              aria-pressed={!showBalances}
              aria-label={showBalances ? "Hide balances" : "Show balances"}
              title={showBalances ? "Hide balances" : "Show balances"}
            >
              {showBalances ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh accounts" />
          </>
        }
      />

      <ErrorBanner error={error} onRetry={refresh} />
      {data?.accountsError && (
        <ErrorBanner
          error={{
            message: `Account balances and types are unavailable: ${data.accountsError.message} Showing account numbers found in your transactions instead.`,
          }}
        />
      )}

      <section className="alert-summary-grid">
        <SummaryCard icon={<Wallet size={20} />} label="Total balance" value={balancesKnown ? hide(formatCurrency(total)) : "—"} />
        <SummaryCard icon={<CreditCard size={20} />} label="Accounts" value={accounts.length} />
        <SummaryCard icon={<Landmark size={20} />} label="Transactions on record" value={transactions.length} />
      </section>

      {accounts.length ? (
        <section className="account-grid">
          {accounts.map((account) => {
            const count = transactions.filter((t) => Number(t.account_id) === Number(account.account_id)).length;

            return (
              <article className="panel account-card" key={account.account_id}>
                <div className="account-card-top">
                  <div>
                    <span className="section-label">
                      {account.account_type ? `${account.account_type} ACCOUNT` : "ACCOUNT"}
                    </span>
                    <h3>{account.account_number}</h3>
                  </div>
                  {account.status && <StatusBadge status={account.status} />}
                </div>

                <div className="account-balance">
                  <span>Balance</span>
                  <strong>{account.balance != null ? hide(formatCurrency(account.balance)) : "—"}</strong>
                </div>

                <dl className="account-meta-list">
                  {account.interest_rate != null && (
                    <div><dt>Interest rate</dt><dd>{account.interest_rate}%</dd></div>
                  )}
                  {account.minimum_balance != null && (
                    <div><dt>Minimum balance</dt><dd>{formatCurrency(account.minimum_balance)}</dd></div>
                  )}
                  {account.overdraft_limit != null && (
                    <div><dt>Overdraft limit</dt><dd>{formatCurrency(account.overdraft_limit)}</dd></div>
                  )}
                  {account.opened_date && (
                    <div><dt>Opened</dt><dd>{formatDate(account.opened_date, { withTime: false })}</dd></div>
                  )}
                  <div><dt>Transactions</dt><dd>{count}</dd></div>
                </dl>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel full-panel">
          <EmptyState text="No accounts found for this customer." />
        </section>
      )}
    </>
  );
}

export default UserAccounts;
