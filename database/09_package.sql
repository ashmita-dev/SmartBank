CREATE OR REPLACE PACKAGE pkg_fraud_detection AS

  FUNCTION get_risk_score(
    p_transaction_id IN NUMBER
  ) RETURN NUMBER;

  FUNCTION get_risk_level(
    p_score IN NUMBER
  ) RETURN VARCHAR2;

  PROCEDURE run_fraud_check(
    p_transaction_id IN NUMBER
  );

  PROCEDURE review_high_risk;

END pkg_fraud_detection;
/

CREATE OR REPLACE PACKAGE BODY pkg_fraud_detection AS

  FUNCTION get_risk_score(
    p_transaction_id IN NUMBER
  ) RETURN NUMBER
  IS
  BEGIN
    RETURN calculate_risk(p_transaction_id);
  END get_risk_score;

  FUNCTION get_risk_level(
    p_score IN NUMBER
  ) RETURN VARCHAR2
  IS
  BEGIN
    RETURN classify_risk(p_score);
  END get_risk_level;

  PROCEDURE run_fraud_check(
    p_transaction_id IN NUMBER
  )
  IS
  BEGIN
    detect_fraud(p_transaction_id);
  END run_fraud_check;

  PROCEDURE review_high_risk
  IS
  BEGIN
    review_high_risk_alerts;
  END review_high_risk;

END pkg_fraud_detection;
/