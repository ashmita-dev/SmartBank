-- =====================================================================
-- SmartBank - deploy/oci/00_admin_setup.sql
-- Step 1 of the Oracle Autonomous Database (Always Free) installation.
--
-- Run ONCE as ADMIN in Database Actions -> SQL (paste, then "Run Script").
-- Before running, replace CHOOSE_A_STRONG_PASSWORD below IN THE WORKSHEET
-- ONLY. Never commit the real password to the repository.
--
-- Creates the application schema SMARTBANK_USER with only the privileges
-- the project needs, allows it to hash passwords (DBMS_CRYPTO), and
-- REST-enables it under the URL alias "sb", so the API is served at
--   https://<your-adb-host>/ords/sb/api/...
-- =====================================================================

CREATE USER smartbank_user IDENTIFIED BY "CHOOSE_A_STRONG_PASSWORD";

ALTER USER smartbank_user QUOTA 2G ON data;

GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE PROCEDURE,
      CREATE TRIGGER, CREATE SEQUENCE TO smartbank_user;

-- Password hashing (PBKDF2) and session tokens in PKG_SMARTBANK_API.
GRANT EXECUTE ON SYS.DBMS_CRYPTO TO smartbank_user;

-- REST-enable the schema. AutoREST metadata requires authentication;
-- only the handlers defined in ords_endpoints.sql are published.
BEGIN
  ORDS_ADMIN.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'SMARTBANK_USER',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'sb',
    p_auto_rest_auth      => TRUE
  );
  COMMIT;
END;
/
