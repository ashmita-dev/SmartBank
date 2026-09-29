import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CircleDollarSign,
  Database,
  RefreshCw,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import { getTransactions } from "../api";

function formatCurrency(value, currency = "INR") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
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

function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTransaction, setSelectedTransaction] =
    useState(null);

  async function loadTransactions(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const data = await getTransactions();

      setTransactions(
        Array.isArray(data)
          ? data
          : data?.items || []
      );
    } catch (err) {
      setError(
        err?.message || "Unable to load transactions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const status = String(
        transaction.status || ""
      ).toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" ||
        status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const values = [
        transaction.transaction_id,
        transaction.merchant_name,
        transaction.merchant,
        transaction.location,
        transaction.status,
        transaction.transaction_type,
        transaction.currency,
        transaction.device_identifier,
        transaction.category,
        transaction.merchant_category,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [transactions, search, statusFilter]);

  const flaggedCount = transactions.filter(
    (transaction) =>
      String(transaction.status || "").toUpperCase() ===
      "FLAGGED"
  ).length;

  const completedCount = transactions.filter(
    (transaction) =>
      String(transaction.status || "").toUpperCase() ===
      "COMPLETED"
  ).length;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading transaction intelligence...</span>
      </div>
    );
  }

  return (
    <>
      <section className="page-header">
        <div className="section-label">
          TRANSACTION MONITORING
        </div>

        <h1>Transaction Intelligence</h1>

        <p>
          Search and inspect transaction activity directly
          from the live SmartBank database.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>

          <button onClick={() => loadTransactions(true)}>
            Retry
          </button>
        </div>
      )}

      <section className="alert-summary-grid">
        <div className="summary-card">
          <div className="summary-icon">
            <Activity size={20} />
          </div>

          <div>
            <span>Total Transactions</span>
            <strong>{transactions.length}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <CircleDollarSign size={20} />
          </div>

          <div>
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <AlertTriangle size={20} />
          </div>

          <div>
            <span>Flagged</span>
            <strong>{flaggedCount}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <div className="search-box">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search merchant, location, status, transaction ID..."
          />

          {search && (
            <button onClick={() => setSearch("")}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-group">
          {[
            "ALL",
            "COMPLETED",
            "FLAGGED",
            "PENDING",
            "REJECTED",
          ].map((status) => (
            <button
              key={status}
              className={
                statusFilter === status
                  ? "filter active"
                  : "filter"
              }
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <span className="result-count">
            {filteredTransactions.length} transactions
          </span>

          <button
            className="refresh-button"
            onClick={() => loadTransactions(true)}
            disabled={refreshing}
            title="Refresh transactions"
          >
            <RefreshCw
              size={18}
              className={refreshing ? "spin" : ""}
            />
          </button>
        </div>
      </section>

      <section className="panel full-panel">
        {filteredTransactions.length ? (
          <div className="transaction-table">
            <div className="transaction-head">
              <span>Transaction</span>
              <span>Merchant</span>
              <span>Amount</span>
              <span>Location</span>
              <span>Status</span>
            </div>

            {filteredTransactions.map((transaction) => {
              const status = String(
                transaction.status || "COMPLETED"
              ).toLowerCase();

              return (
                <button
                  className="transaction-row"
                  key={transaction.transaction_id}
                  onClick={() =>
                    setSelectedTransaction(transaction)
                  }
                >
                  <div className="transaction-id">
                    <div className="transaction-icon">
                      <CircleDollarSign size={16} />
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
                      {transaction.merchant_category ||
                        transaction.category ||
                        "General"}
                    </span>
                  </div>

                  <strong className="amount-cell">
                    {formatCurrency(
                      transaction.amount,
                      transaction.currency || "INR"
                    )}
                  </strong>

                  <div className="location-cell">
                    <span>
                      {transaction.location || "Unknown"}
                    </span>

                    {transaction.device_identifier && (
                      <small>
                        <Smartphone size={11} />
                        {transaction.device_identifier}
                      </small>
                    )}
                  </div>

                  <span
                    className={`status-badge ${status}`}
                  >
                    {transaction.status || "COMPLETED"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Database size={20} />
            <span>
              No transactions match your current filters.
            </span>
          </div>
        )}
      </section>

      {selectedTransaction && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="alert-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <div className="section-label">
                  TRANSACTION DETAILS
                </div>

                <h2>
                  Transaction #
                  {selectedTransaction.transaction_id}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSelectedTransaction(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-details">
              <div>
                <span>Amount</span>

                <strong>
                  {formatCurrency(
                    selectedTransaction.amount,
                    selectedTransaction.currency ||
                      "INR"
                  )}
                </strong>
              </div>

              <div>
                <span>Status</span>

                <strong>
                  {selectedTransaction.status ||
                    "COMPLETED"}
                </strong>
              </div>

              <div>
                <span>Transaction Type</span>

                <strong>
                  {selectedTransaction.transaction_type ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Merchant</span>

                <strong>
                  {selectedTransaction.merchant_name ||
                    selectedTransaction.merchant ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Location</span>

                <strong>
                  {selectedTransaction.location || "—"}
                </strong>
              </div>

              <div>
                <span>Device</span>

                <strong>
                  {selectedTransaction.device_identifier ||
                    "—"}
                </strong>
              </div>

              <div className="full-detail">
                <span>Transaction Time</span>

                <strong>
                  {formatDate(
                    selectedTransaction.transaction_time
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminTransactions;