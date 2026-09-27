import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Database,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  getDailyAnalytics,
  getKPIs,
  getRiskDistribution,
  getTransactions,
} from "./api";
import "./App.css";

const formatCurrency = (value) => {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getValue = (object, keys, fallback = 0) => {
  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return fallback;
};

const normalizeRiskData = (data) => {
  const items = data?.items || data || [];

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    name:
      item.risk_level ||
      item.riskLevel ||
      item.level ||
      item.name ||
      "Unknown",
    value: Number(
      getValue(item, ["count", "total", "value", "transaction_count"], 0)
    ),
  }));
};

const normalizeDailyData = (data) => {
  const items = data?.items || data || [];

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    date:
      item.transaction_date ||
      item.date ||
      item.day ||
      item.label ||
      "",
    transactions: Number(
      getValue(item, ["transaction_count", "transactions", "count"], 0)
    ),
    amount: Number(
      getValue(item, ["total_amount", "amount", "total"], 0)
    ),
  }));
};

const normalizeTransactions = (data) => {
  const items = data?.items || data || [];

  if (!Array.isArray(items)) {
    return [];
  }

  return items;
};

const normalizeAlerts = (data) => {
  const items = data?.items || data || [];

  if (!Array.isArray(items)) {
    return [];
  }

  return items;
};

const riskColors = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  UNKNOWN: "#64748b",
};

function App() {
  const [kpis, setKpis] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [dailyData, setDailyData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const loadDashboard = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [
        kpiResponse,
        transactionResponse,
        alertResponse,
        riskResponse,
        dailyResponse,
      ] = await Promise.all([
        getKPIs(),
        getTransactions(),
        getAlerts(),
        getRiskDistribution(),
        getDailyAnalytics(),
      ]);

      setKpis(kpiResponse);
      setTransactions(normalizeTransactions(transactionResponse));
      setAlerts(normalizeAlerts(alertResponse));
      setRiskData(normalizeRiskData(riskResponse));
      setDailyData(normalizeDailyData(dailyResponse));
    } catch (err) {
      setError(
        "Unable to load SmartBank data. Make sure ORDS and the frontend server are running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return transactions.slice(0, 12);
    }

    return transactions
      .filter((transaction) => {
        const searchable = [
          transaction.transaction_id,
          transaction.customer_name,
          transaction.merchant_name,
          transaction.merchant,
          transaction.location,
          transaction.transaction_status,
          transaction.status,
          transaction.transaction_type,
          transaction.device_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .slice(0, 12);
  }, [transactions, search]);

  const kpiCards = [
    {
      label: "Total Customers",
      value: formatNumber(
        getValue(kpis, ["total_customers", "customers"], 0)
      ),
      icon: Users,
      className: "blue",
      trend: "Customer base",
    },
    {
      label: "Active Accounts",
      value: formatNumber(
        getValue(kpis, ["total_accounts", "accounts"], 0)
      ),
      icon: WalletCards,
      className: "violet",
      trend: "Banking accounts",
    },
    {
      label: "Transactions",
      value: formatNumber(
        getValue(kpis, ["total_transactions", "transactions"], 0)
      ),
      icon: Activity,
      className: "cyan",
      trend: "Processed records",
    },
    {
      label: "Flagged Transactions",
      value: formatNumber(
        getValue(kpis, ["flagged_transactions", "flagged"], 0)
      ),
      icon: ShieldAlert,
      className: "orange",
      trend: "Requires attention",
    },
    {
      label: "Open Alerts",
      value: formatNumber(
        getValue(kpis, ["open_alerts", "alerts"], 0)
      ),
      icon: Bell,
      className: "red",
      trend: "Pending investigation",
    },
    {
      label: "High Risk Alerts",
      value: formatNumber(
        getValue(kpis, ["high_risk_alerts", "high_risk"], 0)
      ),
      icon: AlertTriangle,
      className: "danger",
      trend: "Critical priority",
    },
  ];

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: CreditCard,
    },
    {
      id: "alerts",
      label: "Fraud Alerts",
      icon: ShieldAlert,
      badge: alerts.length,
    },
  ];

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-orbit">
          <div className="loading-core">
            <ShieldCheck size={30} />
          </div>
        </div>

        <h1>SmartBank</h1>
        <p>Connecting to fraud intelligence engine...</p>

        <div className="loading-bar">
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div
        className={`mobile-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={25} />
          </div>

          <div>
            <div className="brand-name">SmartBank</div>
            <div className="brand-subtitle">Fraud Intelligence</div>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-section-label">MONITORING</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`nav-item ${
                  activeSection === item.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveSection(item.id);
                  setSidebarOpen(false);

                  const target =
                    item.id === "transactions"
                      ? "transactions-section"
                      : item.id === "alerts"
                        ? "alerts-section"
                        : "overview-section";

                  document
                    .getElementById(target)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.badge ? (
                  <span className="nav-badge">{item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section-label">SYSTEM</div>

        <div className="system-status">
          <div className="status-dot" />
          <div>
            <strong>System Online</strong>
            <span>Oracle + ORDS connected</span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="database-card">
            <Database size={17} />
            <div>
              <strong>Oracle 21c XE</strong>
              <span>SmartBank Database</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            <span>SmartBank</span>
            <ChevronRight size={15} />
            <strong>Fraud Operations Center</strong>
          </div>

          <div className="topbar-actions">
            <div className="live-indicator">
              <span />
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
              <div className="profile-text">
                <strong>Fraud Analyst</strong>
                <span>Operations</span>
              </div>
            </div>
          </div>
        </header>

        <section className="dashboard-content" id="overview-section">
          <div className="hero">
            <div>
              <div className="eyebrow">
                <Zap size={14} />
                REAL-TIME FRAUD MONITORING
              </div>

              <h1>
                Banking security,
                <span> intelligently monitored.</span>
              </h1>

              <p>
                Monitor transactions, investigate suspicious activity,
                and identify high-risk behavior from one centralized
                intelligence dashboard.
              </p>
            </div>

            <div className="hero-status">
              <div className="hero-status-icon">
                <ShieldCheck size={24} />
              </div>

              <div>
                <strong>Protection Active</strong>
                <span>Fraud detection engine operational</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              <span>{error}</span>

              <button onClick={() => loadDashboard()}>
                Retry
              </button>
            </div>
          )}

          <div className="section-heading">
            <div>
              <span className="section-kicker">SYSTEM OVERVIEW</span>
              <h2>Security at a glance</h2>
            </div>

            <div className="updated">
              <Clock3 size={15} />
              Live database data
            </div>
          </div>

          <div className="kpi-grid">
            {kpiCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  className={`kpi-card ${card.className}`}
                  key={card.label}
                >
                  <div className="kpi-top">
                    <div className="kpi-icon">
                      <Icon size={20} />
                    </div>

                    <span className="kpi-arrow">
                      <ArrowUpRight size={16} />
                    </span>
                  </div>

                  <div className="kpi-value">{card.value}</div>

                  <div className="kpi-label">{card.label}</div>

                  <div className="kpi-footer">
                    <span>{card.trend}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="analytics-grid">
            <section className="panel large-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">
                    TRANSACTION ACTIVITY
                  </span>
                  <h3>Daily transaction volume</h3>
                </div>

                <div className="panel-icon cyan">
                  <Activity size={18} />
                </div>
              </div>

              <div className="chart-container">
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
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
                            stopColor="#22d3ee"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#22d3ee"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#273244"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        stroke="#64748b"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />

                      <Tooltip
                        contentStyle={{
                          background: "#111827",
                          border: "1px solid #263244",
                          borderRadius: "12px",
                          color: "#fff",
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="transactions"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        fill="url(#transactionGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <Activity size={28} />
                    <span>No daily analytics available</span>
                  </div>
                )}
              </div>
            </section>

            <section className="panel risk-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">
                    RISK INTELLIGENCE
                  </span>
                  <h3>Risk distribution</h3>
                </div>

                <div className="panel-icon red">
                  <ShieldAlert size={18} />
                </div>
              </div>

              <div className="risk-chart">
                {riskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        stroke="none"
                      >
                        {riskData.map((entry, index) => {
                          const riskName =
                            String(entry.name || "UNKNOWN")
                              .toUpperCase();

                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                riskColors[riskName] ||
                                riskColors.UNKNOWN
                              }
                            />
                          );
                        })}
                      </Pie>

                      <Tooltip
                        contentStyle={{
                          background: "#111827",
                          border: "1px solid #263244",
                          borderRadius: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <ShieldAlert size={28} />
                    <span>No risk data</span>
                  </div>
                )}
              </div>

              <div className="risk-legend">
                {riskData.map((item) => {
                  const name = String(item.name || "UNKNOWN")
                    .toUpperCase();

                  return (
                    <div className="risk-item" key={name}>
                      <div className="risk-name">
                        <span
                          className="risk-dot"
                          style={{
                            background:
                              riskColors[name] ||
                              riskColors.UNKNOWN,
                          }}
                        />
                        {name}
                      </div>

                      <strong>{formatNumber(item.value)}</strong>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section
            className="panel transactions-panel"
            id="transactions-section"
          >
            <div className="panel-header transactions-header">
              <div>
                <span className="section-kicker">
                  LIVE TRANSACTION FEED
                </span>
                <h3>Recent transactions</h3>
              </div>

              <div className="transaction-tools">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search transactions..."
                  />

                  {search && (
                    <button onClick={() => setSearch("")}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Customer</th>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((transaction) => {
                    const status = String(
                      transaction.transaction_status ||
                        transaction.status ||
                        "UNKNOWN"
                    ).toUpperCase();

                    const amount = Number(
                      transaction.amount || 0
                    );

                    return (
                      <tr
                        key={
                          transaction.transaction_id ||
                          `${transaction.account_id}-${transaction.transaction_time}`
                        }
                      >
                        <td>
                          <div className="transaction-id">
                            <span className="transaction-icon">
                              <CreditCard size={15} />
                            </span>

                            <div>
                              <strong>
                                #
                                {transaction.transaction_id ||
                                  "—"}
                              </strong>

                              <span>
                                Account{" "}
                                {transaction.account_number ||
                                  transaction.account_id ||
                                  "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="customer-cell">
                            <div className="customer-avatar">
                              {String(
                                transaction.customer_name ||
                                  "C"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <span>
                              {transaction.customer_name ||
                                "Unknown customer"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="merchant-cell">
                            <strong>
                              {transaction.merchant_name ||
                                transaction.merchant ||
                                "Unknown"}
                            </strong>

                            <span>
                              {transaction.merchant_category ||
                                transaction.category ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong className="amount">
                            {formatCurrency(amount)}
                          </strong>
                        </td>

                        <td>
                          <span className="type-pill">
                            {transaction.transaction_type ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <span className="location">
                            {transaction.location || "—"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`status-pill ${status.toLowerCase()}`}
                          >
                            <span />
                            {status}
                          </span>
                        </td>

                        <td>
                          <span className="time">
                            {formatDate(
                              transaction.transaction_time
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredTransactions.length === 0 && (
                <div className="empty-table">
                  <Search size={26} />
                  <strong>No transactions found</strong>
                  <span>
                    Try changing your search query.
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="bottom-grid" id="alerts-section">
            <div className="panel alerts-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">
                    FRAUD OPERATIONS
                  </span>
                  <h3>Recent alerts</h3>
                </div>

                <div className="alert-count">
                  {formatNumber(alerts.length)} open
                </div>
              </div>

              <div className="alerts-list">
                {alerts.slice(0, 6).map((alert) => {
                  const level = String(
                    alert.risk_level ||
                      alert.riskLevel ||
                      "UNKNOWN"
                  ).toUpperCase();

                  return (
                    <div className="alert-row" key={alert.alert_id}>
                      <div
                        className={`alert-severity ${level.toLowerCase()}`}
                      >
                        <AlertTriangle size={17} />
                      </div>

                      <div className="alert-info">
                        <strong>
                          Alert #
                          {alert.alert_id || "—"}
                        </strong>

                        <span>
                          {alert.reason ||
                            "Suspicious transaction detected"}
                        </span>
                      </div>

                      <div className="alert-score">
                        <span>Risk</span>
                        <strong>
                          {alert.risk_score ?? "—"}
                        </strong>
                      </div>

                      <ChevronRight
                        size={17}
                        className="alert-chevron"
                      />
                    </div>
                  );
                })}

                {alerts.length === 0 && (
                  <div className="empty-state">
                    <ShieldCheck size={28} />
                    <span>No active fraud alerts</span>
                  </div>
                )}
              </div>
            </div>

            <div className="panel protection-panel">
              <div className="protection-glow" />

              <div className="protection-icon">
                <ShieldCheck size={28} />
              </div>

              <span className="section-kicker">
                SMARTBANK SECURITY
              </span>

              <h3>Fraud detection engine</h3>

              <p>
                Transactions are continuously evaluated using
                rule-based risk intelligence across amount,
                device, location, and transaction behavior.
              </p>

              <div className="protection-metrics">
                <div>
                  <strong>
                    {formatNumber(
                      getValue(
                        kpis,
                        ["flagged_transactions", "flagged"],
                        0
                      )
                    )}
                  </strong>
                  <span>Flagged</span>
                </div>

                <div>
                  <strong>
                    {formatNumber(
                      getValue(
                        kpis,
                        ["high_risk_alerts", "high_risk"],
                        0
                      )
                    )}
                  </strong>
                  <span>High risk</span>
                </div>

                <div>
                  <strong>24/7</strong>
                  <span>Monitoring</span>
                </div>
              </div>

              <div className="protection-footer">
                <CheckCircle2 size={16} />
                Detection system operational
              </div>
            </div>
          </section>

          <footer className="dashboard-footer">
            <div>
              <ShieldCheck size={15} />
              SmartBank Fraud Intelligence Platform
            </div>

            <span>
              Oracle 21c XE • PL/SQL • ORDS • React
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;