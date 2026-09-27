SET SERVEROUTPUT ON;

-- TEST 1: Normal low-value transaction should score LOW and generate no alert

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (2, 2, 2, 900, 'DEBIT', 'Kolkata');

COMMIT;

SELECT transaction_id, amount
FROM bank_transaction
ORDER BY transaction_id DESC
FETCH FIRST 1 ROWS ONLY;

SELECT *
FROM fraud_alert
WHERE transaction_id = (SELECT MAX(transaction_id) FROM bank_transaction);


-- TEST 2: High transaction amount should raise the risk score

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (4, 4, 4, 120000, 'TRANSFER', 'Bengaluru');

COMMIT;

SELECT *
FROM fraud_alert
WHERE transaction_id = (SELECT MAX(transaction_id) FROM bank_transaction);


-- TEST 3: Rapid successive transactions on the same account should raise risk

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (6, 1, 6, 3000, 'DEBIT', 'Nagpur');

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (6, 3, 6, 2800, 'DEBIT', 'Nagpur');

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (6, 6, 6, 4100, 'DEBIT', 'Nagpur');

COMMIT;

SELECT transaction_id, risk_score, risk_level, reason
FROM fraud_alert
WHERE transaction_id IN (
  SELECT transaction_id
  FROM bank_transaction
  WHERE account_id = 6
)
ORDER BY transaction_id DESC;


-- TEST 4: Transaction from a device never used on this account before

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (7, 1, 9, 5000, 'DEBIT', 'Chandigarh');

COMMIT;

SELECT *
FROM fraud_alert
WHERE transaction_id = (SELECT MAX(transaction_id) FROM bank_transaction);


-- TEST 5: Transaction from a location not among the customer's registered addresses

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (8, 8, 12, 2000, 'DEBIT', 'Lagos');

COMMIT;

SELECT *
FROM fraud_alert
WHERE transaction_id = (SELECT MAX(transaction_id) FROM bank_transaction);


-- TEST 6: Multiple risk factors together should push score into HIGH and auto-flag the transaction

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (9, 5, 12, 250000, 'TRANSFER', 'Lagos');

COMMIT;

SELECT transaction_id, status
FROM bank_transaction
ORDER BY transaction_id DESC
FETCH FIRST 1 ROWS ONLY;

SELECT *
FROM fraud_alert
WHERE transaction_id = (SELECT MAX(transaction_id) FROM bank_transaction);


-- TEST 7: Transaction on a closed account must be rejected by the validation trigger

UPDATE account
SET status = 'CLOSED'
WHERE account_id = 10;

COMMIT;

BEGIN
  INSERT INTO bank_transaction (account_id, merchant_id, amount, transaction_type, location)
  VALUES (10, 1, 500, 'DEBIT', 'Jaipur');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('TEST 7 EXPECTED REJECTION: ' || SQLERRM);
END;
/

UPDATE account
SET status = 'ACTIVE'
WHERE account_id = 10;

COMMIT;


-- TEST 8: Transaction amount above the absolute maximum limit must be rejected

BEGIN
  INSERT INTO bank_transaction (account_id, merchant_id, amount, transaction_type, location)
  VALUES (12, 1, 50000000, 'TRANSFER', 'New Delhi');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('TEST 8 EXPECTED REJECTION: ' || SQLERRM);
END;
/


-- TEST 9: Confirm the compound trigger fired automatically with no manual DETECT_FRAUD call

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (13, 5, 11, 300000, 'TRANSFER', 'Unknown');

COMMIT;

SELECT COUNT(*) AS auto_generated_alert
FROM fraud_alert
WHERE transaction_id = (SELECT MAX(transaction_id) FROM bank_transaction);


-- TEST 10: Cursor-based review moves OPEN high-risk alerts to INVESTIGATING

EXEC review_high_risk_alerts;

SELECT alert_id, risk_level, status
FROM fraud_alert
WHERE risk_level = 'HIGH';


-- TEST 11: Package wrapper returns identical results to the standalone functions

SELECT calculate_risk(3) AS direct_call,
       pkg_fraud_detection.get_risk_score(3) AS package_call
FROM DUAL;


-- TEST 12: CLASSIFY_RISK boundary values

SELECT classify_risk(0) AS score_0,
       classify_risk(39) AS score_39,
       classify_risk(40) AS score_40,
       classify_risk(69) AS score_69,
       classify_risk(70) AS score_70,
       classify_risk(100) AS score_100
FROM DUAL;


-- TEST 13: Constraint violations are correctly blocked

BEGIN
  INSERT INTO account (customer_id, account_number, balance)
  VALUES (1, 'AC1000001', 1000);
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE(
      'TEST 13a EXPECTED (duplicate account_number): ' || SQLERRM
    );
END;
/

BEGIN
  INSERT INTO bank_transaction (account_id, merchant_id, amount, transaction_type, location)
  VALUES (1, 1, -500, 'DEBIT', 'Mumbai');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE(
      'TEST 13b EXPECTED (negative amount): ' || SQLERRM
    );
END;
/


-- TEST 14: Transaction atomicity - a partial failure must not leave partial data behind

SAVEPOINT before_test_14;

UPDATE account
SET balance = balance - 5000
WHERE account_id = 1;

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (1, 1, 1, 5000, 'DEBIT', 'Mumbai');

SELECT balance
FROM account
WHERE account_id = 1;

ROLLBACK TO before_test_14;

SELECT balance
FROM account
WHERE account_id = 1;


-- TEST 15: Full ROLLBACK demonstration - confirms no permanent change to seed data

SELECT COUNT(*) AS txn_count_before
FROM bank_transaction;

INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, location)
VALUES (1, 1, 1, 999999, 'DEBIT', 'TestOnly');

SELECT COUNT(*) AS txn_count_after_insert
FROM bank_transaction;

ROLLBACK;

SELECT COUNT(*) AS txn_count_after_rollback
FROM bank_transaction;