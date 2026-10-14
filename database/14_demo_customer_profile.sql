-- =====================================================================
-- SmartBank - 14_demo_customer_profile.sql
-- Renames demo customer #1 (the customer linked to the portal's demo
-- login user@smartbank.com) to the project author, Ashmita Mazumdar.
--
-- Why a database change: the customer portal shows the identity stored in
-- CUSTOMER, and analysts see the same name on that customer's transactions
-- and alerts. Changing only the frontend label would show customer #1's
-- financial records under a name the database does not hold.
--
-- Scope: one UPDATE of name and email columns on CUSTOMER_ID 1. The primary
-- key, foreign keys, accounts, transactions and alerts are unchanged.
-- Idempotent: the WHERE clause only matches the original seed values, so
-- running it twice changes nothing the second time.
--
-- Run as SMARTBANK_USER (scripts\register-endpoints.ps1 runs it for you).
-- To undo:
--   UPDATE customer SET first_name = 'Aarav', last_name = 'Sharma',
--          email = 'aarav.sharma@mail.com' WHERE customer_id = 1;
-- =====================================================================

UPDATE customer
SET first_name = 'Ashmita',
    last_name  = 'Mazumdar',
    email      = 'ashmita.mazumdar@mail.com'
WHERE customer_id = 1
  AND first_name = 'Aarav'
  AND last_name  = 'Sharma';

COMMIT;
