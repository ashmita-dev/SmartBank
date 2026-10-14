BEGIN

  ORDS.DEFINE_MODULE(
    p_module_name => 'smartbank.api',
    p_base_path => '/api/',
    p_items_per_page => 50,
    p_status => 'PUBLISHED',
    p_comments => 'SmartBank fraud detection and transaction monitoring API'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'kpis'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'kpis',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_item,
    p_source => 'SELECT (SELECT COUNT(*) FROM customer) AS total_customers,
                        (SELECT COUNT(*) FROM account) AS total_accounts,
                        (SELECT COUNT(*) FROM bank_transaction) AS total_transactions,
                        (SELECT COUNT(*) FROM fraud_alert) AS flagged_transactions,
                        (SELECT COUNT(*) FROM fraud_alert WHERE status = ''OPEN'') AS open_alerts,
                        (SELECT COUNT(*) FROM fraud_alert WHERE risk_level = ''HIGH'') AS high_risk_alerts
                 FROM dual'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'risk-distribution'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'risk-distribution',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT risk_level, COUNT(*) AS alert_count,
                        ROUND(AVG(risk_score), 2) AS average_risk_score
                 FROM fraud_alert
                 GROUP BY risk_level
                 ORDER BY CASE risk_level
                            WHEN ''HIGH'' THEN 1
                            WHEN ''MEDIUM'' THEN 2
                            WHEN ''LOW'' THEN 3
                          END'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'daily-analytics'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'daily-analytics',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT txn_date, total_transactions, total_amount,
                        avg_amount, high_risk_count, medium_risk_count
                 FROM v_daily_transaction_analytics
                 ORDER BY txn_date'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'transactions'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'transactions',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT t.transaction_id, t.account_id, a.account_number,
                        c.customer_id, c.first_name || '' '' || c.last_name AS customer_name,
                        t.amount, t.transaction_type, t.transaction_time,
                        t.location, t.status AS transaction_status,
                        m.merchant_name, m.category AS merchant_category,
                        d.device_type, d.device_identifier
                 FROM bank_transaction t
                 JOIN account a ON a.account_id = t.account_id
                 JOIN customer c ON c.customer_id = a.customer_id
                 LEFT JOIN merchant m ON m.merchant_id = t.merchant_id
                 LEFT JOIN device d ON d.device_id = t.device_id
                 WHERE :search IS NULL
                    OR UPPER(a.account_number) LIKE ''%'' || UPPER(:search) || ''%''
                    OR UPPER(c.first_name || '' '' || c.last_name) LIKE ''%'' || UPPER(:search) || ''%''
                    OR UPPER(m.merchant_name) LIKE ''%'' || UPPER(:search) || ''%''
                    OR UPPER(d.device_identifier) LIKE ''%'' || UPPER(:search) || ''%''
                    OR UPPER(t.location) LIKE ''%'' || UPPER(:search) || ''%''
                 ORDER BY t.transaction_time DESC'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'transactions',
    p_method => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source => 'DECLARE
                   l_body JSON_OBJECT_T;
                   l_account_id NUMBER;
                   l_merchant_id NUMBER;
                   l_device_id NUMBER;
                   l_amount NUMBER;
                   l_transaction_type VARCHAR2(30);
                   l_location VARCHAR2(200);
                   l_txn_id NUMBER;
                   l_txn_status VARCHAR2(15);
                   l_out JSON_OBJECT_T := JSON_OBJECT_T();
                   l_alert JSON_OBJECT_T;
                 BEGIN

                   l_body := JSON_OBJECT_T.parse(:body_text);

                   l_account_id := l_body.get_number(''account_id'');
                   l_merchant_id := l_body.get_number(''merchant_id'');
                   l_device_id := l_body.get_number(''device_id'');
                   l_amount := l_body.get_number(''amount'');
                   l_transaction_type := UPPER(l_body.get_string(''transaction_type''));
                   l_location := l_body.get_string(''location'');

                   IF l_account_id IS NULL THEN
                     RAISE_APPLICATION_ERROR(-20001, ''account_id is required'');
                   END IF;

                   IF l_merchant_id IS NULL THEN
                     RAISE_APPLICATION_ERROR(-20002, ''merchant_id is required'');
                   END IF;

                   IF l_device_id IS NULL THEN
                     RAISE_APPLICATION_ERROR(-20003, ''device_id is required'');
                   END IF;

                   IF l_amount IS NULL OR l_amount <= 0 THEN
                     RAISE_APPLICATION_ERROR(-20004, ''amount must be greater than zero'');
                   END IF;

                   IF l_transaction_type IS NULL THEN
                     RAISE_APPLICATION_ERROR(-20005, ''transaction_type is required'');
                   END IF;

                   IF l_location IS NULL THEN
                     RAISE_APPLICATION_ERROR(-20006, ''location is required'');
                   END IF;

                   INSERT INTO bank_transaction (
                     account_id,
                     merchant_id,
                     device_id,
                     amount,
                     transaction_type,
                     transaction_time,
                     location,
                     status
                   )
                   VALUES (
                     l_account_id,
                     l_merchant_id,
                     l_device_id,
                     l_amount,
                     l_transaction_type,
                     SYSTIMESTAMP,
                     l_location,
                     ''COMPLETED''
                   )
                   RETURNING transaction_id INTO l_txn_id;

                   -- TRG_FRAUD_MONITOR has already run DETECT_FRAUD for this
                   -- row by the time the INSERT statement completes.
                   SELECT status INTO l_txn_status
                   FROM bank_transaction
                   WHERE transaction_id = l_txn_id;

                   l_out.put(''transaction_id'', l_txn_id);
                   l_out.put(''transaction_status'', l_txn_status);

                   FOR a IN (SELECT alert_id, risk_score, risk_level, reason, status
                             FROM fraud_alert
                             WHERE transaction_id = l_txn_id) LOOP
                     l_alert := JSON_OBJECT_T();
                     l_alert.put(''alert_id'', a.alert_id);
                     l_alert.put(''risk_score'', a.risk_score);
                     l_alert.put(''risk_level'', a.risk_level);
                     l_alert.put(''reason'', a.reason);
                     l_alert.put(''status'', a.status);
                     l_out.put(''alert'', l_alert);
                   END LOOP;

                   COMMIT;

                   OWA_UTIL.MIME_HEADER(''application/json'', FALSE);
                   OWA_UTIL.STATUS_LINE(201, ''Created'', FALSE);
                   OWA_UTIL.HTTP_HEADER_CLOSE;
                   HTP.P(l_out.to_string);

                 EXCEPTION
                   WHEN OTHERS THEN
                     ROLLBACK;
                     -- Validation and trigger errors (ORA-20000..20999) are
                     -- returned as 400 JSON so the client can display them.
                     IF SQLCODE BETWEEN -20999 AND -20000 THEN
                       l_out := JSON_OBJECT_T();
                       l_out.put(''error'', REGEXP_REPLACE(SQLERRM, ''^ORA-[0-9]+: '', ''''));
                       OWA_UTIL.MIME_HEADER(''application/json'', FALSE);
                       OWA_UTIL.STATUS_LINE(400, ''Bad Request'', FALSE);
                       OWA_UTIL.HTTP_HEADER_CLOSE;
                       HTP.P(l_out.to_string);
                     ELSE
                       RAISE;
                     END IF;
                 END;',
    p_mimes_allowed => 'application/json'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'alerts'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'alerts',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT fa.alert_id, fa.transaction_id, fa.analyst_id,
                        an.name AS analyst_name, fa.risk_score, fa.risk_level,
                        fa.reason, fa.status, fa.created_at, t.amount,
                        t.transaction_type, t.location, t.transaction_time
                 FROM fraud_alert fa
                 JOIN bank_transaction t ON t.transaction_id = fa.transaction_id
                 LEFT JOIN fraud_analyst an ON an.analyst_id = fa.analyst_id
                 WHERE :risk_level IS NULL
                    OR UPPER(fa.risk_level) = UPPER(:risk_level)
                 ORDER BY fa.created_at DESC'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'alerts/:id'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'alerts/:id',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_item,
    p_source => 'SELECT fa.alert_id, fa.transaction_id, fa.analyst_id,
                        an.name AS analyst_name, an.department AS analyst_department,
                        fa.risk_score, fa.risk_level, fa.reason, fa.status,
                        fa.created_at, t.account_id, a.account_number,
                        c.customer_id, c.first_name || '' '' || c.last_name AS customer_name,
                        t.amount, t.transaction_type, t.transaction_time, t.location,
                        m.merchant_name, m.category AS merchant_category,
                        d.device_type, d.device_identifier
                 FROM fraud_alert fa
                 JOIN bank_transaction t ON t.transaction_id = fa.transaction_id
                 JOIN account a ON a.account_id = t.account_id
                 JOIN customer c ON c.customer_id = a.customer_id
                 LEFT JOIN fraud_analyst an ON an.analyst_id = fa.analyst_id
                 LEFT JOIN merchant m ON m.merchant_id = t.merchant_id
                 LEFT JOIN device d ON d.device_id = t.device_id
                 WHERE fa.alert_id = :id'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'alerts/:id',
    p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql,
    p_source => 'DECLARE
                   l_body   CLOB := :body_text;
                   l_id     NUMBER := TO_NUMBER(:id);
                   l_status VARCHAR2(20);
                   l_out    JSON_OBJECT_T := JSON_OBJECT_T();
                   l_code   PLS_INTEGER;
                 BEGIN
                   IF l_body IS NOT NULL AND DBMS_LOB.GETLENGTH(l_body) > 0 THEN
                     l_status := UPPER(JSON_OBJECT_T.parse(l_body).get_string(''status''));
                   END IF;

                   -- No body keeps the original behaviour: move to INVESTIGATING.
                   l_status := NVL(l_status, ''INVESTIGATING'');

                   IF l_status NOT IN (''OPEN'', ''INVESTIGATING'', ''CONFIRMED_FRAUD'',
                                       ''FALSE_POSITIVE'', ''CLOSED'') THEN
                     RAISE_APPLICATION_ERROR(-20041, ''Invalid alert status: '' || l_status);
                   END IF;

                   UPDATE fraud_alert
                   SET status = l_status
                   WHERE alert_id = l_id;

                   IF SQL%ROWCOUNT = 0 THEN
                     RAISE_APPLICATION_ERROR(-20040, ''Fraud alert not found'');
                   END IF;

                   COMMIT;

                   FOR a IN (SELECT alert_id, transaction_id, risk_score, risk_level,
                                    status, reason
                             FROM fraud_alert
                             WHERE alert_id = l_id) LOOP
                     l_out.put(''alert_id'', a.alert_id);
                     l_out.put(''transaction_id'', a.transaction_id);
                     l_out.put(''risk_score'', a.risk_score);
                     l_out.put(''risk_level'', a.risk_level);
                     l_out.put(''status'', a.status);
                     l_out.put(''reason'', a.reason);
                   END LOOP;

                   OWA_UTIL.MIME_HEADER(''application/json'', FALSE);
                   OWA_UTIL.STATUS_LINE(200, ''OK'', FALSE);
                   OWA_UTIL.HTTP_HEADER_CLOSE;
                   HTP.P(l_out.to_string);

                 EXCEPTION
                   WHEN OTHERS THEN
                     ROLLBACK;
                     IF SQLCODE BETWEEN -20999 AND -20000 THEN
                       l_code := CASE WHEN SQLCODE = -20040 THEN 404 ELSE 400 END;
                       l_out := JSON_OBJECT_T();
                       l_out.put(''error'', REGEXP_REPLACE(SQLERRM, ''^ORA-[0-9]+: '', ''''));
                       OWA_UTIL.MIME_HEADER(''application/json'', FALSE);
                       OWA_UTIL.STATUS_LINE(l_code, NULL, FALSE);
                       OWA_UTIL.HTTP_HEADER_CLOSE;
                       HTP.P(l_out.to_string);
                     ELSE
                       RAISE;
                     END IF;
                 END;',
    p_mimes_allowed => 'application/json'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'analysts/workload'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'analysts/workload',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT an.analyst_id, an.name, an.department,
                        SUM(CASE WHEN fa.status = ''OPEN'' THEN 1 ELSE 0 END) AS open_alerts,
                        SUM(CASE WHEN fa.status = ''INVESTIGATING'' THEN 1 ELSE 0 END) AS investigating_alerts,
                        SUM(CASE WHEN fa.status = ''CONFIRMED_FRAUD'' THEN 1 ELSE 0 END) AS confirmed_fraud,
                        SUM(CASE WHEN fa.status = ''FALSE_POSITIVE'' THEN 1 ELSE 0 END) AS false_positive,
                        COUNT(fa.alert_id) AS total_assigned
                 FROM fraud_analyst an
                 LEFT JOIN fraud_alert fa ON fa.analyst_id = an.analyst_id
                 GROUP BY an.analyst_id, an.name, an.department
                 ORDER BY total_assigned DESC'
  );

  -- -------------------------------------------------------------------
  -- Reference data used by the customer portal and transfer form
  -- -------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'accounts'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'accounts',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT a.account_id, a.account_number, a.customer_id,
                        c.first_name || '' '' || c.last_name AS customer_name,
                        CASE
                          WHEN sa.account_id IS NOT NULL THEN ''SAVINGS''
                          WHEN ca.account_id IS NOT NULL THEN ''CURRENT''
                          ELSE ''GENERAL''
                        END AS account_type,
                        a.balance, a.status, a.opened_date,
                        sa.interest_rate, sa.minimum_balance, ca.overdraft_limit,
                        (SELECT MIN(addr.city) FROM customer_address addr
                          WHERE addr.customer_id = a.customer_id) AS home_city
                 FROM account a
                 JOIN customer c ON c.customer_id = a.customer_id
                 LEFT JOIN savings_account sa ON sa.account_id = a.account_id
                 LEFT JOIN current_account ca ON ca.account_id = a.account_id
                 WHERE :customer_id IS NULL
                    OR a.customer_id = TO_NUMBER(:customer_id)
                 ORDER BY a.account_id'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'merchants'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'merchants',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT merchant_id, merchant_name, category, location, risk_level
                 FROM merchant
                 ORDER BY merchant_name'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'devices'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'devices',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source => 'SELECT d.device_id, d.device_type, d.device_identifier, d.location,
                        (SELECT COUNT(*) FROM bank_transaction t
                          JOIN account a ON a.account_id = t.account_id
                          WHERE t.device_id = d.device_id
                            AND a.customer_id = TO_NUMBER(:customer_id)) AS customer_usage
                 FROM device d
                 ORDER BY d.device_id'
  );

  -- Customer profile: the customer portal reads the signed-in customer's
  -- identity from the database instead of hard-coding it.
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'smartbank.api',
    p_pattern => 'customers/:id'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'smartbank.api',
    p_pattern => 'customers/:id',
    p_method => 'GET',
    p_source_type => ORDS.source_type_collection_item,
    p_source => 'SELECT c.customer_id, c.first_name, c.last_name,
                        c.first_name || '' '' || c.last_name AS customer_name,
                        c.email, c.phone, c.created_at,
                        CASE
                          WHEN EXISTS (SELECT 1 FROM individual_customer ic
                                        WHERE ic.customer_id = c.customer_id) THEN ''INDIVIDUAL''
                          WHEN EXISTS (SELECT 1 FROM business_customer bc
                                        WHERE bc.customer_id = c.customer_id) THEN ''BUSINESS''
                        END AS customer_type,
                        (SELECT MIN(addr.city) FROM customer_address addr
                          WHERE addr.customer_id = c.customer_id) AS home_city,
                        (SELECT MIN(addr.state) FROM customer_address addr
                          WHERE addr.customer_id = c.customer_id) AS home_state
                 FROM customer c
                 WHERE c.customer_id = TO_NUMBER(:id)'
  );

  COMMIT;

END;
/
