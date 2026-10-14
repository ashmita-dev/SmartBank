// DEMO MODE ONLY: a JavaScript copy of the SmartBank PL/SQL fraud rules,
// used to SIMULATE results when the public site has no Oracle backend.
// The real engine is CALCULATE_RISK / CLASSIFY_RISK (database/05_functions.sql)
// and DETECT_FRAUD / GENERATE_ALERT (database/06_procedures.sql), run by
// TRG_FRAUD_MONITOR inside Oracle. Any change there must be mirrored here;
// src/test/demoEngine.test.js checks this copy against an Oracle run.

const TEN_MINUTES_MS = 10 * 60 * 1000;

// state: { transactions: [...already stored rows...], accounts, addresses }
// Rows use { transaction_id, account_id, device_id, amount, location, time_ms }.
function context(txn, state) {
  const others = state.transactions.filter(
    (t) => t.account_id === txn.account_id && t.transaction_id !== txn.transaction_id
  );

  // BETWEEN v_txn_time - 10/1440 AND v_txn_time (inclusive)
  const recent = others.filter(
    (t) => t.time_ms >= txn.time_ms - TEN_MINUTES_MS && t.time_ms <= txn.time_ms
  ).length;

  // Same account + device, strictly earlier
  const deviceSeen =
    txn.device_id == null
      ? null
      : others.filter((t) => t.device_id === txn.device_id && t.time_ms < txn.time_ms).length;

  let locationMatch = null;
  if (txn.location != null) {
    const account = state.accounts.find((a) => a.account_id === txn.account_id);
    locationMatch = state.addresses.filter(
      (a) => account && a.customer_id === account.customer_id &&
        String(a.city).toUpperCase() === String(txn.location).toUpperCase()
    ).length;
  }

  return { recent, deviceSeen, locationMatch };
}

// CALCULATE_RISK
export function calculateRisk(txn, state) {
  const { recent, deviceSeen, locationMatch } = context(txn, state);
  let score = 0;

  if (txn.amount > 100000) score += 40;
  else if (txn.amount > 50000) score += 25;
  else if (txn.amount > 20000) score += 10;

  if (recent >= 2) score += 25;
  else if (recent === 1) score += 15;

  if (deviceSeen === 0) score += 20;
  if (locationMatch === 0) score += 20;

  return Math.min(score, 100);
}

// CLASSIFY_RISK
export function classifyRisk(score) {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

// The reason text DETECT_FRAUD builds (same wording and "; " separators).
export function fraudReason(txn, state) {
  const { recent, deviceSeen, locationMatch } = context(txn, state);
  let reason = "";
  if (txn.amount > 50000) reason += "High transaction amount; ";
  if (recent >= 1) reason += "Multiple transactions in short period; ";
  if (deviceSeen === 0) reason += "Unrecognized device; ";
  if (locationMatch === 0) reason += "Unusual transaction location; ";
  return reason;
}

// GENERATE_ALERT: the analyst with the fewest OPEN alerts. Oracle's tie order
// is unspecified; the simulation picks the lowest analyst_id.
export function pickAnalyst(analysts, alerts) {
  let best = null;
  for (const analyst of [...analysts].sort((a, b) => a.analyst_id - b.analyst_id)) {
    const open = alerts.filter((a) => a.analyst_id === analyst.analyst_id && a.status === "OPEN").length;
    if (!best || open < best.open) best = { id: analyst.analyst_id, open };
  }
  return best ? best.id : null;
}

// DETECT_FRAUD for a transaction that is already in state.transactions.
// Returns { score, level, reason, alert|null, status } without mutating state.
export function detectFraud(txn, state, { analysts, alerts, nextAlertId, createdAtMs }) {
  const score = calculateRisk(txn, state);
  const level = classifyRisk(score);
  const reason = fraudReason(txn, state);
  let alert = null;
  let status = txn.status;

  if (level === "MEDIUM" || level === "HIGH") {
    alert = {
      alert_id: nextAlertId,
      transaction_id: txn.transaction_id,
      analyst_id: pickAnalyst(analysts, alerts),
      risk_score: score,
      risk_level: level,
      reason,
      status: "OPEN",
      created_ms: createdAtMs,
    };
    if (level === "HIGH") status = "FLAGGED";
  }

  return { score, level, reason, alert, status };
}
