import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CreditCard,
  Eye,
  EyeOff,
  Wallet,
} from "lucide-react";

function UserAccounts() {
  const [showBalances, setShowBalances] = useState(true);

  const accounts = [
    {
      id: "SB-10001",
      type: "Savings Account",
      number: "**** **** 4821",
      balance: 125000,
      status: "ACTIVE",
      interest: "6.50%",
    },
    {
      id: "CA-10002",
      type: "Current Account",
      number: "**** **** 7394",
      balance: 84250,
      status: "ACTIVE",
      interest: "0.00%",
    },
  ];

  const totalBalance = accounts.reduce(
    (total, account) => total + account.balance,
    0
  );

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  }

  useEffect(() => {
    document.title = "SmartBank | Accounts";
  }, []);

  return (
    <>
      <section className="page-header">
        <div className="section-label">MY BANKING</div>

        <h1>My Accounts</h1>

        <p>
          View your SmartBank accounts, balances, and account
          information in one place.
        </p>
      </section>

      <section className="alert-summary-grid">
        <div className="summary-card">
          <div className="summary-icon">
            <Wallet size={20} />
          </div>

          <div>
            <span>Total Balance</span>

            <strong>
              {showBalances
                ? formatCurrency(totalBalance)
                : "••••••••"}
            </strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <CreditCard size={20} />
          </div>

          <div>
            <span>Active Accounts</span>
            <strong>{accounts.length}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <ArrowUpRight size={20} />
          </div>

          <div>
            <span>Account Status</span>
            <strong>ACTIVE</strong>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <div>
          <div className="section-label">
            ACCOUNT PORTFOLIO
          </div>
        </div>

        <button
          className="refresh-button"
          onClick={() =>
            setShowBalances((current) => !current)
          }
          title={
            showBalances
              ? "Hide balances"
              : "Show balances"
          }
        >
          {showBalances ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </section>

      <section className="workload-grid">
        {accounts.map((account) => (
          <div
            className="panel analyst-card"
            key={account.id}
          >
            <div className="analyst-avatar">
              <Wallet size={20} />
            </div>

            <div className="analyst-info">
              <h3>{account.type}</h3>

              <span>{account.number}</span>

              <small>
                Account ID: {account.id}
              </small>
            </div>

            <div className="analyst-number">
              <strong>
                {showBalances
                  ? formatCurrency(account.balance)
                  : "••••••"}
              </strong>

              <span>{account.status}</span>
            </div>

            <div className="account-meta">
              <span>Interest Rate</span>
              <strong>{account.interest}</strong>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

export default UserAccounts;