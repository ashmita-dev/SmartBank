-- SmartBank - Day 5 index verification (originally day5_test.sql)
-- Read-only: EXPLAIN PLAN for queries covered by 11_indexes.sql.

EXPLAIN PLAN FOR
SELECT *
FROM bank_transaction
WHERE account_id = 5;

SELECT *
FROM TABLE(DBMS_XPLAN.DISPLAY);

EXPLAIN PLAN FOR
SELECT *
FROM fraud_alert
WHERE risk_level = 'HIGH'
  AND status = 'OPEN';

SELECT *
FROM TABLE(DBMS_XPLAN.DISPLAY);
