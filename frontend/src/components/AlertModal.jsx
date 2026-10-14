import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Search, ShieldOff, X, XCircle } from "lucide-react";
import { getAlertById, updateAlert } from "../api";
import { formatCurrency, formatDate } from "../utils/format";
import { ErrorBanner, RiskBadge, StatusBadge } from "./ui";

const ACTIONS = [
  { status: "INVESTIGATING", label: "Start investigation", icon: Search, className: "secondary-action" },
  { status: "FALSE_POSITIVE", label: "Mark false positive", icon: ShieldOff, className: "secondary-action" },
  { status: "CLOSED", label: "Close alert", icon: XCircle, className: "secondary-action" },
  { status: "CONFIRMED_FRAUD", label: "Confirm fraud", icon: CheckCircle2, className: "primary-action danger" },
];

// Review dialog for one fraud alert. Loads full context from
// GET /alerts/:id and updates status via PUT /alerts/:id.
function AlertModal({ alert, onClose, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  const view = { ...alert, ...(detail || {}) };

  useEffect(() => {
    let cancelled = false;

    getAlertById(alert.alert_id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [alert.alert_id]);

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function changeStatus(status) {
    setUpdating(status);
    setError(null);

    try {
      const result = await updateAlert(alert.alert_id, status);
      // The API echoes the stored row; trust the database over the request.
      let saved = String(result?.status || result?.items?.[0]?.status || "").toUpperCase();

      // No status echoed: read the row back rather than assume the write stuck.
      if (!saved) {
        const stored = await getAlertById(alert.alert_id);
        saved = String(stored?.status || stored?.items?.[0]?.status || "").toUpperCase();
        if (!saved) {
          throw new Error("The update was sent, but the alert could not be read back to confirm it. Refresh the alert list to check.");
        }
      }

      if (saved && saved !== status) {
        throw new Error(
          `The API saved status ${saved} instead of ${status}. Re-run database/ords_endpoints.sql to publish the updated PUT /alerts/:id handler.`
        );
      }

      onUpdated(alert.alert_id, saved);
    } catch (err) {
      setError(err);
    } finally {
      setUpdating(null);
    }
  }

  const currentStatus = String(view.status || "").toUpperCase();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="alert-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="section-label">FRAUD ALERT REVIEW</div>
            <h2 id="alert-modal-title">Alert #{view.alert_id}</h2>
          </div>

          <button
            type="button"
            ref={closeRef}
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-risk">
          <div>
            <span className="modal-label">Risk level</span>
            <RiskBadge level={view.risk_level} />
          </div>

          <div>
            <span className="modal-label">Risk score</span>
            <strong className="large-score">
              {view.risk_score ?? "—"}
              <small>/100</small>
            </strong>
          </div>

          <div>
            <span className="modal-label">Status</span>
            <StatusBadge status={view.status} />
          </div>
        </div>

        <div className="modal-details">
          <div className="full-detail">
            <span>Detection reasons</span>
            <strong>{view.reason || "—"}</strong>
          </div>
          <div>
            <span>Transaction</span>
            <strong>
              #{view.transaction_id} · {view.transaction_type || "—"}
            </strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>{view.amount != null ? formatCurrency(view.amount) : "—"}</strong>
          </div>
          <div>
            <span>Customer</span>
            <strong>
              {view.customer_name
                ? `${view.customer_name} (${view.account_number})`
                : detailError
                ? "Unavailable"
                : "Loading…"}
            </strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{view.location || "—"}</strong>
          </div>
          <div>
            <span>Merchant</span>
            <strong>{view.merchant_name || (detail ? "—" : "…")}</strong>
          </div>
          <div>
            <span>Device</span>
            <strong>
              {view.device_identifier
                ? `${view.device_identifier} (${view.device_type})`
                : detail
                ? "—"
                : "…"}
            </strong>
          </div>
          <div>
            <span>Assigned analyst</span>
            <strong>{view.analyst_name || "Unassigned"}</strong>
          </div>
          <div>
            <span>Alert created</span>
            <strong>{formatDate(view.created_at)}</strong>
          </div>
        </div>

        <ErrorBanner error={error} />

        <div className="modal-actions wrap">
          {ACTIONS.map(({ status, label, icon: Icon, className }) => (
            <button
              type="button"
              key={status}
              className={className}
              disabled={Boolean(updating) || currentStatus === status}
              onClick={() => changeStatus(status)}
              title={currentStatus === status ? `Alert is already ${status}` : undefined}
            >
              <Icon size={16} />
              {updating === status ? "Saving…" : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
