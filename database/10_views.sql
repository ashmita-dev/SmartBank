CREATE OR REPLACE VIEW v_high_risk_transactions AS
SELECT
  t.transaction_id,
  t.account_id,
  a.account_number,
  c.customer_id,
  c.first_name || ' ' || c.last_name AS customer_name,
  t.amount,
  t.transaction_type,
  t.transaction_time,
  t.location,
  m.merchant_name,
  d.device_type,
  fa.risk_score,
  fa.risk_level,
  fa.reason,
  fa.status AS alert_status
FROM bank_transaction t
JOIN account a ON a.account_id = t.account_id
JOIN customer c ON c.customer_id = a.customer_id
JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
LEFT JOIN merchant m ON m.merchant_id = t.merchant_id
LEFT JOIN device d ON d.device_id = t.device_id
WHERE fa.risk_level = 'HIGH';

CREATE OR REPLACE VIEW v_fraud_alert_summary AS
SELECT
  risk_level,
  status,
  COUNT(*) AS alert_count,
  ROUND(AVG(risk_score), 2) AS avg_risk_score,
  MIN(created_at) AS earliest_alert,
  MAX(created_at) AS latest_alert
FROM fraud_alert
GROUP BY risk_level, status;

CREATE OR REPLACE VIEW v_customer_transaction_summary AS
SELECT
  c.customer_id,
  c.first_name || ' ' || c.last_name AS customer_name,
  CASE WHEN ic.customer_id IS NOT NULL THEN 'INDIVIDUAL' ELSE 'BUSINESS' END AS customer_type,
  COUNT(t.transaction_id) AS total_transactions,
  SUM(t.amount) AS total_amount,
  ROUND(AVG(t.amount), 2) AS avg_amount,
  SUM(CASE WHEN fa.alert_id IS NOT NULL THEN 1 ELSE 0 END) AS flagged_transactions
FROM customer c
JOIN account a ON a.customer_id = c.customer_id
JOIN bank_transaction t ON t.account_id = a.account_id
LEFT JOIN individual_customer ic ON ic.customer_id = c.customer_id
LEFT JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
GROUP BY c.customer_id, c.first_name, c.last_name, ic.customer_id;

CREATE OR REPLACE VIEW v_daily_transaction_analytics AS
SELECT
  TRUNC(t.transaction_time) AS txn_date,
  COUNT(*) AS total_transactions,
  SUM(t.amount) AS total_amount,
  ROUND(AVG(t.amount), 2) AS avg_amount,
  SUM(CASE WHEN fa.risk_level = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_count,
  SUM(CASE WHEN fa.risk_level = 'MEDIUM' THEN 1 ELSE 0 END) AS medium_risk_count
FROM bank_transaction t
LEFT JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
GROUP BY TRUNC(t.transaction_time);