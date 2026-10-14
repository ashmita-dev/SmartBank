import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CircleDollarSign, Search, ShieldAlert, Smartphone, X } from "lucide-react";
import { getAlerts, getTransactions } from "../api";
import TransactionDialog from "../components/TransactionDialog";
import {
  EmptyState,
  ErrorBanner,
  FraudReview,
  LoadingState,
  PageHeader,
  RefreshButton,
  StatusBadge,
  SummaryCard,
} from "../components/ui";
import useApiData from "../hooks/useApiData";
import { attachAlerts, isUnderReview } from "../utils/fraud";
import { formatCurrency, formatDate, matchesSearch, transactionStatus } from "../utils/format";

const STATUSES = ["ALL", "COMPLETED", "FLAGGED", "PENDING", "REJECTED", "UNDER REVIEW"];
const TYPES = ["ALL", "DEBIT", "CREDIT", "TRANSFER", "WITHDRAWAL", "DEPOSIT"];

function AdminTransactions() {
  const { data, loading, refreshing, error, refresh } = useApiData(async () => {
    const [transactions, alerts] = await Promise.all([
      getTransactions(),
      getAlerts().catch((err) => ({ error: err })),
    ]);
    const alertsError = alerts.error || null;
    return { transactions: attachAlerts(transactions, alertsError ? null : alerts), alertsError };
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selected, setSelected] = useState(null);

  const transactions = useMemo(() => data?.transactions || [], [data]);

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (statusFilter === "UNDER REVIEW") {
          if (!isUnderReview(t.alert)) return false;
        } else if (statusFilter !== "ALL" && transactionStatus(t) !== statusFilter) return false;
        if (typeFilter !== "ALL" && String(t.transaction_type).toUpperCase() !== typeFilter) return false;

        return matchesSearch(
          [
            t.transaction_id,
            t.customer_name,
            t.account_number,
            t.merchant_name,
            t.merchant_category,
            t.location,
            t.device_identifier,
            t.device_type,
          ],
          search
        );
      }),
    [transactions, search, statusFilter, typeFilter]
  );

  const flaggedCount = transactions.filter((t) => transactionStatus(t) === "FLAGGED").length;
  const reviewCount = transactions.filter((t) => isUnderReview(t.alert)).length;
  const totalValue = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  if (loading) {
    return <LoadingState text="Loading transactions…" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="TRANSACTION MONITORING"
        title="Transaction Intelligence"
        description="Every row in BANK_TRANSACTION, newest first. DETECT_FRAUD raises an alert for MEDIUM (40–69) and HIGH (70–100) risk; only HIGH also changes the payment status to FLAGGED."
        actions={<RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh transactions" />}
      />

      <ErrorBanner error={error} onRetry={refresh} />
      {data?.alertsError && (
        <ErrorBanner error={{ message: `Fraud review column unavailable: ${data.alertsError.message}` }} onRetry={refresh} />
      )}

      <section className="alert-summary-grid four">
        <SummaryCard icon={<Activity size={20} />} label="Total transactions" value={data ? transactions.length : "—"} />
        <SummaryCard icon={<CircleDollarSign size={20} />} label="Total value" value={data ? formatCurrency(totalValue) : "—"} />
        <SummaryCard icon={<ShieldAlert size={20} />} label="Under fraud review" value={data && !data.alertsError ? reviewCount : "—"} tone="warning" />
        <SummaryCard icon={<AlertTriangle size={20} />} label="Flagged (high risk)" value={data ? flaggedCount : "—"} tone="danger" />
      </section>

      <section className="toolbar toolbar-stack">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search transactions</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, account, merchant, device, location or ID…"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="toolbar-filters">
          <div className="filter-group" role="group" aria-label="Filter by status">
            {STATUSES.map((status) => (
              <button
                type="button"
                key={status}
                className={statusFilter === status ? "filter active" : "filter"}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>

          <label className="select-control">
            <span>Type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All types" : type}
                </option>
              ))}
            </select>
          </label>

          <span className="result-count" aria-live="polite">
            {filtered.length} of {transactions.length}
          </span>
        </div>
      </section>

      <section className="panel full-panel">
        {filtered.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Merchant</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Location / device</th>
                  <th scope="col">Time</th>
                  <th scope="col">Payment status</th>
                  <th scope="col">Fraud review</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.transaction_id}
                    tabIndex={0}
                    onClick={() => setSelected(t)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(t);
                      }
                    }}
                  >
                    <td>
                      <strong>#{t.transaction_id}</strong>
                      <small>{t.transaction_type}</small>
                    </td>
                    <td>
                      <strong>{t.customer_name}</strong>
                      <small>{t.account_number}</small>
                    </td>
                    <td>
                      <strong>{t.merchant_name || "—"}</strong>
                      <small>{t.merchant_category || ""}</small>
                    </td>
                    <td className="num">
                      <strong>{formatCurrency(t.amount)}</strong>
                    </td>
                    <td>
                      <strong>{t.location || "—"}</strong>
                      {t.device_identifier && (
                        <small>
                          <Smartphone size={11} /> {t.device_identifier}
                        </small>
                      )}
                    </td>
                    <td>
                      <small>{formatDate(t.transaction_time)}</small>
                    </td>
                    <td>
                      <StatusBadge status={transactionStatus(t)} />
                    </td>
                    <td>
                      <FraudReview alert={t.alert} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            text={transactions.length ? "No transactions match your filters." : "No transactions available."}
          />
        )}
      </section>

      {selected && <TransactionDialog transaction={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default AdminTransactions;
