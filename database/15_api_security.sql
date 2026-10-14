-- =====================================================================
-- SmartBank - 15_api_security.sql
-- Server-side authentication and the controlled REST API layer.
--
-- Adds three support tables (prefix API_) and PKG_SMARTBANK_API. The 12
-- core tables, their constraints, both triggers and the fraud engine
-- (CALCULATE_RISK, CLASSIFY_RISK, DETECT_FRAUD, GENERATE_ALERT,
-- REVIEW_HIGH_RISK_ALERTS, PKG_FRAUD_DETECTION) are NOT modified.
--
--   API_USER     demo login identities (salted PBKDF2-HMAC-SHA256 hashes;
--                no plaintext password is ever stored)
--   API_SESSION  opaque session tokens (only a SHA-256 of each token is stored)
--   API_EVENT    audit trail of logins and writes, also used for rate limits
--
-- Every ORDS handler in ords_endpoints.sql is a one-line call into
-- PKG_SMARTBANK_API, which checks the session token, enforces the role
-- (CUSTOMER or ANALYST), scopes customer data to the signed-in customer,
-- validates input and writes JSON.
--
-- Requires EXECUTE on SYS.DBMS_CRYPTO (granted by an administrator, see
-- deploy/oci/00_admin_setup.sql or scripts\install-api-security.ps1).
-- Safe to re-run: tables are created only if missing, code is replaced.
-- Run as SMARTBANK_USER.
-- =====================================================================

DECLARE
  PROCEDURE run_if_missing(p_table VARCHAR2, p_ddl VARCHAR2) IS
    l_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO l_count FROM user_tables WHERE table_name = p_table;
    IF l_count = 0 THEN
      EXECUTE IMMEDIATE p_ddl;
    END IF;
  END;
BEGIN
  run_if_missing('API_USER', q'[
    CREATE TABLE api_user (
      user_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email            VARCHAR2(100) NOT NULL,
      display_name     VARCHAR2(100) NOT NULL,
      role             VARCHAR2(10)  NOT NULL,
      customer_id      NUMBER,
      analyst_id       NUMBER,
      password_salt    RAW(16)       NOT NULL,
      password_hash    RAW(32)       NOT NULL,
      hash_iterations  NUMBER(7)     NOT NULL,
      failed_logins    NUMBER(5)     DEFAULT 0 NOT NULL,
      locked_until     TIMESTAMP,
      is_active        CHAR(1)       DEFAULT 'Y' NOT NULL,
      created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT uq_api_user_email UNIQUE (email),
      CONSTRAINT chk_api_user_role CHECK (role IN ('CUSTOMER', 'ANALYST')),
      CONSTRAINT chk_api_user_active CHECK (is_active IN ('Y', 'N')),
      CONSTRAINT chk_api_user_customer CHECK (role <> 'CUSTOMER' OR customer_id IS NOT NULL),
      CONSTRAINT fk_api_user_customer FOREIGN KEY (customer_id) REFERENCES customer (customer_id),
      CONSTRAINT fk_api_user_analyst FOREIGN KEY (analyst_id) REFERENCES fraud_analyst (analyst_id)
    )]');

  run_if_missing('API_SESSION', q'[
    CREATE TABLE api_session (
      token_hash  RAW(32)   PRIMARY KEY,
      user_id     NUMBER    NOT NULL,
      created_at  TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      expires_at  TIMESTAMP NOT NULL,
      revoked     CHAR(1)   DEFAULT 'N' NOT NULL,
      CONSTRAINT fk_api_session_user FOREIGN KEY (user_id) REFERENCES api_user (user_id),
      CONSTRAINT chk_api_session_revoked CHECK (revoked IN ('Y', 'N'))
    )]');

  run_if_missing('API_EVENT', q'[
    CREATE TABLE api_event (
      event_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id         NUMBER,
      event_type      VARCHAR2(30) NOT NULL,
      transaction_id  NUMBER,
      alert_id        NUMBER,
      detail          VARCHAR2(200),
      created_at      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
    )]');
END;
/

DECLARE
  PROCEDURE index_if_missing(p_index VARCHAR2, p_ddl VARCHAR2) IS
    l_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO l_count FROM user_indexes WHERE index_name = p_index;
    IF l_count = 0 THEN
      EXECUTE IMMEDIATE p_ddl;
    END IF;
  END;
BEGIN
  index_if_missing('IDX_API_SESSION_USER', 'CREATE INDEX idx_api_session_user ON api_session (user_id)');
  index_if_missing('IDX_API_EVENT_TYPE_TIME', 'CREATE INDEX idx_api_event_type_time ON api_event (event_type, created_at)');
END;
/

CREATE OR REPLACE PACKAGE pkg_smartbank_api AS

  -- Administration (SQL only; never exposed through REST).
  PROCEDURE upsert_user(
    p_email        IN VARCHAR2,
    p_display_name IN VARCHAR2,
    p_role         IN VARCHAR2,
    p_password     IN VARCHAR2,
    p_customer_id  IN NUMBER DEFAULT NULL,
    p_analyst_id   IN NUMBER DEFAULT NULL
  );

  -- Used inside SQL: converts a database-local TIMESTAMP/DATE into an
  -- ISO-8601 UTC string, so browsers show the correct local time.
  FUNCTION iso_utc(p_value IN TIMESTAMP) RETURN VARCHAR2;

  -- REST handlers. p_token is the X-Session-Token request header.
  PROCEDURE health;
  PROCEDURE auth_login(p_body IN CLOB);
  PROCEDURE auth_logout(p_token IN VARCHAR2);
  PROCEDURE auth_session(p_token IN VARCHAR2);

  PROCEDURE get_kpis(p_token IN VARCHAR2);
  PROCEDURE get_risk_distribution(p_token IN VARCHAR2);
  PROCEDURE get_daily_analytics(p_token IN VARCHAR2);
  PROCEDURE get_analyst_workload(p_token IN VARCHAR2);

  PROCEDURE get_transactions(p_token IN VARCHAR2, p_search IN VARCHAR2);
  PROCEDURE create_transaction(p_token IN VARCHAR2, p_body IN CLOB);

  PROCEDURE get_alerts(p_token IN VARCHAR2, p_risk_level IN VARCHAR2);
  PROCEDURE get_alert(p_token IN VARCHAR2, p_id IN VARCHAR2);
  PROCEDURE update_alert(p_token IN VARCHAR2, p_id IN VARCHAR2, p_body IN CLOB);

  PROCEDURE get_accounts(p_token IN VARCHAR2, p_customer_id IN VARCHAR2);
  PROCEDURE get_merchants(p_token IN VARCHAR2);
  PROCEDURE get_devices(p_token IN VARCHAR2, p_customer_id IN VARCHAR2);
  PROCEDURE get_customer(p_token IN VARCHAR2, p_id IN VARCHAR2);

END pkg_smartbank_api;
/

CREATE OR REPLACE PACKAGE BODY pkg_smartbank_api AS

  c_iterations      CONSTANT PLS_INTEGER := 20000;
  c_session_hours   CONSTANT PLS_INTEGER := 8;
  c_max_rows        CONSTANT PLS_INTEGER := 1000;
  c_max_amount      CONSTANT NUMBER      := 10000000;  -- TRG_VALIDATE_TRANSACTION limit

  -- Abuse limits for the public demo.
  c_lock_after_failures CONSTANT PLS_INTEGER := 10;
  c_lock_minutes        CONSTANT PLS_INTEGER := 5;
  c_txn_per_user_10min  CONSTANT PLS_INTEGER := 20;
  c_txn_global_24h      CONSTANT PLS_INTEGER := 500;
  c_alert_updates_10min CONSTANT PLS_INTEGER := 60;

  -- Error codes raised by this package and mapped to HTTP statuses.
  e_bad_request  CONSTANT PLS_INTEGER := -20900;
  e_unauthorized CONSTANT PLS_INTEGER := -20901;
  e_forbidden    CONSTANT PLS_INTEGER := -20903;
  e_not_found    CONSTANT PLS_INTEGER := -20904;
  e_too_many     CONSTANT PLS_INTEGER := -20929;

  TYPE t_session IS RECORD (
    user_id      api_user.user_id%TYPE,
    email        api_user.email%TYPE,
    display_name api_user.display_name%TYPE,
    role         api_user.role%TYPE,
    customer_id  api_user.customer_id%TYPE,
    analyst_id   api_user.analyst_id%TYPE,
    expires_at   api_session.expires_at%TYPE
  );

  -- -------------------------------------------------------------------
  -- Helpers
  -- -------------------------------------------------------------------
  PROCEDURE fail(p_code PLS_INTEGER, p_message VARCHAR2) IS
  BEGIN
    RAISE_APPLICATION_ERROR(p_code, p_message);
  END;

  FUNCTION iso_utc(p_value IN TIMESTAMP) RETURN VARCHAR2 IS
  BEGIN
    IF p_value IS NULL THEN
      RETURN NULL;
    END IF;
    -- Rows are written with SYSTIMESTAMP/SYSDATE, i.e. in the database
    -- server's time zone; attach that zone, then express it in UTC.
    RETURN TO_CHAR(
      SYS_EXTRACT_UTC(FROM_TZ(p_value, TO_CHAR(SYSTIMESTAMP, 'TZH:TZM'))),
      'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  END;

  FUNCTION pbkdf2(p_password VARCHAR2, p_salt RAW, p_iterations PLS_INTEGER) RETURN RAW IS
    -- PBKDF2-HMAC-SHA256, one 32-byte block (RFC 8018).
    l_key RAW(2000) := UTL_I18N.STRING_TO_RAW(p_password, 'AL32UTF8');
    l_u   RAW(32);
    l_t   RAW(32);
  BEGIN
    l_u := DBMS_CRYPTO.MAC(UTL_RAW.CONCAT(p_salt, HEXTORAW('00000001')), DBMS_CRYPTO.HMAC_SH256, l_key);
    l_t := l_u;
    FOR i IN 2 .. p_iterations LOOP
      l_u := DBMS_CRYPTO.MAC(l_u, DBMS_CRYPTO.HMAC_SH256, l_key);
      l_t := UTL_RAW.BIT_XOR(l_t, l_u);
    END LOOP;
    RETURN l_t;
  END;

  FUNCTION token_hash(p_token VARCHAR2) RETURN RAW IS
  BEGIN
    RETURN DBMS_CRYPTO.HASH(UTL_I18N.STRING_TO_RAW(LOWER(p_token), 'AL32UTF8'), DBMS_CRYPTO.HASH_SH256);
  END;

  PROCEDURE print_clob(p_text CLOB) IS
    l_len    PLS_INTEGER := NVL(DBMS_LOB.GETLENGTH(p_text), 0);
    l_offset PLS_INTEGER := 1;
    c_chunk  CONSTANT PLS_INTEGER := 8000;
  BEGIN
    WHILE l_offset <= l_len LOOP
      HTP.PRN(DBMS_LOB.SUBSTR(p_text, c_chunk, l_offset));
      l_offset := l_offset + c_chunk;
    END LOOP;
  END;

  PROCEDURE respond(p_status PLS_INTEGER, p_json CLOB) IS
  BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE, 'UTF-8');
    OWA_UTIL.STATUS_LINE(p_status, NULL, FALSE);
    HTP.P('Cache-Control: no-store');
    HTP.P('X-Content-Type-Options: nosniff');
    OWA_UTIL.HTTP_HEADER_CLOSE;
    print_clob(p_json);
  END;

  PROCEDURE respond_items(p_items CLOB) IS
  BEGIN
    respond(200, '{"items":' || NVL(p_items, TO_CLOB('[]')) || '}');
  END;

  PROCEDURE respond_error(p_status PLS_INTEGER, p_message VARCHAR2) IS
    l_out JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    l_out.put('error', p_message);
    respond(p_status, l_out.to_clob);
  END;

  -- Maps any exception to a safe JSON error. Messages from this package and
  -- from the existing validation trigger (ORA-20xxx) are shown to the user;
  -- anything else is reported without internal detail.
  PROCEDURE handle_error IS
    l_code PLS_INTEGER := SQLCODE;
    l_msg  VARCHAR2(4000) := REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: ', '');
  BEGIN
    ROLLBACK;
    l_msg := REGEXP_REPLACE(l_msg, CHR(10) || '.*$', '', 1, 0, 'n');
    IF l_code = e_unauthorized THEN
      respond_error(401, l_msg);
    ELSIF l_code = e_forbidden THEN
      respond_error(403, l_msg);
    ELSIF l_code = e_not_found THEN
      respond_error(404, l_msg);
    ELSIF l_code = e_too_many THEN
      respond_error(429, l_msg);
    ELSIF l_code = -20099 THEN
      -- Unexpected failure inside the fraud engine.
      respond_error(500, 'The fraud engine could not evaluate the transaction. Nothing was saved.');
    ELSIF l_code BETWEEN -20999 AND -20000 THEN
      respond_error(400, l_msg);
    ELSIF l_code = -2291 THEN
      respond_error(400, 'A referenced record does not exist.');
    ELSIF l_code = -2290 THEN
      respond_error(400, 'The request violates a database rule (' || REGEXP_SUBSTR(l_msg, '\(([^)]+)\)', 1, 1, NULL, 1) || ').');
    ELSE
      respond_error(500, 'Unexpected database error (ORA' || TO_CHAR(l_code, 'S00000') || '). Nothing was saved.');
    END IF;
  END;

  PROCEDURE log_event(p_user_id NUMBER, p_type VARCHAR2, p_txn NUMBER DEFAULT NULL,
                      p_alert NUMBER DEFAULT NULL, p_detail VARCHAR2 DEFAULT NULL) IS
  BEGIN
    INSERT INTO api_event (user_id, event_type, transaction_id, alert_id, detail)
    VALUES (p_user_id, p_type, p_txn, p_alert, SUBSTR(p_detail, 1, 200));
  END;

  FUNCTION parse_body(p_body CLOB) RETURN JSON_OBJECT_T IS
    l_obj JSON_OBJECT_T;
  BEGIN
    IF p_body IS NULL OR DBMS_LOB.GETLENGTH(p_body) = 0 THEN
      fail(e_bad_request, 'The request body must be a JSON object.');
    END IF;
    IF DBMS_LOB.GETLENGTH(p_body) > 4000 THEN
      fail(e_bad_request, 'The request body is too large.');
    END IF;
    BEGIN
      l_obj := JSON_OBJECT_T.parse(p_body);
    EXCEPTION
      WHEN OTHERS THEN
        fail(e_bad_request, 'The request body must be a JSON object.');
    END;
    RETURN l_obj;
  END;

  FUNCTION str_field(p_obj JSON_OBJECT_T, p_name VARCHAR2, p_max PLS_INTEGER) RETURN VARCHAR2 IS
    l_el JSON_ELEMENT_T := p_obj.get(p_name);
    l_v  VARCHAR2(32767);
  BEGIN
    IF l_el IS NULL OR l_el.is_null THEN
      RETURN NULL;
    END IF;
    IF NOT l_el.is_string THEN
      fail(e_bad_request, p_name || ' must be a string.');
    END IF;
    l_v := TRIM(p_obj.get_string(p_name));
    IF LENGTH(l_v) > p_max THEN
      fail(e_bad_request, p_name || ' must be at most ' || p_max || ' characters.');
    END IF;
    RETURN l_v;
  END;

  FUNCTION num_field(p_obj JSON_OBJECT_T, p_name VARCHAR2) RETURN NUMBER IS
    l_el JSON_ELEMENT_T := p_obj.get(p_name);
  BEGIN
    IF l_el IS NULL OR l_el.is_null THEN
      RETURN NULL;
    END IF;
    IF NOT l_el.is_number THEN
      fail(e_bad_request, p_name || ' must be a number.');
    END IF;
    RETURN p_obj.get_number(p_name);
  END;

  FUNCTION id_field(p_obj JSON_OBJECT_T, p_name VARCHAR2) RETURN NUMBER IS
    l_v NUMBER := num_field(p_obj, p_name);
  BEGIN
    IF l_v IS NULL THEN
      fail(e_bad_request, p_name || ' is required.');
    END IF;
    IF l_v <> TRUNC(l_v) OR l_v < 1 OR l_v > 999999999 THEN
      fail(e_bad_request, p_name || ' must be a positive whole number.');
    END IF;
    RETURN l_v;
  END;

  FUNCTION to_id(p_value VARCHAR2, p_name VARCHAR2) RETURN NUMBER IS
  BEGIN
    IF p_value IS NULL THEN
      RETURN NULL;
    END IF;
    IF NOT REGEXP_LIKE(p_value, '^[0-9]{1,9}$') THEN
      fail(e_bad_request, p_name || ' must be a positive whole number.');
    END IF;
    RETURN TO_NUMBER(p_value);
  END;

  -- Validates the X-Session-Token header and (optionally) the role.
  FUNCTION require_session(p_token VARCHAR2, p_role VARCHAR2 DEFAULT NULL) RETURN t_session IS
    l_s    t_session;
    l_hash RAW(32);
  BEGIN
    IF p_token IS NULL OR NOT REGEXP_LIKE(p_token, '^[0-9A-Fa-f]{64}$') THEN
      fail(e_unauthorized, 'Sign in to use the SmartBank API.');
    END IF;
    l_hash := token_hash(p_token);

    BEGIN
      SELECT u.user_id, u.email, u.display_name, u.role, u.customer_id, u.analyst_id, s.expires_at
      INTO l_s
      FROM api_session s
      JOIN api_user u ON u.user_id = s.user_id
      WHERE s.token_hash = l_hash
        AND s.revoked = 'N'
        AND s.expires_at > SYSTIMESTAMP
        AND u.is_active = 'Y';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        fail(e_unauthorized, 'Your session has expired. Please sign in again.');
    END;

    IF p_role IS NOT NULL AND l_s.role <> p_role THEN
      fail(e_forbidden, CASE p_role
                          WHEN 'ANALYST' THEN 'This action requires a fraud analyst account.'
                          ELSE 'This action requires a customer account.'
                        END);
    END IF;

    RETURN l_s;
  END;

  FUNCTION recent_events(p_type VARCHAR2, p_user_id NUMBER, p_minutes NUMBER) RETURN NUMBER IS
    l_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO l_count
    FROM api_event
    WHERE event_type = p_type
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at > SYSTIMESTAMP - NUMTODSINTERVAL(p_minutes, 'MINUTE');
    RETURN l_count;
  END;

  FUNCTION session_json(p_s t_session, p_token VARCHAR2 DEFAULT NULL) RETURN CLOB IS
    l_out  JSON_OBJECT_T := JSON_OBJECT_T();
    l_user JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    IF p_token IS NOT NULL THEN
      l_out.put('token', p_token);
    END IF;
    l_out.put('expires_at', iso_utc(p_s.expires_at));
    l_user.put('email', p_s.email);
    l_user.put('display_name', p_s.display_name);
    l_user.put('role', LOWER(p_s.role));
    IF p_s.customer_id IS NOT NULL THEN
      l_user.put('customer_id', p_s.customer_id);
    ELSE
      l_user.put_null('customer_id');
    END IF;
    l_out.put('user', l_user);
    RETURN l_out.to_clob;
  END;

  -- One alert as JSON (used by GET/PUT /alerts/:id), scoped to a customer
  -- when p_customer_id is given.
  FUNCTION alert_json(p_id NUMBER, p_customer_id NUMBER) RETURN CLOB IS
    l_json CLOB;
  BEGIN
    SELECT JSON_OBJECT(
             'alert_id' VALUE fa.alert_id,
             'transaction_id' VALUE fa.transaction_id,
             'analyst_id' VALUE fa.analyst_id,
             'analyst_name' VALUE an.name,
             'analyst_department' VALUE an.department,
             'risk_score' VALUE fa.risk_score,
             'risk_level' VALUE fa.risk_level,
             'reason' VALUE fa.reason,
             'status' VALUE fa.status,
             'created_at' VALUE iso_utc(fa.created_at),
             'account_id' VALUE t.account_id,
             'account_number' VALUE a.account_number,
             'customer_id' VALUE c.customer_id,
             'customer_name' VALUE c.first_name || ' ' || c.last_name,
             'amount' VALUE t.amount,
             'transaction_type' VALUE t.transaction_type,
             'transaction_time' VALUE iso_utc(t.transaction_time),
             'transaction_status' VALUE t.status,
             'location' VALUE t.location,
             'merchant_name' VALUE m.merchant_name,
             'merchant_category' VALUE m.category,
             'device_type' VALUE d.device_type,
             'device_identifier' VALUE d.device_identifier
             RETURNING CLOB)
    INTO l_json
    FROM fraud_alert fa
    JOIN bank_transaction t ON t.transaction_id = fa.transaction_id
    JOIN account a ON a.account_id = t.account_id
    JOIN customer c ON c.customer_id = a.customer_id
    LEFT JOIN fraud_analyst an ON an.analyst_id = fa.analyst_id
    LEFT JOIN merchant m ON m.merchant_id = t.merchant_id
    LEFT JOIN device d ON d.device_id = t.device_id
    WHERE fa.alert_id = p_id
      AND (p_customer_id IS NULL OR c.customer_id = p_customer_id);
    RETURN l_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      fail(e_not_found, 'Fraud alert ' || p_id || ' was not found.');
      RETURN NULL;
  END;

  -- -------------------------------------------------------------------
  -- Administration
  -- -------------------------------------------------------------------
  PROCEDURE upsert_user(
    p_email        IN VARCHAR2,
    p_display_name IN VARCHAR2,
    p_role         IN VARCHAR2,
    p_password     IN VARCHAR2,
    p_customer_id  IN NUMBER DEFAULT NULL,
    p_analyst_id   IN NUMBER DEFAULT NULL
  ) IS
    l_salt RAW(16) := DBMS_CRYPTO.RANDOMBYTES(16);
    l_hash RAW(32);
  BEGIN
    IF p_password IS NULL OR LENGTH(p_password) < 8 THEN
      RAISE_APPLICATION_ERROR(-20900, 'Demo passwords must be at least 8 characters.');
    END IF;
    IF UPPER(p_password) LIKE 'REPLACE_WITH%' OR UPPER(p_password) LIKE 'CHOOSE_A%' THEN
      RAISE_APPLICATION_ERROR(-20900, 'Replace the placeholder with a real password before running the script.');
    END IF;
    l_hash := pbkdf2(p_password, l_salt, c_iterations);

    MERGE INTO api_user u
    USING (SELECT LOWER(TRIM(p_email)) AS email FROM dual) src
    ON (u.email = src.email)
    WHEN MATCHED THEN UPDATE SET
      display_name = p_display_name, role = UPPER(p_role),
      customer_id = p_customer_id, analyst_id = p_analyst_id,
      password_salt = l_salt, password_hash = l_hash, hash_iterations = c_iterations,
      failed_logins = 0, locked_until = NULL, is_active = 'Y'
    WHEN NOT MATCHED THEN INSERT
      (email, display_name, role, customer_id, analyst_id, password_salt, password_hash, hash_iterations)
      VALUES (src.email, p_display_name, UPPER(p_role), p_customer_id, p_analyst_id, l_salt, l_hash, c_iterations);

    -- A password change ends that user's existing sessions.
    UPDATE api_session SET revoked = 'Y'
    WHERE user_id = (SELECT user_id FROM api_user WHERE email = LOWER(TRIM(p_email)));
  END;

  -- -------------------------------------------------------------------
  -- Public endpoints
  -- -------------------------------------------------------------------
  PROCEDURE health IS
    l_invalid NUMBER;
    l_out     JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    SELECT COUNT(*) INTO l_invalid
    FROM user_objects
    WHERE object_name IN ('CALCULATE_RISK', 'CLASSIFY_RISK', 'DETECT_FRAUD', 'GENERATE_ALERT',
                          'TRG_VALIDATE_TRANSACTION', 'TRG_FRAUD_MONITOR', 'PKG_SMARTBANK_API')
      AND status <> 'VALID';

    l_out.put('status', CASE WHEN l_invalid = 0 THEN 'ok' ELSE 'degraded' END);
    l_out.put('service', 'smartbank-api');
    l_out.put('database', 'connected');
    l_out.put('fraud_engine', CASE WHEN l_invalid = 0 THEN 'VALID' ELSE 'INVALID OBJECTS: ' || l_invalid END);
    l_out.put('server_time', iso_utc(SYSTIMESTAMP));
    respond(200, l_out.to_clob);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE auth_login(p_body IN CLOB) IS
    l_body     JSON_OBJECT_T;
    l_email    VARCHAR2(100);
    l_password VARCHAR2(200);
    l_user     api_user%ROWTYPE;
    l_found    BOOLEAN := TRUE;
    l_token    VARCHAR2(64);
    l_hash     RAW(32);
    l_s        t_session;
  BEGIN
    l_body := parse_body(p_body);
    l_email := LOWER(str_field(l_body, 'email', 100));
    l_password := str_field(l_body, 'password', 200);

    IF l_email IS NULL OR l_password IS NULL THEN
      fail(e_bad_request, 'Enter your email and password.');
    END IF;

    BEGIN
      SELECT * INTO l_user FROM api_user WHERE email = l_email AND is_active = 'Y' FOR UPDATE;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN l_found := FALSE;
    END;

    IF NOT l_found THEN
      -- Same work as a real check, so response time does not reveal accounts.
      l_user.password_hash := pbkdf2(l_password, DBMS_CRYPTO.RANDOMBYTES(16), c_iterations);
      fail(e_unauthorized, 'Invalid email or password.');
    END IF;

    IF l_user.locked_until > SYSTIMESTAMP THEN
      fail(e_too_many, 'Too many failed sign-in attempts. Try again in a few minutes.');
    END IF;

    IF pbkdf2(l_password, l_user.password_salt, l_user.hash_iterations) <> l_user.password_hash THEN
      UPDATE api_user
      SET failed_logins = CASE WHEN failed_logins + 1 >= c_lock_after_failures THEN 0 ELSE failed_logins + 1 END,
          locked_until = CASE WHEN failed_logins + 1 >= c_lock_after_failures
                              THEN SYSTIMESTAMP + NUMTODSINTERVAL(c_lock_minutes, 'MINUTE') END
      WHERE user_id = l_user.user_id;
      log_event(l_user.user_id, 'LOGIN_FAILED');
      COMMIT;
      fail(e_unauthorized, 'Invalid email or password.');
    END IF;

    UPDATE api_user SET failed_logins = 0, locked_until = NULL WHERE user_id = l_user.user_id;
    -- Housekeeping: forget sessions that ended more than a day ago.
    DELETE FROM api_session WHERE expires_at < SYSTIMESTAMP - INTERVAL '1' DAY;

    l_token := LOWER(RAWTOHEX(DBMS_CRYPTO.RANDOMBYTES(32)));
    l_s.user_id := l_user.user_id;
    l_s.email := l_user.email;
    l_s.display_name := l_user.display_name;
    l_s.role := l_user.role;
    l_s.customer_id := l_user.customer_id;
    l_s.analyst_id := l_user.analyst_id;
    l_s.expires_at := SYSTIMESTAMP + NUMTODSINTERVAL(c_session_hours, 'HOUR');

    l_hash := token_hash(l_token);
    INSERT INTO api_session (token_hash, user_id, expires_at)
    VALUES (l_hash, l_user.user_id, l_s.expires_at);
    log_event(l_user.user_id, 'LOGIN');
    COMMIT;

    respond(200, session_json(l_s, l_token));
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE auth_logout(p_token IN VARCHAR2) IS
    l_hash RAW(32);
  BEGIN
    IF p_token IS NOT NULL AND REGEXP_LIKE(p_token, '^[0-9A-Fa-f]{64}$') THEN
      l_hash := token_hash(p_token);
      UPDATE api_session SET revoked = 'Y' WHERE token_hash = l_hash;
      COMMIT;
    END IF;
    respond(200, '{"signed_out":true}');
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE auth_session(p_token IN VARCHAR2) IS
    l_s t_session;
  BEGIN
    l_s := require_session(p_token);
    respond(200, session_json(l_s));
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  -- -------------------------------------------------------------------
  -- Analyst dashboards
  -- -------------------------------------------------------------------
  PROCEDURE get_kpis(p_token IN VARCHAR2) IS
    l_s    t_session;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token, 'ANALYST');
    SELECT JSON_OBJECT(
             'total_customers' VALUE (SELECT COUNT(*) FROM customer),
             'total_accounts' VALUE (SELECT COUNT(*) FROM account),
             'total_transactions' VALUE (SELECT COUNT(*) FROM bank_transaction),
             'flagged_transactions' VALUE (SELECT COUNT(*) FROM fraud_alert),
             'open_alerts' VALUE (SELECT COUNT(*) FROM fraud_alert WHERE status = 'OPEN'),
             'high_risk_alerts' VALUE (SELECT COUNT(*) FROM fraud_alert WHERE risk_level = 'HIGH')
             RETURNING CLOB)
    INTO l_json FROM dual;
    respond(200, l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_risk_distribution(p_token IN VARCHAR2) IS
    l_s    t_session;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token, 'ANALYST');
    SELECT JSON_ARRAYAGG(JSON_OBJECT('risk_level' VALUE risk_level,
                                     'alert_count' VALUE alert_count,
                                     'average_risk_score' VALUE average_risk_score)
             ORDER BY sort_key RETURNING CLOB)
    INTO l_json
    FROM (SELECT risk_level, COUNT(*) AS alert_count,
                 ROUND(AVG(risk_score), 2) AS average_risk_score,
                 CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END AS sort_key
          FROM fraud_alert
          GROUP BY risk_level);
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_daily_analytics(p_token IN VARCHAR2) IS
    l_s    t_session;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token, 'ANALYST');
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'txn_date' VALUE TO_CHAR(txn_date, 'YYYY-MM-DD'),
             'total_transactions' VALUE total_transactions,
             'total_amount' VALUE total_amount,
             'avg_amount' VALUE avg_amount,
             'high_risk_count' VALUE high_risk_count,
             'medium_risk_count' VALUE medium_risk_count)
             ORDER BY txn_date RETURNING CLOB)
    INTO l_json
    FROM v_daily_transaction_analytics;
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_analyst_workload(p_token IN VARCHAR2) IS
    l_s    t_session;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token, 'ANALYST');
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'analyst_id' VALUE analyst_id, 'name' VALUE name, 'department' VALUE department,
             'open_alerts' VALUE open_alerts, 'investigating_alerts' VALUE investigating_alerts,
             'confirmed_fraud' VALUE confirmed_fraud, 'false_positive' VALUE false_positive,
             'total_assigned' VALUE total_assigned)
             ORDER BY total_assigned DESC, analyst_id RETURNING CLOB)
    INTO l_json
    FROM (SELECT an.analyst_id, an.name, an.department,
                 SUM(CASE WHEN fa.status = 'OPEN' THEN 1 ELSE 0 END) AS open_alerts,
                 SUM(CASE WHEN fa.status = 'INVESTIGATING' THEN 1 ELSE 0 END) AS investigating_alerts,
                 SUM(CASE WHEN fa.status = 'CONFIRMED_FRAUD' THEN 1 ELSE 0 END) AS confirmed_fraud,
                 SUM(CASE WHEN fa.status = 'FALSE_POSITIVE' THEN 1 ELSE 0 END) AS false_positive,
                 COUNT(fa.alert_id) AS total_assigned
          FROM fraud_analyst an
          LEFT JOIN fraud_alert fa ON fa.analyst_id = an.analyst_id
          GROUP BY an.analyst_id, an.name, an.department);
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  -- -------------------------------------------------------------------
  -- Transactions
  -- -------------------------------------------------------------------
  PROCEDURE get_transactions(p_token IN VARCHAR2, p_search IN VARCHAR2) IS
    l_s      t_session;
    l_cust   NUMBER;
    l_search VARCHAR2(100) := UPPER(SUBSTR(TRIM(p_search), 1, 100));
    l_json   CLOB;
  BEGIN
    l_s := require_session(p_token);
    l_cust := CASE WHEN l_s.role = 'CUSTOMER' THEN l_s.customer_id END;
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'transaction_id' VALUE transaction_id, 'account_id' VALUE account_id,
             'account_number' VALUE account_number, 'customer_id' VALUE customer_id,
             'customer_name' VALUE customer_name, 'amount' VALUE amount,
             'transaction_type' VALUE transaction_type,
             'transaction_time' VALUE iso_utc(transaction_time),
             'location' VALUE location, 'transaction_status' VALUE transaction_status,
             'merchant_name' VALUE merchant_name, 'merchant_category' VALUE merchant_category,
             'device_type' VALUE device_type, 'device_identifier' VALUE device_identifier)
             ORDER BY transaction_time DESC, transaction_id DESC RETURNING CLOB)
    INTO l_json
    FROM (SELECT t.transaction_id, t.account_id, a.account_number, c.customer_id,
                 c.first_name || ' ' || c.last_name AS customer_name, t.amount,
                 t.transaction_type, t.transaction_time, t.location,
                 t.status AS transaction_status, m.merchant_name, m.category AS merchant_category,
                 d.device_type, d.device_identifier
          FROM bank_transaction t
          JOIN account a ON a.account_id = t.account_id
          JOIN customer c ON c.customer_id = a.customer_id
          LEFT JOIN merchant m ON m.merchant_id = t.merchant_id
          LEFT JOIN device d ON d.device_id = t.device_id
          WHERE (l_cust IS NULL OR c.customer_id = l_cust)
            AND (l_search IS NULL
                 OR UPPER(a.account_number) LIKE '%' || l_search || '%'
                 OR UPPER(c.first_name || ' ' || c.last_name) LIKE '%' || l_search || '%'
                 OR UPPER(m.merchant_name) LIKE '%' || l_search || '%'
                 OR UPPER(d.device_identifier) LIKE '%' || l_search || '%'
                 OR UPPER(t.location) LIKE '%' || l_search || '%')
          ORDER BY t.transaction_time DESC, t.transaction_id DESC
          FETCH FIRST c_max_rows ROWS ONLY);
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE create_transaction(p_token IN VARCHAR2, p_body IN CLOB) IS
    l_s           t_session;
    l_body        JSON_OBJECT_T;
    l_account_id  NUMBER;
    l_merchant_id NUMBER;
    l_device_id   NUMBER;
    l_amount      NUMBER;
    l_type        VARCHAR2(15);
    l_location    VARCHAR2(200);
    l_owner       NUMBER;
    l_count       NUMBER;
    l_txn_id      NUMBER;
    l_status      bank_transaction.status%TYPE;
    l_time        bank_transaction.transaction_time%TYPE;
    l_score       NUMBER;
    l_level       VARCHAR2(10);
    l_out         JSON_OBJECT_T := JSON_OBJECT_T();
    l_alert       JSON_OBJECT_T;
    l_reasons     JSON_ARRAY_T := JSON_ARRAY_T();
    l_has_alert   BOOLEAN := FALSE;
  BEGIN
    l_s := require_session(p_token, 'CUSTOMER');
    l_body := parse_body(p_body);

    -- 1. Validate input.
    l_account_id := id_field(l_body, 'account_id');
    l_merchant_id := id_field(l_body, 'merchant_id');
    l_device_id := id_field(l_body, 'device_id');
    l_amount := num_field(l_body, 'amount');
    l_type := UPPER(NVL(str_field(l_body, 'transaction_type', 15), 'TRANSFER'));
    l_location := str_field(l_body, 'location', 100);

    IF l_amount IS NULL THEN
      fail(e_bad_request, 'amount is required.');
    ELSIF l_amount <= 0 THEN
      fail(e_bad_request, 'amount must be greater than zero.');
    ELSIF l_amount > c_max_amount THEN
      fail(e_bad_request, 'amount cannot exceed 10,000,000.');
    ELSIF l_amount <> ROUND(l_amount, 2) THEN
      fail(e_bad_request, 'amount can have at most two decimal places.');
    END IF;

    IF l_type NOT IN ('DEBIT', 'CREDIT', 'TRANSFER', 'WITHDRAWAL', 'DEPOSIT') THEN
      fail(e_bad_request, 'transaction_type must be one of DEBIT, CREDIT, TRANSFER, WITHDRAWAL, DEPOSIT.');
    END IF;

    IF l_location IS NULL OR LENGTH(l_location) < 2 THEN
      fail(e_bad_request, 'location is required (a city name).');
    ELSIF NOT REGEXP_LIKE(l_location, '^[[:alpha:]][[:alpha:] .,''()-]*$') THEN
      fail(e_bad_request, 'location may contain only letters, spaces and . , '' ( ) -');
    END IF;

    -- 2. Verify referenced entities. A customer may only use their own accounts.
    BEGIN
      SELECT customer_id INTO l_owner FROM account WHERE account_id = l_account_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN l_owner := NULL;
    END;
    IF l_owner IS NULL OR l_owner <> l_s.customer_id THEN
      fail(e_not_found, 'Account ' || l_account_id || ' was not found among your accounts.');
    END IF;

    SELECT COUNT(*) INTO l_count FROM merchant WHERE merchant_id = l_merchant_id;
    IF l_count = 0 THEN
      fail(e_bad_request, 'Merchant ' || l_merchant_id || ' does not exist.');
    END IF;

    SELECT COUNT(*) INTO l_count FROM device WHERE device_id = l_device_id;
    IF l_count = 0 THEN
      fail(e_bad_request, 'Device ' || l_device_id || ' does not exist.');
    END IF;

    -- 3. Abuse limits for the public demo.
    IF recent_events('TRANSACTION_CREATED', l_s.user_id, 10) >= c_txn_per_user_10min THEN
      fail(e_too_many, 'Transaction limit reached for this demo account. Please wait a few minutes.');
    END IF;
    IF recent_events('TRANSACTION_CREATED', NULL, 1440) >= c_txn_global_24h THEN
      fail(e_too_many, 'The daily demo transaction limit has been reached. Please try again tomorrow.');
    END IF;

    -- 4. Insert. TRG_VALIDATE_TRANSACTION checks the account status and the
    -- amount limit; TRG_FRAUD_MONITOR then runs DETECT_FRAUD exactly once for
    -- this row (AFTER STATEMENT). This package never calls DETECT_FRAUD itself.
    INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount,
                                  transaction_type, transaction_time, location, status)
    VALUES (l_account_id, l_merchant_id, l_device_id, l_amount,
            l_type, SYSTIMESTAMP, l_location, 'COMPLETED')
    RETURNING transaction_id INTO l_txn_id;

    -- 5. Read back what the fraud engine decided.
    SELECT status, transaction_time INTO l_status, l_time
    FROM bank_transaction WHERE transaction_id = l_txn_id;

    FOR a IN (SELECT alert_id, risk_score, risk_level, reason, status, analyst_id
              FROM fraud_alert WHERE transaction_id = l_txn_id) LOOP
      l_has_alert := TRUE;
      l_score := a.risk_score;
      l_level := a.risk_level;
      l_alert := JSON_OBJECT_T();
      l_alert.put('alert_id', a.alert_id);
      l_alert.put('risk_score', a.risk_score);
      l_alert.put('risk_level', a.risk_level);
      l_alert.put('reason', a.reason);
      l_alert.put('status', a.status);
      IF a.analyst_id IS NOT NULL THEN
        l_alert.put('analyst_id', a.analyst_id);
      END IF;
      FOR r IN (SELECT TRIM(REGEXP_SUBSTR(a.reason, '[^;]+', 1, LEVEL)) AS txt
                FROM dual
                CONNECT BY REGEXP_SUBSTR(a.reason, '[^;]+', 1, LEVEL) IS NOT NULL) LOOP
        IF r.txt IS NOT NULL THEN
          l_reasons.append(r.txt);
        END IF;
      END LOOP;
    END LOOP;

    IF NOT l_has_alert THEN
      -- LOW risk: DETECT_FRAUD stores nothing for it, so report the score from
      -- the same read-only scoring functions it used (no side effects).
      l_score := calculate_risk(l_txn_id);
      l_level := classify_risk(l_score);
    END IF;

    log_event(l_s.user_id, 'TRANSACTION_CREATED', l_txn_id,
              CASE WHEN l_has_alert THEN l_alert.get_number('alert_id') END,
              l_level || ' ' || l_score);
    COMMIT;

    l_out.put('transaction_id', l_txn_id);
    l_out.put('transaction_status', l_status);
    l_out.put('transaction_time', iso_utc(l_time));
    l_out.put('account_id', l_account_id);
    l_out.put('amount', l_amount);
    l_out.put('transaction_type', l_type);
    l_out.put('location', l_location);
    l_out.put('risk_score', l_score);
    l_out.put('risk_level', l_level);
    l_out.put('score_source', CASE WHEN l_has_alert THEN 'FRAUD_ALERT' ELSE 'CALCULATE_RISK' END);
    l_out.put('reasons', l_reasons);
    IF l_has_alert THEN
      l_out.put('alert', l_alert);
    ELSE
      l_out.put_null('alert');
    END IF;
    respond(201, l_out.to_clob);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  -- -------------------------------------------------------------------
  -- Alerts
  -- -------------------------------------------------------------------
  PROCEDURE get_alerts(p_token IN VARCHAR2, p_risk_level IN VARCHAR2) IS
    l_s     t_session;
    l_cust  NUMBER;
    l_level VARCHAR2(10) := UPPER(TRIM(p_risk_level));
    l_json  CLOB;
  BEGIN
    l_s := require_session(p_token);
    l_cust := CASE WHEN l_s.role = 'CUSTOMER' THEN l_s.customer_id END;
    IF l_level IS NOT NULL AND l_level NOT IN ('LOW', 'MEDIUM', 'HIGH') THEN
      fail(e_bad_request, 'risk_level must be LOW, MEDIUM or HIGH.');
    END IF;

    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'alert_id' VALUE alert_id, 'transaction_id' VALUE transaction_id,
             'analyst_id' VALUE analyst_id, 'analyst_name' VALUE analyst_name,
             'risk_score' VALUE risk_score, 'risk_level' VALUE risk_level,
             'reason' VALUE reason, 'status' VALUE status,
             'created_at' VALUE iso_utc(created_at), 'amount' VALUE amount,
             'transaction_type' VALUE transaction_type, 'location' VALUE location,
             'transaction_time' VALUE iso_utc(transaction_time),
             'customer_id' VALUE customer_id, 'customer_name' VALUE customer_name,
             'account_number' VALUE account_number)
             ORDER BY created_at DESC, alert_id DESC RETURNING CLOB)
    INTO l_json
    FROM (SELECT fa.alert_id, fa.transaction_id, fa.analyst_id, an.name AS analyst_name,
                 fa.risk_score, fa.risk_level, fa.reason, fa.status, fa.created_at,
                 t.amount, t.transaction_type, t.location, t.transaction_time,
                 c.customer_id, c.first_name || ' ' || c.last_name AS customer_name,
                 a.account_number
          FROM fraud_alert fa
          JOIN bank_transaction t ON t.transaction_id = fa.transaction_id
          JOIN account a ON a.account_id = t.account_id
          JOIN customer c ON c.customer_id = a.customer_id
          LEFT JOIN fraud_analyst an ON an.analyst_id = fa.analyst_id
          WHERE (l_cust IS NULL OR c.customer_id = l_cust)
            AND (l_level IS NULL OR fa.risk_level = l_level)
          ORDER BY fa.created_at DESC, fa.alert_id DESC
          FETCH FIRST c_max_rows ROWS ONLY);
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_alert(p_token IN VARCHAR2, p_id IN VARCHAR2) IS
    l_s    t_session;
    l_cust NUMBER;
  BEGIN
    l_s := require_session(p_token);
    l_cust := CASE WHEN l_s.role = 'CUSTOMER' THEN l_s.customer_id END;
    respond(200, alert_json(to_id(p_id, 'Alert id'), l_cust));
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE update_alert(p_token IN VARCHAR2, p_id IN VARCHAR2, p_body IN CLOB) IS
    l_s      t_session;
    l_id     NUMBER;
    l_status VARCHAR2(20);
    l_old    VARCHAR2(20);
  BEGIN
    l_s := require_session(p_token, 'ANALYST');
    l_id := to_id(p_id, 'Alert id');
    l_status := UPPER(str_field(parse_body(p_body), 'status', 20));

    IF l_status IS NULL THEN
      fail(e_bad_request, 'status is required.');
    ELSIF l_status NOT IN ('OPEN', 'INVESTIGATING', 'CONFIRMED_FRAUD', 'FALSE_POSITIVE', 'CLOSED') THEN
      fail(e_bad_request, 'status must be OPEN, INVESTIGATING, CONFIRMED_FRAUD, FALSE_POSITIVE or CLOSED.');
    END IF;

    IF recent_events('ALERT_STATUS_CHANGED', l_s.user_id, 10) >= c_alert_updates_10min THEN
      fail(e_too_many, 'Too many alert updates. Please wait a few minutes.');
    END IF;

    BEGIN
      SELECT status INTO l_old FROM fraud_alert WHERE alert_id = l_id FOR UPDATE;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        fail(e_not_found, 'Fraud alert ' || l_id || ' was not found.');
    END;

    UPDATE fraud_alert SET status = l_status WHERE alert_id = l_id;
    log_event(l_s.user_id, 'ALERT_STATUS_CHANGED', NULL, l_id, l_old || ' -> ' || l_status);
    COMMIT;

    respond(200, alert_json(l_id, NULL));
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  -- -------------------------------------------------------------------
  -- Reference data
  -- -------------------------------------------------------------------
  PROCEDURE get_accounts(p_token IN VARCHAR2, p_customer_id IN VARCHAR2) IS
    l_s    t_session;
    -- Customers always see only their own accounts, whatever they ask for.
    l_cust NUMBER;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token);
    l_cust := CASE WHEN l_s.role = 'CUSTOMER' THEN l_s.customer_id ELSE to_id(p_customer_id, 'customer_id') END;
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'account_id' VALUE account_id, 'account_number' VALUE account_number,
             'customer_id' VALUE customer_id, 'customer_name' VALUE customer_name,
             'account_type' VALUE account_type, 'balance' VALUE balance, 'status' VALUE status,
             'opened_date' VALUE iso_utc(opened_date), 'interest_rate' VALUE interest_rate,
             'minimum_balance' VALUE minimum_balance, 'overdraft_limit' VALUE overdraft_limit,
             'home_city' VALUE home_city)
             ORDER BY account_id RETURNING CLOB)
    INTO l_json
    FROM (SELECT a.account_id, a.account_number, a.customer_id,
                 c.first_name || ' ' || c.last_name AS customer_name,
                 CASE WHEN sa.account_id IS NOT NULL THEN 'SAVINGS'
                      WHEN ca.account_id IS NOT NULL THEN 'CURRENT'
                      ELSE 'GENERAL' END AS account_type,
                 a.balance, a.status, a.opened_date,
                 sa.interest_rate, sa.minimum_balance, ca.overdraft_limit,
                 (SELECT MIN(addr.city) FROM customer_address addr
                   WHERE addr.customer_id = a.customer_id) AS home_city
          FROM account a
          JOIN customer c ON c.customer_id = a.customer_id
          LEFT JOIN savings_account sa ON sa.account_id = a.account_id
          LEFT JOIN current_account ca ON ca.account_id = a.account_id
          WHERE l_cust IS NULL OR a.customer_id = l_cust);
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_merchants(p_token IN VARCHAR2) IS
    l_s    t_session;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token);
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'merchant_id' VALUE merchant_id, 'merchant_name' VALUE merchant_name,
             'category' VALUE category, 'location' VALUE location, 'risk_level' VALUE risk_level)
             ORDER BY merchant_name RETURNING CLOB)
    INTO l_json
    FROM merchant;
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_devices(p_token IN VARCHAR2, p_customer_id IN VARCHAR2) IS
    l_s    t_session;
    l_cust NUMBER;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token);
    l_cust := CASE WHEN l_s.role = 'CUSTOMER' THEN l_s.customer_id ELSE to_id(p_customer_id, 'customer_id') END;
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'device_id' VALUE d.device_id, 'device_type' VALUE d.device_type,
             'device_identifier' VALUE d.device_identifier, 'location' VALUE d.location,
             'customer_usage' VALUE (SELECT COUNT(*) FROM bank_transaction t
                                      JOIN account a ON a.account_id = t.account_id
                                      WHERE t.device_id = d.device_id
                                        AND a.customer_id = l_cust))
             ORDER BY d.device_id RETURNING CLOB)
    INTO l_json
    FROM device d;
    respond_items(l_json);
  EXCEPTION
    WHEN OTHERS THEN handle_error;
  END;

  PROCEDURE get_customer(p_token IN VARCHAR2, p_id IN VARCHAR2) IS
    l_s    t_session;
    l_id   NUMBER;
    l_json CLOB;
  BEGIN
    l_s := require_session(p_token);
    l_id := to_id(p_id, 'Customer id');
    IF l_s.role = 'CUSTOMER' AND l_id <> l_s.customer_id THEN
      fail(e_forbidden, 'You can only view your own customer profile.');
    END IF;

    SELECT JSON_OBJECT(
             'customer_id' VALUE c.customer_id, 'first_name' VALUE c.first_name,
             'last_name' VALUE c.last_name,
             'customer_name' VALUE c.first_name || ' ' || c.last_name,
             'email' VALUE c.email, 'phone' VALUE c.phone,
             'created_at' VALUE iso_utc(c.created_at),
             'customer_type' VALUE CASE
                 WHEN EXISTS (SELECT 1 FROM individual_customer ic WHERE ic.customer_id = c.customer_id) THEN 'INDIVIDUAL'
                 WHEN EXISTS (SELECT 1 FROM business_customer bc WHERE bc.customer_id = c.customer_id) THEN 'BUSINESS'
               END,
             'home_city' VALUE (SELECT MIN(addr.city) FROM customer_address addr WHERE addr.customer_id = c.customer_id),
             'home_state' VALUE (SELECT MIN(addr.state) FROM customer_address addr WHERE addr.customer_id = c.customer_id)
             RETURNING CLOB)
    INTO l_json
    FROM customer c
    WHERE c.customer_id = l_id;
    respond(200, l_json);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      ROLLBACK;
      respond_error(404, 'Customer ' || p_id || ' was not found.');
    WHEN OTHERS THEN handle_error;
  END;

END pkg_smartbank_api;
/

SHOW ERRORS PACKAGE BODY pkg_smartbank_api
