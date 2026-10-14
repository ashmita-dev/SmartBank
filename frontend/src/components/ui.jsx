import { AlertTriangle, CheckCircle2, Database, RefreshCw, X } from "lucide-react";
import { formatLabel, riskClass, statusClass } from "../utils/format";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <section className="page-header page-header-row">
      <div>
        <div className="section-label">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>

      {actions && <div className="page-header-actions">{actions}</div>}
    </section>
  );
}

export function RefreshButton({ onClick, refreshing, label = "Refresh data" }) {
  return (
    <button
      type="button"
      className="refresh-button"
      onClick={onClick}
      disabled={refreshing}
      title={label}
      aria-label={label}
    >
      <RefreshCw size={18} className={refreshing ? "spin" : ""} />
    </button>
  );
}

export function LoadingState({ text = "Loading..." }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-spinner" />
      <span>{text}</span>
    </div>
  );
}

export function EmptyState({ text, icon: Icon = Database }) {
  return (
    <div className="empty-state">
      <Icon size={20} />
      <span>{text}</span>
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;

  return (
    <div className="error-banner" role="alert">
      <AlertTriangle size={18} />
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "success", children, onDismiss }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`notice ${tone}`} role="status" aria-live="polite">
      <Icon size={17} />
      <div>{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${statusClass(status)}`}>
      {formatLabel(status) || "—"}
    </span>
  );
}

export function RiskBadge({ level }) {
  return <span className={`risk-badge ${riskClass(level)}`}>{level || "—"}</span>;
}

// Fraud-review column: shows the FRAUD_ALERT for a transaction, separate from
// its payment status. `alert === undefined` means alerts could not be loaded.
export function FraudReview({ alert }) {
  if (alert === undefined) return <span className="review-none">Unavailable</span>;
  if (!alert) return <span className="review-none">No alert</span>;

  return (
    <span className="review-cell">
      <RiskBadge level={alert.risk_level} />
      <span className="score-text">{alert.risk_score}</span>
      <StatusBadge status={alert.status} />
    </span>
  );
}

export function SummaryCard({ icon, label, value, tone }) {
  return (
    <div className={`summary-card ${tone || ""}`}>
      <div className="summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

// DEMO MODE: marks rows a visitor created in the browser simulation.
export function SimTag({ row }) {
  if (!row?.simulated) return null;
  return (
    <span className="sim-tag" title="Created in demo mode: simulated in this browser, not stored in Oracle">
      SIMULATED
    </span>
  );
}
