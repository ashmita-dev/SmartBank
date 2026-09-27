CREATE OR REPLACE FUNCTION calculate_risk(p_transaction_id IN NUMBER)
RETURN NUMBER
IS
  v_amount bank_transaction.amount%TYPE;
  v_account_id bank_transaction.account_id%TYPE;
  v_device_id bank_transaction.device_id%TYPE;
  v_location bank_transaction.location%TYPE;
  v_txn_time bank_transaction.transaction_time%TYPE;
  v_score NUMBER := 0;
  v_recent_count NUMBER := 0;
  v_device_seen NUMBER := 0;
  v_location_match NUMBER := 0;
BEGIN
  SELECT amount, account_id, device_id, location, transaction_time
  INTO v_amount, v_account_id, v_device_id, v_location, v_txn_time
  FROM bank_transaction
  WHERE transaction_id = p_transaction_id;

  IF v_amount > 100000 THEN
    v_score := v_score + 40;
  ELSIF v_amount > 50000 THEN
    v_score := v_score + 25;
  ELSIF v_amount > 20000 THEN
    v_score := v_score + 10;
  END IF;

  SELECT COUNT(*)
  INTO v_recent_count
  FROM bank_transaction
  WHERE account_id = v_account_id
    AND transaction_id != p_transaction_id
    AND transaction_time BETWEEN v_txn_time - (10/1440) AND v_txn_time;

  IF v_recent_count >= 2 THEN
    v_score := v_score + 25;
  ELSIF v_recent_count = 1 THEN
    v_score := v_score + 15;
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
      v_score := v_score + 20;
    END IF;
  END IF;

  IF v_location IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_location_match
    FROM customer_address ca
    JOIN account a ON a.customer_id = ca.customer_id
    WHERE a.account_id = v_account_id
      AND UPPER(ca.city) = UPPER(v_location);

    IF v_location_match = 0 THEN
      v_score := v_score + 20;
    END IF;
  END IF;

  RETURN LEAST(v_score, 100);

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20001, 'CALCULATE_RISK: Transaction ID ' || p_transaction_id || ' not found');
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(-20099, 'CALCULATE_RISK: Unexpected error - ' || SQLERRM);
END;
/

CREATE OR REPLACE FUNCTION classify_risk(p_score IN NUMBER)
RETURN VARCHAR2
IS
BEGIN
  IF p_score IS NULL THEN
    RAISE_APPLICATION_ERROR(-20002, 'CLASSIFY_RISK: Score cannot be NULL');
  ELSIF p_score < 0 OR p_score > 100 THEN
    RAISE_APPLICATION_ERROR(-20003, 'CLASSIFY_RISK: Score must be between 0 and 100');
  ELSIF p_score >= 70 THEN
    RETURN 'HIGH';
  ELSIF p_score >= 40 THEN
    RETURN 'MEDIUM';
  ELSE
    RETURN 'LOW';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(-20099, 'CLASSIFY_RISK: Unexpected error - ' || SQLERRM);
END;
/