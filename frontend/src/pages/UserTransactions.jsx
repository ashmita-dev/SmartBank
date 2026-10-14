import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, X } from "lucide-react";
import TransactionDialog from "../components/TransactionDialog";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
  RefreshButton,
  StatusBadge,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import useApiData from "../hooks/useApiData";
import { loadCustomerData } from "../utils/customerData";
import { formatCurrency, formatDate, matchesSearch, transactionStatus } from "../utils/format";

const STATUSES = ["ALL", "COMPLETED", "FLAGGED", "PENDING", "REJECTED"];
const INCOMING_TYPES = ["CREDIT", "DEPOSIT"];

function UserTransactions() {
  const { user } = useAuth();
  const { data, loading, refreshing, error, refresh } = useApiData(
    () => loadCustomerData(user.customerId),
    [user.customerId]
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [selected, setSelected] = useState(null);

  const transactions = useMemo(() => data?.transactions || [], [data]);
  const accounts = data?.accounts || [];

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (statusFilter !== "ALL" && transactionStatus(t) !== statusFilter) return false;
        if (accountFilter !== "ALL" && String(t.account_id) !== accountFilter) return false;

        return matchesSearch(
          [t.transaction_id, t.merchant_name, t.merchant_category, t.location, t.transaction_type, t.device_identifier],
          search
        );
      }),
    [transactions, search, statusFilter, accountFilter]
  );

  if (loading) {
    return <LoadingState text="Loading your transactions…" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="PERSONAL BANKING"
        title="My Transactions"
        description="Every transaction on your accounts. FLAGGED transactions were scored HIGH risk and sent for analyst review."
        actions={<RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh transactions" />}
      />

      <ErrorBanner error={error} onRetry={refresh} />

      <section className="toolbar toolbar-stack">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search transactions</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search merchant, location, type, device or ID…"
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

          {accounts.length > 1 && (
            <label className="select-control">
              <span>Account</span>
              <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                <option value="ALL">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.account_id} value={String(a.account_id)}>
                    {a.account_number}
                    {a.account_type ? ` · ${a.account_type}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

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
                  <th scope="col">Merchant</th>
                  <th scope="col">Account</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Location</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const incoming = INCOMING_TYPES.includes(String(t.transaction_type).toUpperCase());

                  return (
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
                        <span className="cell-with-icon">
                          <span className={`transaction-icon ${incoming ? "in" : "out"}`}>
                            {incoming ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </span>
                          <span>
                            <strong>#{t.transaction_id}</strong>
                            <small>{t.transaction_type}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <strong>{t.merchant_name || "—"}</strong>
                        <small>{t.merchant_category || ""}</small>
                      </td>
                      <td><small>{t.account_number}</small></td>
                      <td className="num"><strong>{formatCurrency(t.amount)}</strong></td>
                      <td>{t.location || "—"}</td>
                      <td><small>{formatDate(t.transaction_time)}</small></td>
                      <td><StatusBadge status={transactionStatus(t)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text={transactions.length ? "No transactions match your filters." : "No transactions yet."} />
        )}
      </section>

      {selected && <TransactionDialog transaction={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default UserTransactions;
