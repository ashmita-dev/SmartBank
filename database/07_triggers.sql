CREATE OR REPLACE TRIGGER trg_validate_transaction
BEFORE INSERT ON bank_transaction
FOR EACH ROW
DECLARE
  v_status account.status%TYPE;
BEGIN
  SELECT status
  INTO v_status
  FROM account
  WHERE account_id = :NEW.account_id;

  IF v_status != 'ACTIVE' THEN
    RAISE_APPLICATION_ERROR(
      -20010,
      'Cannot process transaction: account ' || :NEW.account_id || ' is ' || v_status
    );
  END IF;

  IF :NEW.amount > 10000000 THEN
    RAISE_APPLICATION_ERROR(
      -20011,
      'Transaction amount exceeds maximum allowed limit'
    );
  END IF;

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(
      -20012,
      'Cannot process transaction: account ' || :NEW.account_id || ' does not exist'
    );
END;
/

CREATE OR REPLACE TRIGGER trg_fraud_monitor
FOR INSERT ON bank_transaction
COMPOUND TRIGGER

  TYPE t_id_list IS TABLE OF bank_transaction.transaction_id%TYPE;
  g_new_ids t_id_list := t_id_list();

  AFTER EACH ROW IS
  BEGIN
    g_new_ids.EXTEND;
    g_new_ids(g_new_ids.COUNT) := :NEW.transaction_id;
  END AFTER EACH ROW;

  AFTER STATEMENT IS
  BEGIN
    FOR i IN 1 .. g_new_ids.COUNT LOOP
      detect_fraud(g_new_ids(i));
    END LOOP;
  END AFTER STATEMENT;

END trg_fraud_monitor;
/