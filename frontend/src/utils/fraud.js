// A transaction's payment status (COMPLETED / FLAGGED / ...) and its fraud
// review (an optional FRAUD_ALERT row) are separate facts:
//   - DETECT_FRAUD creates an alert for MEDIUM (40-69) and HIGH (70-100) risk.
//   - Only HIGH also changes the transaction status to FLAGGED.
// So a COMPLETED transaction can still have an OPEN alert awaiting review.

export const REVIEW_STATUSES = ["OPEN", "INVESTIGATING"];

export function isUnderReview(alert) {
  return Boolean(alert) && REVIEW_STATUSES.includes(String(alert.status).toUpperCase());
}

// Returns new transaction objects with an `alert` field (the FRAUD_ALERT row
// or null). FRAUD_ALERT.TRANSACTION_ID is unique, so there is at most one.
export function attachAlerts(transactions, alerts) {
  if (!alerts) return transactions.map((t) => ({ ...t, alert: undefined }));

  const byTransaction = new Map(alerts.map((a) => [Number(a.transaction_id), a]));
  return transactions.map((t) => ({ ...t, alert: byTransaction.get(Number(t.transaction_id)) || null }));
}
