CREATE OR REPLACE PROCEDURE generate_alert(
  p_transaction_id IN NUMBER,
  p_score IN NUMBER,
  p_level IN VARCHAR2,
  p_reason IN VARCHAR2
)
IS
  v_analyst_id NUMBER;
BEGIN
  BEGIN
    SELECT analyst_id INTO v_analyst_id
    FROM (
      SELECT fa.analyst_id, COUNT(al.alert_id) AS open_count
      FROM fraud_analyst fa
      LEFT JOIN fraud_alert al
        ON al.analyst_id = fa.analyst_id
        AND al.status = 'OPEN'
      GROUP BY fa.analyst_id
      ORDER BY open_count ASC
    )
    WHERE ROWNUM = 1;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_analyst_id := NULL;
  END;

  INSERT INTO fraud_alert (
    transaction_id,
    analyst_id,
    risk_score,
    risk_level,
    reason,
    status
  )
  VALUES (
    p_transaction_id,
    v_analyst_id,
    p_score,
    p_level,
    p_reason,
    'OPEN'
  );

EXCEPTION
  WHEN DUP_VAL_ON_INDEX THEN
    NULL;
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(
      -20099,
      'GENERATE_ALERT: Unexpected error - ' || SQLERRM
    );
END;
/

CREATE OR REPLACE PROCEDURE detect_fraud(
  p_transaction_id IN NUMBER
)
IS
  v_score NUMBER;
  v_level VARCHAR2(10);
  v_amount bank_transaction.amount%TYPE;
  v_account_id bank_transaction.account_id%TYPE;
  v_device_id bank_transaction.device_id%TYPE;
  v_location bank_transaction.location%TYPE;
  v_txn_time bank_transaction.transaction_time%TYPE;
  v_reason VARCHAR2(500) := '';
  v_recent_count NUMBER := 0;
  v_device_seen NUMBER := 0;
  v_location_match NUMBER := 0;
BEGIN
  SELECT amount,
         account_id,
         device_id,
         location,
         transaction_time
  INTO v_amount,
       v_account_id,
       v_device_id,
       v_location,
       v_txn_time
  FROM bank_transaction
  WHERE transaction_id = p_transaction_id;

  v_score := calculate_risk(p_transaction_id);
  v_level := classify_risk(v_score);

  IF v_amount > 50000 THEN
    v_reason := v_reason || 'High transaction amount; ';
  END IF;

  SELECT COUNT(*)
  INTO v_recent_count
  FROM bank_transaction
  WHERE account_id = v_account_id
    AND transaction_id != p_transaction_id
    AND transaction_time BETWEEN v_txn_time - (10/1440) AND v_txn_time;

  IF v_recent_count >= 1 THEN
    v_reason := v_reason || 'Multiple transactions in short period; ';
  END IF;

  IF v_device_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_device_seen
    FROM bank_transaction
    WHERE account_id = v_account_id
      AND device_id = v_device_id
      AND transaction_id != p_transaction_id
      AND transaction_time < v_txn_time;

    IF v_device_seen = 0 THEN
      v_reason := v_reason || 'Unrecognized device; ';
    END IF;
  END IF;

  IF v_location IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_location_match
    FROM customer_address ca
    JOIN account a
      ON a.customer_id = ca.customer_id
    WHERE a.account_id = v_account_id
      AND UPPER(ca.city) = UPPER(v_location);

    IF v_location_match = 0 THEN
      v_reason := v_reason || 'Unusual transaction location; ';
    END IF;
  END IF;

  IF v_level IN ('MEDIUM', 'HIGH') THEN
    generate_alert(
      p_transaction_id,
      v_score,
      v_level,
      v_reason
    );

    IF v_level = 'HIGH' THEN
      UPDATE bank_transaction
      SET status = 'FLAGGED'
      WHERE transaction_id = p_transaction_id;
    END IF;
  END IF;

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(
      -20004,
      'DETECT_FRAUD: Transaction ID ' || p_transaction_id || ' not found'
    );
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(
      -20099,
      'DETECT_FRAUD: Unexpected error - ' || SQLERRM
    );
END;
/