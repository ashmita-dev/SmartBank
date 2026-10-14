-- SmartBank - Day 4 integration test (originally day4_test.sql)
-- Exercises TRG_FRAUD_MONITOR, TRG_VALIDATE_TRANSACTION, the cursor review
-- procedure and PKG_FRAUD_DETECTION. NOTE: inserts test transactions and
-- temporarily closes/reopens account 20. Run as SMARTBANK_USER.

SET SERVEROUTPUT ON;

INSERT INTO bank_transaction (
  account_id,
  merchant_id,
  device_id,
  amount,
  transaction_type,
  location
)
VALUES (
  5,
  8,
  12,
  350000,
  'TRANSFER',
  'Lagos'
);

COMMIT;

SELECT transaction_id,
       amount,
       status
FROM bank_transaction
ORDER BY transaction_id DESC
FETCH FIRST 1 ROWS ONLY;

SELECT alert_id,
       transaction_id,
       risk_score,
       risk_level,
       reason,
       status
FROM fraud_alert
WHERE transaction_id = (
  SELECT MAX(transaction_id)
  FROM bank_transaction
);

UPDATE account
SET status = 'CLOSED'
WHERE account_id = 20;

COMMIT;

INSERT INTO bank_transaction (
  account_id,
  merchant_id,
  amount,
  transaction_type,
  location
)
VALUES (
  20,
  1,
  500,
  'DEBIT',
  'Bengaluru'
);

UPDATE account
SET status = 'ACTIVE'
WHERE account_id = 20;

COMMIT;

EXEC review_high_risk_alerts;

SELECT alert_id,
       risk_level,
       status
FROM fraud_alert
WHERE risk_level = 'HIGH';

SELECT pkg_fraud_detection.get_risk_score(3) AS pkg_score
FROM DUAL;

BEGIN
  pkg_fraud_detection.run_fraud_check(3);
END;
/