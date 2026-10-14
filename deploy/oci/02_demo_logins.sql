-- =====================================================================
-- SmartBank - deploy/oci/02_demo_logins.sql
-- Step 3: create (or reset) the two demonstration logins.
--
-- Run as SMARTBANK_USER in Database Actions -> SQL, after replacing the
-- two placeholder passwords IN THE WORKSHEET ONLY (at least 8 characters,
-- no single quotes). Only salted PBKDF2-SHA256 hashes are stored; the
-- passwords themselves are never saved anywhere in the database.
--
-- Re-running this resets both passwords and signs out existing sessions.
-- =====================================================================

BEGIN
  -- Customer portal login, linked to demo customer #1.
  pkg_smartbank_api.upsert_user(
    p_email        => 'user@smartbank.com',
    p_display_name => 'Demo customer',
    p_role         => 'CUSTOMER',
    p_password     => 'REPLACE_WITH_CUSTOMER_PASSWORD',
    p_customer_id  => 1
  );

  -- Fraud analyst portal login.
  pkg_smartbank_api.upsert_user(
    p_email        => 'admin@smartbank.com',
    p_display_name => 'Fraud Analyst',
    p_role         => 'ANALYST',
    p_password     => 'REPLACE_WITH_ANALYST_PASSWORD',
    p_analyst_id   => 1
  );

  COMMIT;
END;
/
