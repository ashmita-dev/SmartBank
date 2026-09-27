SELECT COUNT(*) AS total_customers FROM customer;

SELECT COUNT(*) AS total_individual FROM individual_customer;

SELECT COUNT(*) AS total_business FROM business_customer;

SELECT COUNT(*) AS total_accounts FROM account;

SELECT COUNT(*) AS total_savings FROM savings_account;

SELECT COUNT(*) AS total_current FROM current_account;

SELECT COUNT(*) AS total_transactions FROM bank_transaction;

SELECT COUNT(*) AS total_merchants FROM merchant;

SELECT COUNT(*) AS total_devices FROM device;


SELECT c.customer_id,
       c.first_name,
       c.last_name,
       CASE
         WHEN ic.customer_id IS NOT NULL THEN 'INDIVIDUAL'
         WHEN bc.customer_id IS NOT NULL THEN 'BUSINESS'
         ELSE 'MISSING_SUBTYPE'
       END AS customer_category
FROM customer c
LEFT JOIN individual_customer ic
  ON ic.customer_id = c.customer_id
LEFT JOIN business_customer bc
  ON bc.customer_id = c.customer_id
ORDER BY c.customer_id;


SELECT a.account_id,
       a.account_number,
       a.balance,
       CASE
         WHEN sa.account_id IS NOT NULL THEN 'SAVINGS'
         WHEN ca.account_id IS NOT NULL THEN 'CURRENT'
         ELSE 'MISSING_SUBTYPE'
       END AS account_category
FROM account a
LEFT JOIN savings_account sa
  ON sa.account_id = a.account_id
LEFT JOIN current_account ca
  ON ca.account_id = a.account_id
ORDER BY a.account_id;


SELECT t.transaction_id,
       a.account_number,
       m.merchant_name,
       d.device_type,
       t.amount,
       t.transaction_type,
       t.transaction_time,
       t.location
FROM bank_transaction t
JOIN account a
  ON a.account_id = t.account_id
LEFT JOIN merchant m
  ON m.merchant_id = t.merchant_id
LEFT JOIN device d
  ON d.device_id = t.device_id
ORDER BY t.transaction_time DESC
FETCH FIRST 10 ROWS ONLY;


SELECT c.customer_id,
       c.first_name,
       c.last_name,
       COUNT(a.account_id) AS num_accounts,
       SUM(a.balance) AS total_balance
FROM customer c
JOIN account a
  ON a.customer_id = c.customer_id
GROUP BY c.customer_id,
         c.first_name,
         c.last_name
HAVING COUNT(a.account_id) > 1
ORDER BY total_balance DESC;

SELECT COUNT(*) AS total_transactions
FROM bank_transaction;
