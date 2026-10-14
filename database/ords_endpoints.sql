-- =====================================================================
-- SmartBank - ords_endpoints.sql
-- REST module smartbank.api (base path /api/).
--
-- Every handler is a one-line call into PKG_SMARTBANK_API
-- (15_api_security.sql), which authenticates the X-Session-Token header,
-- enforces the CUSTOMER / ANALYST role, scopes customer data, validates
-- input and returns JSON. Only GET /health and POST /auth/login are
-- reachable without a session.
--
-- CORS: browsers may call the API only from the origins listed in
-- l_origins below (GitHub Pages and the local Vite dev server).
--
-- Safe to re-run: ORDS.DEFINE_MODULE replaces the existing module.
-- Run as SMARTBANK_USER after 15_api_security.sql.
-- =====================================================================

DECLARE
  c_module  CONSTANT VARCHAR2(30) := 'smartbank.api';
  l_origins CONSTANT VARCHAR2(4000) :=
    'https://ashmita-dev.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173';

  PROCEDURE handler(
    p_pattern VARCHAR2,
    p_method  VARCHAR2,
    p_call    VARCHAR2,
    p_token   BOOLEAN := TRUE
  ) IS
  BEGIN
    ORDS.DEFINE_HANDLER(
      p_module_name    => c_module,
      p_pattern        => p_pattern,
      p_method         => p_method,
      p_source_type    => ORDS.source_type_plsql,
      p_source         => 'BEGIN pkg_smartbank_api.' || p_call || '; END;',
      p_mimes_allowed  => CASE WHEN p_method IN ('POST', 'PUT') THEN 'application/json' END
    );

    IF p_token THEN
      ORDS.DEFINE_PARAMETER(
        p_module_name        => c_module,
        p_pattern            => p_pattern,
        p_method             => p_method,
        p_name               => 'X-Session-Token',
        p_bind_variable_name => 'session_token',
        p_source_type        => 'HEADER',
        p_param_type         => 'STRING',
        p_access_method      => 'IN'
      );
    END IF;
  END;

  PROCEDURE template(p_pattern VARCHAR2) IS
  BEGIN
    ORDS.DEFINE_TEMPLATE(p_module_name => c_module, p_pattern => p_pattern);
  END;

BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => c_module,
    p_base_path      => '/api/',
    p_items_per_page => 0,
    p_status         => 'PUBLISHED',
    p_comments       => 'SmartBank fraud detection and transaction monitoring API (session-authenticated)'
  );
  ORDS.SET_MODULE_ORIGINS_ALLOWED(p_module_name => c_module, p_origins_allowed => l_origins);

  -- Public
  template('health');
  handler('health', 'GET', 'health', FALSE);

  template('auth/login');
  handler('auth/login', 'POST', 'auth_login(:body_text)', FALSE);

  template('auth/logout');
  handler('auth/logout', 'POST', 'auth_logout(:session_token)');

  template('auth/session');
  handler('auth/session', 'GET', 'auth_session(:session_token)');

  -- Analyst dashboards
  template('kpis');
  handler('kpis', 'GET', 'get_kpis(:session_token)');

  template('risk-distribution');
  handler('risk-distribution', 'GET', 'get_risk_distribution(:session_token)');

  template('daily-analytics');
  handler('daily-analytics', 'GET', 'get_daily_analytics(:session_token)');

  template('analysts/workload');
  handler('analysts/workload', 'GET', 'get_analyst_workload(:session_token)');

  -- Transactions (customers see their own; analysts see all)
  template('transactions');
  handler('transactions', 'GET', 'get_transactions(:session_token, :search)');
  handler('transactions', 'POST', 'create_transaction(:session_token, :body_text)');

  -- Fraud alerts
  template('alerts');
  handler('alerts', 'GET', 'get_alerts(:session_token, :risk_level)');

  template('alerts/:id');
  handler('alerts/:id', 'GET', 'get_alert(:session_token, :id)');
  handler('alerts/:id', 'PUT', 'update_alert(:session_token, :id, :body_text)');

  -- Reference data for the customer portal and transfer form
  template('accounts');
  handler('accounts', 'GET', 'get_accounts(:session_token, :customer_id)');

  template('merchants');
  handler('merchants', 'GET', 'get_merchants(:session_token)');

  template('devices');
  handler('devices', 'GET', 'get_devices(:session_token, :customer_id)');

  template('customers/:id');
  handler('customers/:id', 'GET', 'get_customer(:session_token, :id)');

  COMMIT;
END;
/
