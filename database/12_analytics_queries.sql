SELECT COUNT(*) AS total_transactions,
       SUM(amount) AS total_amount,
       ROUND(AVG(amount), 2) AS avg_amount
FROM bank_transaction;

SELECT c.customer_id,
       c.first_name || ' ' || c.last_name AS customer_name,
       COUNT(t.transaction_id) AS num_transactions,
       SUM(t.amount) AS total_spent
FROM customer c
JOIN account a ON a.customer_id = c.customer_id
JOIN bank_transaction t ON t.account_id = a.account_id
GROUP BY c.customer_id, c.first_name, c.last_name
ORDER BY total_spent DESC;

SELECT m.category,
       COUNT(t.transaction_id) AS num_transactions,
       SUM(t.amount) AS total_amount
FROM bank_transaction t
JOIN merchant m ON m.merchant_id = t.merchant_id
GROUP BY m.category
HAVING COUNT(t.transaction_id) > 3
ORDER BY total_amount DESC;

SELECT risk_level,
       status,
       COUNT(*) AS alert_count
FROM fraud_alert
GROUP BY risk_level, status
ORDER BY risk_level, status;

SELECT t.transaction_id,
       a.account_number,
       t.amount,
       t.location,
       fa.risk_score,
       fa.reason
FROM bank_transaction t
JOIN account a ON a.account_id = t.account_id
JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
WHERE fa.risk_level = 'HIGH'
ORDER BY fa.risk_score DESC;

SELECT m.merchant_name,
       m.risk_level AS merchant_risk_level,
       COUNT(fa.alert_id) AS flagged_count
FROM merchant m
JOIN bank_transaction t ON t.merchant_id = m.merchant_id
JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
GROUP BY m.merchant_name, m.risk_level
ORDER BY flagged_count DESC;

SELECT t.location,
       COUNT(fa.alert_id) AS alert_count,
       ROUND(AVG(fa.risk_score), 2) AS avg_score
FROM bank_transaction t
JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
GROUP BY t.location
ORDER BY alert_count DESC;

SELECT d.device_id,
       d.device_identifier,
       d.device_type,
       COUNT(fa.alert_id) AS high_risk_alerts
FROM device d
JOIN bank_transaction t ON t.device_id = d.device_id
JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
WHERE fa.risk_level = 'HIGH'
GROUP BY d.device_id, d.device_identifier, d.device_type
HAVING COUNT(fa.alert_id) >= 1
ORDER BY high_risk_alerts DESC;

SELECT c.customer_id,
       c.first_name || ' ' || c.last_name AS customer_name,
       ROUND(AVG(t.amount), 2) AS customer_avg_amount
FROM customer c
JOIN account a ON a.customer_id = c.customer_id
JOIN bank_transaction t ON t.account_id = a.account_id
GROUP BY c.customer_id, c.first_name, c.last_name
HAVING AVG(t.amount) > (SELECT AVG(amount) FROM bank_transaction)
ORDER BY customer_avg_amount DESC;

SELECT txn_date,
       total_transactions,
       total_amount,
       total_amount - LAG(total_amount) OVER (ORDER BY txn_date) AS change_from_prev_day
FROM v_daily_transaction_analytics
ORDER BY txn_date;

SELECT
  CASE WHEN sa.account_id IS NOT NULL THEN 'SAVINGS' ELSE 'CURRENT' END AS account_category,
  COUNT(t.transaction_id) AS num_transactions,
  ROUND(AVG(t.amount), 2) AS avg_amount
FROM bank_transaction t
JOIN account a ON a.account_id = t.account_id
LEFT JOIN savings_account sa ON sa.account_id = a.account_id
GROUP BY CASE WHEN sa.account_id IS NOT NULL THEN 'SAVINGS' ELSE 'CURRENT' END;

SELECT transaction_id,
       account_id,
       amount,
       transaction_type,
       transaction_time,
       RANK() OVER (ORDER BY amount DESC) AS amount_rank
FROM bank_transaction
FETCH FIRST 10 ROWS ONLY;

SELECT status,
       COUNT(*) AS num_alerts,
       ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_total
FROM fraud_alert
GROUP BY status
ORDER BY num_alerts DESC;

SELECT an.analyst_id,
       an.name,
       an.department,
       SUM(CASE WHEN fa.status = 'OPEN' THEN 1 ELSE 0 END) AS open_alerts,
       SUM(CASE WHEN fa.status = 'INVESTIGATING' THEN 1 ELSE 0 END) AS investigating_alerts,
       COUNT(fa.alert_id) AS total_assigned
FROM fraud_analyst an
LEFT JOIN fraud_alert fa ON fa.analyst_id = an.analyst_id
GROUP BY an.analyst_id, an.name, an.department
ORDER BY total_assigned DESC;

SELECT account_id,
       transaction_id,
       transaction_time,
       amount,
       LAG(amount) OVER (
         PARTITION BY account_id
         ORDER BY transaction_time
       ) AS prev_amount,
       amount - LAG(amount) OVER (
         PARTITION BY account_id
         ORDER BY transaction_time
       ) AS amount_jump
FROM bank_transaction
ORDER BY account_id, transaction_time;