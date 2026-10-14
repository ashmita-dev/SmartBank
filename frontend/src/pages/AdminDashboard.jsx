import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
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
  DEMO_MODE,
} from "../api";
import AlertModal from "../components/AlertModal";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  RefreshButton,
  RiskBadge,
  StatusBadge,
} from "../components/ui";
import useApiData from "../hooks/useApiData";
import {
  formatCurrency,
  formatDate,
  formatShortDate,
  transactionStatus,
} from "../utils/format";

const RISK_COLORS = {
  HIGH: "#ff5c6c",
  MEDIUM: "#ffb84d",
  LOW: "#27d7a1",
};

const TOOLTIP_STYLE = {
  background: "#101827",
  border: "1px solid #263449",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
};

async function loadOverview() {
  const [kpis, transactions, alerts, riskDistribution, dailyAnalytics] =
    await Promise.all([
      getKPIs(),
      getTransactions(),
      getAlerts(),
      getRiskDistribution(),
      getDailyAnalytics(),
    ]);

  return { kpis: kpis || {}, transactions, alerts, riskDistribution, dailyAnalytics };
}

function AdminDashboard() {
  const { data, setData, loading, refreshing, error, updatedAt, refresh } =
    useApiData(loadOverview);
  const [selectedAlert, setSelectedAlert] = useState(null);

  if (loading) {
    return <LoadingState text="Loading SmartBank intelligence…" />;
  }

  const kpis = data?.kpis || {};
  const transactions = data?.transactions || [];
  const alerts = data?.alerts || [];

  const chartData = (data?.dailyAnalytics || []).map((item) => ({
    date: formatShortDate(item.txn_date),
    transactions: Number(item.total_transactions || 0),
    highRisk: Number(item.high_risk_count || 0),
    mediumRisk: Number(item.medium_risk_count || 0),
  }));

  const riskData = (data?.riskDistribution || []).map((item) => ({
    name: item.risk_level || "UNKNOWN",
    value: Number(item.alert_count || 0),
    average: item.average_risk_score,
  }));

  const priorityAlerts = alerts
    .filter((alert) => ["OPEN", "INVESTIGATING"].includes(String(alert.status).toUpperCase()))
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score))
    .slice(0, 6);

  function handleAlertUpdated(alertId, status) {
    setData((current) => ({
      ...current,
      alerts: current.alerts.map((alert) =>
        alert.alert_id === alertId ? { ...alert, status } : alert
      ),
    }));
    setSelectedAlert(null);
    refresh();
  }

  return (
    <>
      <section className="hero-section">
        <div>
          <div className="eyebrow">
            <Activity size={15} />
            FRAUD OPERATIONS CENTER
          </div>

          <h1>
            Banking security, <span>intelligently monitored.</span>
          </h1>

          <p>
            {DEMO_MODE
              ? "Demo mode: these figures are simulated in your browser from the project's synthetic seed data, scored by a JavaScript copy of the PL/SQL rules. They are not read from Oracle."
              : "Every transaction inserted into Oracle is scored by the PL/SQL fraud engine. Suspicious activity raises an alert that is assigned to the analyst with the lightest workload."}
          </p>
        </div>

        <div className={`protection-card ${error ? "offline" : ""}`}>
          <div className="protection-icon">
            {error ? <AlertTriangle size={23} /> : <ShieldCheck size={23} />}
          </div>
          <div>
            <strong>{error ? (DEMO_MODE ? "Demo data unavailable" : "Database unreachable") : DEMO_MODE ? "Demo mode: not connected to Oracle" : "Connected to Oracle"}</strong>
            <span>
              {error
                ? "Figures below may be missing"
                : `Updated ${updatedAt?.toLocaleTimeString("en-IN") || ""}`}
            </span>
          </div>
        </div>
      </section>

      <ErrorBanner error={error} onRetry={refresh} />

      <section className="section-heading">
        <div>
          <div className="section-label">SYSTEM OVERVIEW</div>
          <h2>Security at a glance</h2>
        </div>

        <RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh dashboard" />
      </section>

      <section className="kpi-grid">
        <KpiCard icon={<Users size={21} />} value={kpis.total_customers} label="Customers" footer="CUSTOMER table" tone="blue" />
        <KpiCard icon={<WalletCards size={21} />} value={kpis.total_accounts} label="Accounts" footer="Savings + current" tone="purple" />
        <KpiCard icon={<Activity size={21} />} value={kpis.total_transactions} label="Transactions" footer={DEMO_MODE ? "Simulated in browser" : "Recorded in Oracle"} tone="cyan" />
        <KpiCard icon={<Shield size={21} />} value={kpis.flagged_transactions} label="Fraud Alerts" footer="Medium + high risk" tone="amber" />
        <KpiCard icon={<Bell size={21} />} value={kpis.open_alerts} label="Open Alerts" footer="Awaiting review" tone="red" to="/admin/alerts" />
        <KpiCard icon={<AlertTriangle size={21} />} value={kpis.high_risk_alerts} label="High Risk Alerts" footer="Score 70 – 100" tone="red" to="/admin/alerts" />
      </section>

      <section className="analytics-grid">
        <div className="panel activity-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">TRANSACTION ACTIVITY</div>
              <h3>Daily volume and risky transactions</h3>
            </div>

            <div className="panel-icon cyan">
              <Activity size={20} />
            </div>
          </div>

          <div className="chart-container">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="transactionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#27d7ff" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#27d7ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#152234" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#7c8aa0", fontSize: 11 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#7c8aa0", fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" name="Transactions" dataKey="transactions" stroke="#27d7ff" strokeWidth={2} fill="url(#transactionGradient)" />
                  <Area type="monotone" name="High risk" dataKey="highRisk" stroke="#ff5c6c" strokeWidth={2} fill="transparent" />
                  <Area type="monotone" name="Medium risk" dataKey="mediumRisk" stroke="#ffb84d" strokeWidth={1.5} strokeDasharray="4 3" fill="transparent" />
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
              <h3>Alerts by risk level</h3>
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
                    <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={64} outerRadius={92} paddingAngle={4}>
                      {riskData.map((entry) => (
                        <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#657189"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="risk-legend">
                  {riskData.map((item) => (
                    <div className="risk-legend-item" key={item.name}>
                      <span className="risk-dot" style={{ background: RISK_COLORS[item.name] || "#657189" }} />
                      <span>
                        {item.name}
                        {item.average != null && <small> · avg {item.average}</small>}
                      </span>
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

            <Link className="text-button" to="/admin/transactions">
              View all
              <ChevronRight size={15} />
            </Link>
          </div>

          {transactions.length ? (
            <div className="mini-list">
              {transactions.slice(0, 7).map((transaction) => (
                <div className="mini-row" key={transaction.transaction_id}>
                  <div className="transaction-icon">
                    <CircleDollarSign size={16} />
                  </div>
                  <div className="mini-main">
                    <strong>
                      #{transaction.transaction_id} · {transaction.customer_name}
                    </strong>
                    <span>
                      {transaction.merchant_name || "No merchant"} · {transaction.location || "Unknown"}
                      {transaction.device_identifier && (
                        <>
                          {" · "}
                          <Smartphone size={11} /> {transaction.device_identifier}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mini-side">
                    <strong>{formatCurrency(transaction.amount)}</strong>
                    <StatusBadge status={transactionStatus(transaction)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No transactions available." />
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">REVIEW QUEUE</div>
              <h3>Highest-risk open alerts</h3>
            </div>

            <Link className="text-button" to="/admin/alerts">
              View all
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="alert-list">
            {priorityAlerts.length ? (
              priorityAlerts.map((alert) => (
                <button
                  type="button"
                  className="alert-row"
                  key={alert.alert_id}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="alert-row-icon">
                    <AlertTriangle size={17} />
                  </div>

                  <div className="alert-row-content">
                    <strong>
                      Alert #{alert.alert_id} · score {alert.risk_score}
                    </strong>
                    <span>{alert.reason || "Suspicious transaction detected"}</span>
                  </div>

                  <div className="alert-row-right">
                    <RiskBadge level={alert.risk_level} />
                    <ChevronRight size={15} />
                  </div>
                </button>
              ))
            ) : (
              <EmptyState text="No open or investigating alerts." icon={ShieldCheck} />
            )}
          </div>
        </div>
      </section>

      <section className="panel protection-panel">
        <div className="protection-large-icon">
          <ShieldCheck size={25} />
        </div>

        <div className="protection-copy">
          <div className="section-label">HOW DETECTION WORKS</div>
          <h3>TRG_FRAUD_MONITOR → DETECT_FRAUD → GENERATE_ALERT</h3>
          <p>
            CALCULATE_RISK scores each new transaction on amount (up to +40),
            rapid repeat activity (up to +25), an unrecognised device (+20) and
            a location away from the customer’s home city (+20). Scores of
            40–69 are MEDIUM and 70–100 are HIGH; HIGH transactions are also
            marked FLAGGED.
          </p>
        </div>

        <div className="protection-stats">
          <div>
            <span>Last refresh</span>
            <strong>{updatedAt ? formatDate(updatedAt) : "—"}</strong>
          </div>
        </div>
      </section>

      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onUpdated={handleAlertUpdated}
        />
      )}
    </>
  );
}

function KpiCard({ icon, value, label, footer, tone, to }) {
  const content = (
    <>
      <div className="kpi-top">
        <div className="kpi-icon">{icon}</div>
        {to && <ArrowUpRight size={17} className="kpi-arrow" />}
      </div>

      <strong className="kpi-value">{value ?? "—"}</strong>
      <span className="kpi-label">{label}</span>

      <div className="kpi-footer">{footer}</div>
    </>
  );

  return to ? (
    <Link className={`kpi-card ${tone} kpi-link`} to={to}>
      {content}
    </Link>
  ) : (
    <div className={`kpi-card ${tone}`}>{content}</div>
  );
}

export default AdminDashboard;
