import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatCurrency, formatDate, transactionStatus } from "../utils/format";
import { StatusBadge } from "./ui";

function TransactionDialog({ transaction: t, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="alert-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="section-label">TRANSACTION DETAILS</div>
            <h2 id="transaction-dialog-title">Transaction #{t.transaction_id}</h2>
          </div>

          <button type="button" ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div className="modal-details">
          <div>
            <span>Amount</span>
            <strong>{formatCurrency(t.amount)}</strong>
          </div>
          <div>
            <span>Status</span>
            <StatusBadge status={transactionStatus(t)} />
          </div>
          <div>
            <span>Type</span>
            <strong>{t.transaction_type || "—"}</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{formatDate(t.transaction_time)}</strong>
          </div>
          {t.customer_name && (
            <div>
              <span>Customer</span>
              <strong>{t.customer_name}</strong>
            </div>
          )}
          <div>
            <span>Account</span>
            <strong>{t.account_number || "—"}</strong>
          </div>
          <div>
            <span>Merchant</span>
            <strong>
              {t.merchant_name ? `${t.merchant_name} (${t.merchant_category})` : "—"}
            </strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{t.location || "—"}</strong>
          </div>
          <div className="full-detail">
            <span>Device</span>
            <strong>{t.device_identifier ? `${t.device_identifier} (${t.device_type})` : "—"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransactionDialog;
