import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAlerts,
  getAnalystWorkload,
  getDailyAnalytics,
  getKPIs,
  getRiskDistribution,
  getTransactions,
  updateAlert,
} from "./api";
import "./App.css";

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

function riskClass(level) {
  return String(level || "LOW").toLowerCase();
}

function App() {
  const [activePage, setActivePage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [kpis, setKpis] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [riskDistribution, setRiskDistribution] = useState([]);
  const [dailyAnalytics, setDailyAnalytics] = useState([]);
  const [analystWorkload, setAnalystWorkload] = useState([]);

  const [transactionSearch, setTransactionSearch] = useState("");
  const [alertRiskFilter, setAlertRiskFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [updatingAlert, setUpdatingAlert] = useState(false);

  async function loadDashboard(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        kpiData,
        transactionData,
        alertData,
        riskData,
        dailyData,
        workloadData,
      ] = await Promise.all([
        getKPIs(),
        getTransactions(),
        getAlerts(),
        getRiskDistribution(),
        getDailyAnalytics(),
        getAnalystWorkload(),
      ]);

      setKpis(kpiData || {});
      setTransactions(
        Array.isArray(transactionData)
          ? transactionData
          : transactionData?.items || []
      );
      setAlerts(
        Array.isArray(alertData) ? alertData : alertData?.items || []
      );
      setRiskDistribution(
        Array.isArray(riskData) ? riskData : riskData?.items || []
      );
      setDailyAnalytics(
        Array.isArray(dailyData) ? dailyData : dailyData?.items || []
      );
      setAnalystWorkload(
        Array.isArray(workloadData)
          ? workloadData
          : workloadData?.items || []
      );
    } catch (err) {
      setError(err?.message || "Unable to load SmartBank data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();

    if (!query) {
      return transactions;
    }

    return transactions.filter((transaction) => {
      const values = [
        transaction.transaction_id,
        transaction.merchant_name,
        transaction.merchant,
        transaction.location,
        transaction.status,
        transaction.transaction_type,
        transaction.currency,
        transaction.device_identifier,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [transactions, transactionSearch]);

  const filteredAlerts = useMemo(() => {
    if (alertRiskFilter === "ALL") {
      return alerts;
    }

    return alerts.filter(
      (alert) =>
        String(alert.risk_level || "").toUpperCase() === alertRiskFilter
    );
  }, [alerts, alertRiskFilter]);

  const highRiskAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) => String(alert.risk_level || "").toUpperCase() === "HIGH"
      ),
    [alerts]
  );

  const openAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(alert.status || "").toUpperCase() === "OPEN" ||
          String(alert.status || "").toUpperCase() === "INVESTIGATING"
      ),
    [alerts]
  );

  const navigation = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: WalletCards,
    },
    {
      id: "alerts",
      label: "Fraud Alerts",
      icon: Shield,
      badge: kpis?.open_alerts ?? openAlerts.length,
    },
  ];

  async function handleAlertUpdate(alertId, status) {
    try {
      setUpdatingAlert(true);

      await updateAlert(alertId, status);

      const updatedAlerts = await getAlerts();

      setAlerts(
        Array.isArray(updatedAlerts)
          ? updatedAlerts
          : updatedAlerts?.items || []
      );

      if (selectedAlert?.alert_id === alertId) {
        setSelectedAlert({
          ...selectedAlert,
          status,
        });
      }
    } catch (err) {
      setError(err?.message || "Unable to update alert.");
    } finally {
      setUpdatingAlert(false);
    }
  }

  function navigateTo(page) {
    setActivePage(page);
    setSidebarOpen(false);
  }

  function renderOverview() {
    const chartData = dailyAnalytics.map((item) => ({
      date:
        item.date ||
        item.transaction_date ||
        item.day ||
        item.label ||
        "",
      transactions:
        Number(
          item.transaction_count ??
            item.transactions ??
            item.count ??
            item.total_transactions ??
            0
        ),
      amount: Number(item.total_amount ?? item.amount ?? 0),
    }));

    const riskData = riskDistribution.map((item) => ({
      name:
        item.risk_level ||
        item.riskLevel ||
        item.level ||
        item.name ||
        "UNKNOWN",
      value: Number(item.count ?? item.alert_count ?? item.value ?? 0),
    }));

    const riskColors = {
      HIGH: "#ff5c6c",
      MEDIUM: "#ffb84d",
      LOW: "#27d7a1",
    };

    return (
      <>
        <section className="hero-section">
          <div>
            <div className="eyebrow">
              <Activity size={15} />
              REAL-TIME FRAUD MONITORING
            </div>

            <h1>
              Banking security, <span>intelligently monitored.</span>
            </h1>

            <p>
              Monitor transactions, investigate suspicious activity, and
              identify high-risk behavior from one centralized intelligence
              dashboard.
            </p>
          </div>

          <div className="protection-card">
            <div className="protection-icon">
              <ShieldCheck size={23} />
            </div>
            <div>
              <strong>Protection Active</strong>
              <span>Fraud detection engine operational</span>
            </div>
          </div>
        </section>

        <section className="section-heading">
          <div>
            <div className="section-label">SYSTEM OVERVIEW</div>
            <h2>Security at a glance</h2>
          </div>

          <div className="live-database">
            <span className="live-dot" />
            Live database data
          </div>
        </section>

        <section className="kpi-grid">
          <KpiCard
            icon={<Users size={21} />}
            value={kpis?.total_customers ?? 0}
            label="Total Customers"
            footer="Customer base"
            tone="blue"
          />

          <KpiCard
            icon={<WalletCards size={21} />}
            value={kpis?.total_accounts ?? 0}
            label="Active Accounts"
            footer="Banking accounts"
            tone="purple"
          />

          <KpiCard
            icon={<Activity size={21} />}
            value={kpis?.total_transactions ?? 0}
            label="Transactions"
            footer="Processed records"
            tone="cyan"
          />

          <KpiCard
            icon={<Shield size={21} />}
            value={kpis?.flagged_transactions ?? 0}
            label="Flagged Transactions"
            footer="Requires attention"
            tone="amber"
          />

          <KpiCard
            icon={<Bell size={21} />}
            value={kpis?.open_alerts ?? 0}
            label="Open Alerts"
            footer="Pending investigation"
            tone="red"
          />

          <KpiCard
            icon={<AlertTriangle size={21} />}
            value={kpis?.high_risk_alerts ?? 0}
            label="High Risk Alerts"
            footer="Critical priority"
            tone="red"
          />
        </section>

        <section className="analytics-grid">
          <div className="panel activity-panel">
            <div className="panel-header">
              <div>
                <div className="section-label">TRANSACTION ACTIVITY</div>
                <h3>Daily transaction volume</h3>
              </div>

              <div className="panel-icon cyan">
                <Activity size={20} />
              </div>
            </div>

            <div className="chart-container">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="transactionGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#27d7ff"
                          stopOpacity={0.32}
                        />
                        <stop
                          offset="100%"
                          stopColor="#27d7ff"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#657189", fontSize: 11 }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#657189", fontSize: 11 }}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "#101827",
                        border: "1px solid #263449",
                        borderRadius: 12,
                        color: "#fff",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="transactions"
                      stroke="#27d7ff"
                      strokeWidth={2}
                      fill="url(#transactionGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No daily analytics available." />
              )}
            </div>
          </div>

          <div className="panel risk-panel">
            <div className="panel-header">
              <div>
                <div className="section-label">RISK INTELLIGENCE</div>
                <h3>Risk distribution</h3>
              </div>

              <div className="panel-icon red">
                <Shield size={20} />
              </div>
            </div>

            <div className="risk-chart">
              {riskData.length ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={64}
                        outerRadius={92}
                        paddingAngle={4}
                      >
                        {riskData.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={riskColors[entry.name] || "#657189"}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        contentStyle={{
                          background: "#101827",
                          border: "1px solid #263449",
                          borderRadius: 12,
                          color: "#fff",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="risk-legend">
                    {riskData.map((item) => (
                      <div className="risk-legend-item" key={item.name}>
                        <span
                          className="risk-dot"
                          style={{
                            background:
                              riskColors[item.name] || "#657189",
                          }}
                        />
                        <span>{item.name}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState text="No risk distribution available." />
              )}
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">TRANSACTION MONITORING</div>
                <h3>Recent transactions</h3>
              </div>

              <button
                className="text-button"
                onClick={() => navigateTo("transactions")}
              >
                View all
                <ChevronRight size={15} />
              </button>
            </div>

            <TransactionTable
              transactions={transactions.slice(0, 7)}
              compact
            />
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">FRAUD INTELLIGENCE</div>
                <h3>Recent alerts</h3>
              </div>

              <button
                className="text-button"
                onClick={() => navigateTo("alerts")}
              >
                View all
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="alert-list">
              {highRiskAlerts.length ? (
                highRiskAlerts.slice(0, 5).map((alert) => (
                  <button
                    className="alert-row"
                    key={alert.alert_id}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="alert-row-icon">
                      <AlertTriangle size={17} />
                    </div>

                    <div className="alert-row-content">
                      <strong>
                        Alert #{alert.alert_id}
                      </strong>
                      <span>
                        {alert.reason || "Suspicious transaction detected"}
                      </span>
                    </div>

                    <div className="alert-row-right">
                      <span className={`risk-badge ${riskClass(alert.risk_level)}`}>
                        {alert.risk_level}
                      </span>
                      <ChevronRight size={15} />
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState text="No high-risk alerts found." />
              )}
            </div>
          </div>
        </section>

        <section className="panel protection-panel">
          <div className="protection-large-icon">
            <ShieldCheck size={25} />
          </div>

          <div className="protection-copy">
            <div className="section-label">SMARTBANK FRAUD ENGINE</div>
            <h3>Continuous transaction protection</h3>
            <p>
              SmartBank evaluates transaction behavior using risk scoring,
              device intelligence, location signals, and transaction patterns
              to identify suspicious activity.
            </p>
          </div>

          <div className="protection-stats">
            <div>
              <span>Detection</span>
              <strong>ACTIVE</strong>
            </div>
            <div>
              <span>Database</span>
              <strong>CONNECTED</strong>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderTransactions() {
    return (
      <>
        <PageHeader
          eyebrow="TRANSACTION MONITORING"
          title="Transaction intelligence"
          description="Search and inspect transaction activity directly from the SmartBank database."
        />

        <section className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={transactionSearch}
              onChange={(event) =>
                setTransactionSearch(event.target.value)
              }
              placeholder="Search merchant, location, status, transaction ID..."
            />

            {transactionSearch && (
              <button onClick={() => setTransactionSearch("")}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="result-count">
            {filteredTransactions.length} transactions
          </div>
        </section>

        <section className="panel full-panel">
          <TransactionTable transactions={filteredTransactions} />
        </section>
      </>
    );
  }

  function renderAlerts() {
    return (
      <>
        <PageHeader
          eyebrow="FRAUD OPERATIONS"
          title="Fraud alert center"
          description="Review suspicious activity, investigate risk signals, and update alert status."
        />

        <section className="alert-summary-grid">
          <SummaryCard
            icon={<Bell size={20} />}
            label="Open alerts"
            value={kpis?.open_alerts ?? openAlerts.length}
          />

          <SummaryCard
            icon={<AlertTriangle size={20} />}
            label="High risk"
            value={kpis?.high_risk_alerts ?? highRiskAlerts.length}
          />

          <SummaryCard
            icon={<Shield size={20} />}
            label="Total alerts"
            value={alerts.length}
          />
        </section>

        <section className="toolbar">
          <div className="filter-group">
            {["ALL", "HIGH", "MEDIUM", "LOW"].map((level) => (
              <button
                key={level}
                className={
                  alertRiskFilter === level ? "filter active" : "filter"
                }
                onClick={() => setAlertRiskFilter(level)}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="result-count">
            {filteredAlerts.length} alerts
          </div>
        </section>

        <section className="panel full-panel">
          <div className="alert-table">
            <div className="alert-table-head">
              <span>Alert</span>
              <span>Risk</span>
              <span>Score</span>
              <span>Reason</span>
              <span>Status</span>
              <span />
            </div>

            {filteredAlerts.length ? (
              filteredAlerts.map((alert) => (
                <button
                  className="alert-table-row"
                  key={alert.alert_id}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <span className="alert-id">
                    #{alert.alert_id}
                  </span>

                  <span>
                    <span
                      className={`risk-badge ${riskClass(
                        alert.risk_level
                      )}`}
                    >
                      {alert.risk_level || "LOW"}
                    </span>
                  </span>

                  <span className="score">
                    {alert.risk_score ?? 0}/100
                  </span>

                  <span className="reason-cell">
                    {alert.reason || "Suspicious activity"}
                  </span>

                  <span>
                    <span
                      className={`status-badge ${String(
                        alert.status || "OPEN"
                      ).toLowerCase()}`}
                    >
                      {alert.status || "OPEN"}
                    </span>
                  </span>

                  <span>
                    <ChevronRight size={17} />
                  </span>
                </button>
              ))
            ) : (
              <EmptyState text="No alerts match this filter." />
            )}
          </div>
        </section>
      </>
    );
  }

  function renderWorkload() {
    return (
      <>
        <PageHeader
          eyebrow="OPERATIONS"
          title="Analyst workload"
          description="Fraud investigation workload based on the live SmartBank alert data."
        />

        <section className="workload-grid">
          {analystWorkload.length ? (
            analystWorkload.map((analyst) => (
              <div className="panel analyst-card" key={analyst.analyst_id}>
                <div className="analyst-avatar">
                  {(analyst.name || "A").charAt(0).toUpperCase()}
                </div>

                <div className="analyst-info">
                  <h3>{analyst.name || "Analyst"}</h3>
                  <span>
                    {analyst.department || "Fraud Operations"}
                  </span>
                </div>

                <div className="analyst-number">
                  <strong>
                    {analyst.open_alerts ??
                      analyst.alert_count ??
                      analyst.total_alerts ??
                      0}
                  </strong>
                  <span>Alerts</span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No analyst workload data available." />
          )}
        </section>
      </>
    );
  }

  function renderPage() {
    if (loading) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <span>Loading SmartBank intelligence...</span>
        </div>
      );
    }

    if (activePage === "transactions") {
      return renderTransactions();
    }

    if (activePage === "alerts") {
      return renderAlerts();
    }

    if (activePage === "workload") {
      return renderWorkload();
    }

    return renderOverview();
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-icon">
            <Shield size={24} />
          </div>

          <div>
            <strong>SmartBank</strong>
            <span>FRAUD INTELLIGENCE</span>
          </div>
        </div>

        <div className="sidebar-section-label">MONITORING</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={
                  activePage === item.id
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() => navigateTo(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section-label system-label">SYSTEM</div>

        <div className="system-status">
          <span className="status-dot" />
          <div>
            <strong>System Online</strong>
            <span>Oracle + ORDS connected</span>
          </div>
        </div>

        <button
          className={
            activePage === "workload"
              ? "nav-item bottom-nav active"
              : "nav-item bottom-nav"
          }
          onClick={() => navigateTo("workload")}
        >
          <Users size={19} />
          <span>Analyst Workload</span>
        </button>

        <div className="database-card">
          <Database size={19} />
          <div>
            <strong>Oracle 21c XE</strong>
            <span>SmartBank Database</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumb">
              <span>SmartBank</span>
              <ChevronRight size={14} />
              <strong>
                {activePage === "overview"
                  ? "Fraud Operations Center"
                  : activePage === "transactions"
                  ? "Transactions"
                  : activePage === "alerts"
                  ? "Fraud Alerts"
                  : "Analyst Workload"}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="live-status">
              <span className="live-dot" />
              LIVE
            </div>

            <button
              className="refresh-button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              title="Refresh dashboard"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "spin" : ""}
              />
            </button>

            <div className="profile">
              <div className="profile-avatar">SB</div>

              <div>
                <strong>Fraud Analyst</strong>
                <span>Operations</span>
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              <span>{error}</span>

              <button onClick={() => loadDashboard(true)}>
                Retry
              </button>
            </div>
          )}

          {renderPage()}
        </div>
      </main>

      {selectedAlert && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="alert-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="section-label">FRAUD ALERT</div>
                <h2>Alert #{selectedAlert.alert_id}</h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedAlert(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-risk">
              <div>
                <span className="modal-label">Risk level</span>
                <span
                  className={`risk-badge ${riskClass(
                    selectedAlert.risk_level
                  )}`}
                >
                  {selectedAlert.risk_level || "LOW"}
                </span>
              </div>

              <div>
                <span className="modal-label">Risk score</span>
                <strong className="large-score">
                  {selectedAlert.risk_score ?? 0}
                  <small>/100</small>
                </strong>
              </div>
            </div>

            <div className="modal-details">
              <div>
                <span>Transaction</span>
                <strong>
                  #{selectedAlert.transaction_id ?? "—"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{selectedAlert.status || "OPEN"}</strong>
              </div>

              <div className="full-detail">
                <span>Reason</span>
                <strong>
                  {selectedAlert.reason ||
                    "Suspicious transaction detected"}
                </strong>
              </div>

              <div className="full-detail">
                <span>Created</span>
                <strong>
                  {formatDate(selectedAlert.created_at)}
                </strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-action"
                disabled={updatingAlert}
                onClick={() =>
                  handleAlertUpdate(
                    selectedAlert.alert_id,
                    "FALSE_POSITIVE"
                  )
                }
              >
                Mark False Positive
              </button>

              <button
                className="primary-action"
                disabled={updatingAlert}
                onClick={() =>
                  handleAlertUpdate(
                    selectedAlert.alert_id,
                    "CONFIRMED_FRAUD"
                  )
                }
              >
                Confirm Fraud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, footer, tone }) {
  return (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-top">
        <div className="kpi-icon">{icon}</div>
        <ArrowUpRight size={17} className="kpi-arrow" />
      </div>

      <strong className="kpi-value">{value}</strong>
      <span className="kpi-label">{label}</span>

      <div className="kpi-footer">{footer}</div>
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="summary-card">
      <div className="summary-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, description }) {
  return (
    <section className="page-header">
      <div className="section-label">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function TransactionTable({ transactions, compact = false }) {
  if (!transactions.length) {
    return <EmptyState text="No transactions available." />;
  }

  return (
    <div className={compact ? "transaction-table compact" : "transaction-table"}>
      <div className="transaction-head">
        <span>Transaction</span>
        <span>Merchant</span>
        <span>Amount</span>
        <span>Location</span>
        <span>Status</span>
      </div>

      {transactions.map((transaction) => {
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
                <CircleDollarSign size={16} />
              </div>

              <div>
                <strong>
                  #{transaction.transaction_id}
                </strong>
                <span>
                  {transaction.transaction_type || "TRANSACTION"}
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
              <span>{transaction.location || "Unknown"}</span>
              {transaction.device_identifier && (
                <small>
                  <Smartphone size={11} />
                  {transaction.device_identifier}
                </small>
              )}
            </div>

            <span className={`status-badge ${status}`}>
              {transaction.status || "COMPLETED"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <Database size={20} />
      <span>{text}</span>
    </div>
  );
}

export default App;