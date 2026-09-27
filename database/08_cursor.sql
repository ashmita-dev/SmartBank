CREATE OR REPLACE PROCEDURE review_high_risk_alerts
IS
  CURSOR c_high_risk IS
    SELECT fa.alert_id,
           fa.transaction_id,
           fa.risk_score,
           fa.status,
           an.name AS analyst_name
    FROM fraud_alert fa
    LEFT JOIN fraud_analyst an
      ON an.analyst_id = fa.analyst_id
    WHERE fa.risk_level = 'HIGH'
      AND fa.status = 'OPEN'
    FOR UPDATE OF fa.status;

  v_count NUMBER := 0;

BEGIN
  FOR rec IN c_high_risk LOOP

    UPDATE fraud_alert
    SET status = 'INVESTIGATING'
    WHERE CURRENT OF c_high_risk;

    DBMS_OUTPUT.PUT_LINE(
      'Alert ' || rec.alert_id ||
      ' (Txn ' || rec.transaction_id ||
      ', Score ' || rec.risk_score ||
      ') assigned to ' ||
      NVL(rec.analyst_name, 'UNASSIGNED') ||
      ' -> moved to INVESTIGATING'
    );

    v_count := v_count + 1;

  END LOOP;

  DBMS_OUTPUT.PUT_LINE(
    v_count || ' high-risk alerts moved to INVESTIGATING'
  );

  COMMIT;

EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE_APPLICATION_ERROR(
      -20099,
      'REVIEW_HIGH_RISK_ALERTS: Unexpected error - ' || SQLERRM
    );
END;
/