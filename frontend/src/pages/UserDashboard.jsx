import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getKPIs, getTransactions } from "../api";
import { useAuth } from "../context/AuthContext";

function UserDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [kpis, setKpis] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [kpiData, transactionData] = await Promise.all([
        getKPIs(),
        getTransactions(),
      ]);

      setKpis(kpiData);
      setTransactions(
        Array.isArray(transactionData)
          ? transactionData
          : transactionData?.items || []
      );
    } catch {
      setKpis(null);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const recentTransactions = useMemo(
    () => transactions.slice(0, 5),
    [transactions]
  );

  const totalActivity = transactions.length;

  const flaggedActivity = transactions.filter(
    (transaction) =>
      String(transaction.status || "").toUpperCase() === "FLAGGED"
  ).length;

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading your SmartBank dashboard...</span>
      </div>
    );
  }

  return (
    <>
      <section className="page-header">
        <div className="section-label">
          PERSONAL BANKING
        </div>

        <h1>
          Welcome back
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>

        <p>
          Monitor your account activity and keep track of
          your SmartBank transactions.
        </p>
      </section>

      <section className="alert-summary-grid">
        <div className="summary-card">
          <div className="summary-icon">
            <Wallet size={20} />
          </div>

          <div>
            <span>Available Accounts</span>
            <strong>
              {kpis?.total_accounts ?? "—"}
            </strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Activity size={20} />
          </div>

          <div>
            <span>Transaction Activity</span>
            <strong>{totalActivity}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <ShieldCheck size={20} />
          </div>

          <div>
            <span>Flagged Activity</span>
            <strong>{flaggedActivity}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <div>
          <div className="section-label">
            RECENT ACTIVITY
          </div>

          <div className="user-toolbar-info">
            <strong>{user?.name || "SmartBank Customer"}</strong>
            <span>Personal Banking</span>
          </div>
        </div>

        <div className="toolbar-actions">
          <button
            className="refresh-button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              size={18}
              className={refreshing ? "spin" : ""}
            />
          </button>

          <button
            className="logout-button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </section>

      <section className="panel full-panel">
        <div className="panel-header">
          <div>
            <div className="section-label">
              TRANSACTIONS
            </div>

            <h3>Recent Activity</h3>
          </div>

          <CreditCard size={20} />
        </div>

        {recentTransactions.length ? (
          <div className="transaction-table">
            <div className="transaction-head">
              <span>Transaction</span>
              <span>Merchant</span>
              <span>Amount</span>
              <span>Date</span>
              <span>Status</span>
            </div>

            {recentTransactions.map((transaction) => {
              const status = String(
                transaction.status || "COMPLETED"
              ).toLowerCase();

              return (
                <div
                  className="transaction-row"
                  key={transaction.transaction_id}
                >
                  <div className="transaction-id">
                    <div className="transaction-icon">
                      {String(
                        transaction.transaction_type || ""
                      ).toUpperCase() === "CREDIT" ? (
                        <ArrowDownLeft size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                    </div>

                    <div>
                      <strong>
                        #{transaction.transaction_id}
                      </strong>

                      <span>
                        {transaction.transaction_type ||
                          "TRANSACTION"}
                      </span>
                    </div>
                  </div>

                  <div className="merchant-cell">
                    <strong>
                      {transaction.merchant_name ||
                        transaction.merchant ||
                        "Unknown Merchant"}
                    </strong>

                    <span>
                      {transaction.category ||
                        transaction.merchant_category ||
                        "General"}
                    </span>
                  </div>

                  <strong className="amount-cell">
                    {formatCurrency(transaction.amount)}
                  </strong>

                  <span>
                    {formatDate(transaction.transaction_time)}
                  </span>

                  <span
                    className={`status-badge ${status}`}
                  >
                    {transaction.status || "COMPLETED"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Activity size={20} />
            <span>No transaction activity available.</span>
          </div>
        )}
      </section>
    </>
  );
}

export default UserDashboard;