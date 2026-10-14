-- =====================================================================
-- SmartBank - deploy/oci/01_install_smartbank.sql   (GENERATED - do not edit)
-- Built by scripts/build-cloud-install.mjs from the files in database/.
--
-- Step 2 of the Autonomous Database installation. Run as SMARTBANK_USER on
-- an EMPTY schema (Database Actions -> SQL -> paste -> Run Script).
-- It creates the 12 tables, constraints, fraud engine, views, indexes,
-- synthetic demo data, the API security layer and the REST module.
-- It contains no passwords; demo logins are created in step 3.
-- =====================================================================

SET DEFINE OFF

-- >>>>>>>>>>>>>>>>>>>> 01_tables.sql
-- =====================================================================
-- SmartBank - 01_tables.sql
-- Core schema: 12 tables with primary keys, foreign keys, NOT NULL
-- rules and defaults.
--
-- Named UNIQUE and CHECK constraints are added separately in
-- 02_constraints.sql. Run this script as SMARTBANK_USER on an empty
-- schema.
--
-- This file was reconstructed on 2026-10-14 from the live
-- SMARTBANK_USER schema in XEPDB1 (data dictionary, read-only), because
-- the originally committed file was empty.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Customers (supertype) and subtypes
-- ---------------------------------------------------------------------
CREATE TABLE customer (
  customer_id  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name   VARCHAR2(50)  NOT NULL,
  last_name    VARCHAR2(50)  NOT NULL,
  email        VARCHAR2(100) NOT NULL,
  phone        VARCHAR2(15),
  created_at   DATE DEFAULT SYSDATE NOT NULL
);

CREATE TABLE customer_address (
  address_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id  NUMBER       NOT NULL,
  address_line VARCHAR2(150),
  city         VARCHAR2(50) NOT NULL,
  state        VARCHAR2(50) NOT NULL,
  postal_code  VARCHAR2(10) NOT NULL,
  CONSTRAINT fk_addr_customer FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
);

CREATE TABLE individual_customer (
  customer_id   NUMBER PRIMARY KEY,
  date_of_birth DATE NOT NULL,
  occupation    VARCHAR2(50),
  CONSTRAINT fk_indiv_customer FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
);

CREATE TABLE business_customer (
  customer_id     NUMBER PRIMARY KEY,
  business_name   VARCHAR2(100) NOT NULL,
  registration_no VARCHAR2(30)  NOT NULL,
  CONSTRAINT fk_biz_customer FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
);

-- ---------------------------------------------------------------------
-- Merchants and devices
-- ---------------------------------------------------------------------
CREATE TABLE merchant (
  merchant_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_name VARCHAR2(100) NOT NULL,
  category      VARCHAR2(50)  NOT NULL,
  location      VARCHAR2(100),
  risk_level    VARCHAR2(10) DEFAULT 'LOW' NOT NULL
);

CREATE TABLE device (
  device_id         NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_type       VARCHAR2(30)  NOT NULL,
  device_identifier VARCHAR2(100) NOT NULL,
  first_seen        DATE DEFAULT SYSDATE NOT NULL,
  location          VARCHAR2(100)
);

-- ---------------------------------------------------------------------
-- Accounts (supertype) and subtypes
-- ---------------------------------------------------------------------
CREATE TABLE account (
  account_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id    NUMBER       NOT NULL,
  account_number VARCHAR2(20) NOT NULL,
  balance        NUMBER(14,2) DEFAULT 0 NOT NULL,
  status         VARCHAR2(10) DEFAULT 'ACTIVE' NOT NULL,
  opened_date    DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_account_customer FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
);

CREATE TABLE savings_account (
  account_id      NUMBER PRIMARY KEY,
  interest_rate   NUMBER(5,2)  NOT NULL,
  minimum_balance NUMBER(14,2) NOT NULL,
  CONSTRAINT fk_savings_account FOREIGN KEY (account_id)
    REFERENCES account (account_id)
);

CREATE TABLE current_account (
  account_id      NUMBER PRIMARY KEY,
  overdraft_limit NUMBER(14,2) NOT NULL,
  CONSTRAINT fk_current_account FOREIGN KEY (account_id)
    REFERENCES account (account_id)
);

-- ---------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------
CREATE TABLE bank_transaction (
  transaction_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id       NUMBER       NOT NULL,
  merchant_id      NUMBER,
  device_id        NUMBER,
  amount           NUMBER(14,2) NOT NULL,
  transaction_type VARCHAR2(15) NOT NULL,
  transaction_time TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  location         VARCHAR2(100),
  status           VARCHAR2(15) DEFAULT 'COMPLETED' NOT NULL,
  CONSTRAINT fk_txn_account FOREIGN KEY (account_id)
    REFERENCES account (account_id),
  CONSTRAINT fk_txn_merchant FOREIGN KEY (merchant_id)
    REFERENCES merchant (merchant_id),
  CONSTRAINT fk_txn_device FOREIGN KEY (device_id)
    REFERENCES device (device_id)
);

-- ---------------------------------------------------------------------
-- Fraud operations
-- ---------------------------------------------------------------------
CREATE TABLE fraud_analyst (
  analyst_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR2(100) NOT NULL,
  email      VARCHAR2(100) NOT NULL,
  department VARCHAR2(50)
);

CREATE TABLE fraud_alert (
  alert_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id NUMBER       NOT NULL,
  analyst_id     NUMBER,
  risk_score     NUMBER(5,2)  NOT NULL,
  risk_level     VARCHAR2(10) NOT NULL,
  reason         VARCHAR2(500),
  status         VARCHAR2(20) DEFAULT 'OPEN' NOT NULL,
  created_at     DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_alert_txn FOREIGN KEY (transaction_id)
    REFERENCES bank_transaction (transaction_id),
  CONSTRAINT fk_alert_analyst FOREIGN KEY (analyst_id)
    REFERENCES fraud_analyst (analyst_id)
);

-- >>>>>>>>>>>>>>>>>>>> 02_constraints.sql
ALTER TABLE customer ADD CONSTRAINT uq_customer_email UNIQUE (email);

ALTER TABLE business_customer ADD CONSTRAINT uq_business_regno UNIQUE (registration_no);

ALTER TABLE account ADD CONSTRAINT uq_account_number UNIQUE (account_number);

ALTER TABLE account ADD CONSTRAINT chk_account_balance CHECK (balance >= 0);

ALTER TABLE account ADD CONSTRAINT chk_account_status CHECK (status IN ('ACTIVE','INACTIVE','CLOSED'));

ALTER TABLE device ADD CONSTRAINT uq_device_identifier UNIQUE (device_identifier);

ALTER TABLE merchant ADD CONSTRAINT chk_merchant_risk CHECK (risk_level IN ('LOW','MEDIUM','HIGH'));

ALTER TABLE bank_transaction ADD CONSTRAINT chk_txn_amount CHECK (amount > 0);

ALTER TABLE bank_transaction ADD CONSTRAINT chk_txn_type CHECK (transaction_type IN ('DEBIT','CREDIT','TRANSFER','WITHDRAWAL','DEPOSIT'));

ALTER TABLE bank_transaction ADD CONSTRAINT chk_txn_status CHECK (status IN ('PENDING','COMPLETED','FLAGGED','REJECTED'));

ALTER TABLE fraud_analyst ADD CONSTRAINT uq_analyst_email UNIQUE (email);

ALTER TABLE fraud_alert ADD CONSTRAINT uq_alert_txn UNIQUE (transaction_id);

ALTER TABLE fraud_alert ADD CONSTRAINT chk_alert_score CHECK (risk_score BETWEEN 0 AND 100);

ALTER TABLE fraud_alert ADD CONSTRAINT chk_alert_level CHECK (risk_level IN ('LOW','MEDIUM','HIGH'));

ALTER TABLE fraud_alert ADD CONSTRAINT chk_alert_status CHECK (status IN ('OPEN','INVESTIGATING','CONFIRMED_FRAUD','FALSE_POSITIVE','CLOSED'));

-- >>>>>>>>>>>>>>>>>>>> 03_seed_data.sql (reference rows)
-- =====================================================================
-- SmartBank - 03_seed_data.sql
-- Synthetic demonstration data for all reference tables plus the
-- transaction history.
--
-- Exported on 2026-10-14 from the live SMARTBANK_USER schema (read-only),
-- because the originally committed file was empty.
--
-- IMPORTANT - run order:
--   01_tables.sql, 02_constraints.sql, 03_seed_data.sql (reference rows
--   only, see below), 05-09 (functions, procedures, triggers, cursor,
--   package), then the BANK_TRANSACTION section of this file.
--
-- Identity columns are GENERATED ALWAYS, so rows are inserted in their
-- original ID order on an empty schema to reproduce the same IDs that
-- the foreign keys below rely on ("-- id n" comments).
--
-- FRAUD_ALERT rows are deliberately NOT inserted. They are produced by
-- TRG_FRAUD_MONITOR -> DETECT_FRAUD as each transaction is replayed, so
-- alert counts and statuses may differ slightly from the source
-- database (for example, alerts an analyst already reviewed come back as OPEN).
-- Transactions that were FLAGGED are inserted as COMPLETED; DETECT_FRAUD
-- re-flags HIGH-risk ones.
-- =====================================================================

SET DEFINE OFF;

-- CUSTOMER
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Aarav', 'Sharma', 'aarav.sharma@mail.com', '9820011111', DATE '2026-09-27') /* id 1 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Diya', 'Patel', 'diya.patel@mail.com', '9820022222', DATE '2026-09-27') /* id 2 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Vihaan', 'Iyer', 'vihaan.iyer@mail.com', '9820033333', DATE '2026-09-27') /* id 3 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Ananya', 'Nair', 'ananya.nair@mail.com', '9820044444', DATE '2026-09-27') /* id 4 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Kabir', 'Rao', 'kabir.rao@mail.com', '9820055555', DATE '2026-09-27') /* id 5 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Ishita', 'Verma', 'ishita.verma@mail.com', '9820066666', DATE '2026-09-27') /* id 6 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Reyansh', 'Gupta', 'reyansh.gupta@mail.com', '9820077777', DATE '2026-09-27') /* id 7 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Myra', 'Joshi', 'myra.joshi@mail.com', '9820088888', DATE '2026-09-27') /* id 8 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Arjun', 'Mehta', 'arjun.mehta@mail.com', '9820099999', DATE '2026-09-27') /* id 9 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Saanvi', 'Desai', 'saanvi.desai@mail.com', '9820010000', DATE '2026-09-27') /* id 10 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Rohan', 'Kulkarni', 'rohan.k@bizmail.com', '9820111111', DATE '2026-09-27') /* id 11 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Neha', 'Agarwal', 'neha.a@bizmail.com', '9820122222', DATE '2026-09-27') /* id 12 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Vikram', 'Chawla', 'vikram.c@bizmail.com', '9820133333', DATE '2026-09-27') /* id 13 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Priya', 'Malhotra', 'priya.m@bizmail.com', '9820144444', DATE '2026-09-27') /* id 14 */;
INSERT INTO customer (first_name, last_name, email, phone, created_at) VALUES ('Sanjay', 'Bhatt', 'sanjay.b@bizmail.com', '9820155555', DATE '2026-09-27') /* id 15 */;

-- CUSTOMER_ADDRESS
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (1, 'MG Road', 'Mumbai', 'Maharashtra', '400001');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (2, 'Park Street', 'Kolkata', 'West Bengal', '700016');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (3, 'Anna Salai', 'Chennai', 'Tamil Nadu', '600002');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (4, 'MG Road', 'Bengaluru', 'Karnataka', '560001');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (5, 'SG Highway', 'Ahmedabad', 'Gujarat', '380015');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (6, 'Civil Lines', 'Nagpur', 'Maharashtra', '440001');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (7, 'Sector 17', 'Chandigarh', 'Punjab', '160017');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (8, 'FC Road', 'Pune', 'Maharashtra', '411005');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (9, 'Banjara Hills', 'Hyderabad', 'Telangana', '500034');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (10, 'C Scheme', 'Jaipur', 'Rajasthan', '302001');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (11, 'BKC', 'Mumbai', 'Maharashtra', '400051');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (12, 'Connaught Place', 'New Delhi', 'Delhi', '110001');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (13, 'Salt Lake', 'Kolkata', 'West Bengal', '700091');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (14, 'Koregaon Park', 'Pune', 'Maharashtra', '411001');
INSERT INTO customer_address (customer_id, address_line, city, state, postal_code) VALUES (15, 'Whitefield', 'Bengaluru', 'Karnataka', '560066');

-- INDIVIDUAL_CUSTOMER
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (1, DATE '1994-03-12', 'Software Engineer');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (2, DATE '1990-07-25', 'Doctor');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (3, DATE '1998-11-02', 'Student');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (4, DATE '1985-05-18', 'Teacher');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (5, DATE '1992-09-09', 'Architect');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (6, DATE '1988-01-30', 'Chartered Accountant');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (7, DATE '1996-06-14', 'Marketing Manager');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (8, DATE '2000-02-20', 'Student');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (9, DATE '1991-12-05', 'Lawyer');
INSERT INTO individual_customer (customer_id, date_of_birth, occupation) VALUES (10, DATE '1997-04-27', 'Data Analyst');

-- BUSINESS_CUSTOMER
INSERT INTO business_customer (customer_id, business_name, registration_no) VALUES (11, 'Kulkarni Traders Pvt Ltd', 'REG10011');
INSERT INTO business_customer (customer_id, business_name, registration_no) VALUES (12, 'Agarwal Exports LLP', 'REG10012');
INSERT INTO business_customer (customer_id, business_name, registration_no) VALUES (13, 'Chawla Textiles Ltd', 'REG10013');
INSERT INTO business_customer (customer_id, business_name, registration_no) VALUES (14, 'Malhotra Foods Pvt Ltd', 'REG10014');
INSERT INTO business_customer (customer_id, business_name, registration_no) VALUES (15, 'Bhatt Logistics Ltd', 'REG10015');

-- ACCOUNT
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (1, 'AC1000001', 45000, 'ACTIVE', DATE '2022-01-15') /* id 1 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (2, 'AC1000002', 120000, 'ACTIVE', DATE '2021-06-20') /* id 2 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (3, 'AC1000003', 8000, 'ACTIVE', DATE '2023-03-10') /* id 3 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (4, 'AC1000004', 67000, 'ACTIVE', DATE '2020-11-05') /* id 4 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (5, 'AC1000005', 250000, 'ACTIVE', DATE '2019-09-18') /* id 5 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (6, 'AC1000006', 98000, 'ACTIVE', DATE '2022-07-22') /* id 6 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (7, 'AC1000007', 15000, 'ACTIVE', DATE '2023-01-30') /* id 7 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (8, 'AC1000008', 5000, 'ACTIVE', DATE '2024-02-14') /* id 8 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (9, 'AC1000009', 175000, 'ACTIVE', DATE '2018-12-01') /* id 9 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (10, 'AC1000010', 32000, 'ACTIVE', DATE '2023-08-09') /* id 10 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (1, 'AC1000011', 300000, 'ACTIVE', DATE '2023-05-01') /* id 11 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (4, 'AC1000012', 500000, 'ACTIVE', DATE '2021-02-17') /* id 12 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (11, 'AC2000001', 850000, 'ACTIVE', DATE '2020-04-11') /* id 13 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (12, 'AC2000002', 1200000, 'ACTIVE', DATE '2019-08-25') /* id 14 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (13, 'AC2000003', 600000, 'ACTIVE', DATE '2021-10-03') /* id 15 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (14, 'AC2000004', 950000, 'ACTIVE', DATE '2022-03-19') /* id 16 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (15, 'AC2000005', 430000, 'ACTIVE', DATE '2020-06-30') /* id 17 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (2, 'AC1000013', 22000, 'ACTIVE', DATE '2024-01-05') /* id 18 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (6, 'AC1000014', 41000, 'ACTIVE', DATE '2023-09-12') /* id 19 */;
INSERT INTO account (customer_id, account_number, balance, status, opened_date) VALUES (9, 'AC1000015', 19000, 'ACTIVE', DATE '2024-04-22') /* id 20 */;

-- SAVINGS_ACCOUNT
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (1, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (2, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (3, 4, 500);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (4, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (6, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (7, 4, 500);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (8, 4, 500);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (9, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (10, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (18, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (19, 3.5, 1000);
INSERT INTO savings_account (account_id, interest_rate, minimum_balance) VALUES (20, 4, 500);

-- CURRENT_ACCOUNT
INSERT INTO current_account (account_id, overdraft_limit) VALUES (5, 50000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (11, 100000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (12, 200000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (13, 300000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (14, 400000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (15, 250000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (16, 350000);
INSERT INTO current_account (account_id, overdraft_limit) VALUES (17, 150000);

-- MERCHANT
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('Amazon India', 'E-commerce', 'Bengaluru', 'LOW') /* id 1 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('BigBasket', 'Grocery', 'Bengaluru', 'LOW') /* id 2 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('Swiggy', 'Food Delivery', 'Bengaluru', 'LOW') /* id 3 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('IndiGo Airlines', 'Travel', 'Gurugram', 'MEDIUM') /* id 4 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('QuickCash Loans', 'Finance', 'Mumbai', 'HIGH') /* id 5 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('Croma Electronics', 'Electronics', 'Mumbai', 'MEDIUM') /* id 6 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('Decathlon', 'Retail', 'Pune', 'LOW') /* id 7 */;
INSERT INTO merchant (merchant_name, category, location, risk_level) VALUES ('CryptoXchange', 'Crypto Exchange', 'Unknown', 'HIGH') /* id 8 */;

-- DEVICE
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-AND-0001', DATE '2026-09-27', 'Mumbai') /* id 1 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-IOS-0002', DATE '2026-09-27', 'Kolkata') /* id 2 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('DESKTOP', 'DEV-WIN-0003', DATE '2026-09-27', 'Chennai') /* id 3 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-AND-0004', DATE '2026-09-27', 'Bengaluru') /* id 4 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-IOS-0005', DATE '2026-09-27', 'Ahmedabad') /* id 5 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('DESKTOP', 'DEV-MAC-0006', DATE '2026-09-27', 'Nagpur') /* id 6 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-AND-0007', DATE '2026-09-27', 'Chandigarh') /* id 7 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-AND-0008', DATE '2026-09-27', 'Pune') /* id 8 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('DESKTOP', 'DEV-WIN-0009', DATE '2026-09-27', 'Hyderabad') /* id 9 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-IOS-0010', DATE '2026-09-27', 'Jaipur') /* id 10 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-AND-0011', DATE '2026-09-27', 'Mumbai') /* id 11 */;
INSERT INTO device (device_type, device_identifier, first_seen, location) VALUES ('MOBILE', 'DEV-UNK-0099', DATE '2026-09-27', 'Lagos') /* id 12 */;

-- FRAUD_ANALYST
INSERT INTO fraud_analyst (name, email, department) VALUES ('Kavita Rao', 'kavita.rao@smartbank.com', 'Fraud Investigations') /* id 1 */;
INSERT INTO fraud_analyst (name, email, department) VALUES ('Suresh Menon', 'suresh.menon@smartbank.com', 'Fraud Investigations') /* id 2 */;

COMMIT;


-- >>>>>>>>>>>>>>>>>>>> 05_functions.sql
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

-- >>>>>>>>>>>>>>>>>>>> 06_procedures.sql
CREATE OR REPLACE PROCEDURE generate_alert(
  p_transaction_id IN NUMBER,
  p_score IN NUMBER,
  p_level IN VARCHAR2,
  p_reason IN VARCHAR2
)
IS
  v_analyst_id NUMBER;
BEGIN
  BEGIN
    SELECT analyst_id INTO v_analyst_id
    FROM (
      SELECT fa.analyst_id, COUNT(al.alert_id) AS open_count
      FROM fraud_analyst fa
      LEFT JOIN fraud_alert al
        ON al.analyst_id = fa.analyst_id
        AND al.status = 'OPEN'
      GROUP BY fa.analyst_id
      ORDER BY open_count ASC
    )
    WHERE ROWNUM = 1;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_analyst_id := NULL;
  END;

  INSERT INTO fraud_alert (
    transaction_id,
    analyst_id,
    risk_score,
    risk_level,
    reason,
    status
  )
  VALUES (
    p_transaction_id,
    v_analyst_id,
    p_score,
    p_level,
    p_reason,
    'OPEN'
  );

EXCEPTION
  WHEN DUP_VAL_ON_INDEX THEN
    NULL;
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(
      -20099,
      'GENERATE_ALERT: Unexpected error - ' || SQLERRM
    );
END;
/

CREATE OR REPLACE PROCEDURE detect_fraud(
  p_transaction_id IN NUMBER
)
IS
  v_score NUMBER;
  v_level VARCHAR2(10);
  v_amount bank_transaction.amount%TYPE;
  v_account_id bank_transaction.account_id%TYPE;
  v_device_id bank_transaction.device_id%TYPE;
  v_location bank_transaction.location%TYPE;
  v_txn_time bank_transaction.transaction_time%TYPE;
  v_reason VARCHAR2(500) := '';
  v_recent_count NUMBER := 0;
  v_device_seen NUMBER := 0;
  v_location_match NUMBER := 0;
BEGIN
  SELECT amount,
         account_id,
         device_id,
         location,
         transaction_time
  INTO v_amount,
       v_account_id,
       v_device_id,
       v_location,
       v_txn_time
  FROM bank_transaction
  WHERE transaction_id = p_transaction_id;

  v_score := calculate_risk(p_transaction_id);
  v_level := classify_risk(v_score);

  IF v_amount > 50000 THEN
    v_reason := v_reason || 'High transaction amount; ';
  END IF;

  SELECT COUNT(*)
  INTO v_recent_count
  FROM bank_transaction
  WHERE account_id = v_account_id
    AND transaction_id != p_transaction_id
    AND transaction_time BETWEEN v_txn_time - (10/1440) AND v_txn_time;

  IF v_recent_count >= 1 THEN
    v_reason := v_reason || 'Multiple transactions in short period; ';
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
      v_reason := v_reason || 'Unrecognized device; ';
    END IF;
  END IF;

  IF v_location IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_location_match
    FROM customer_address ca
    JOIN account a
      ON a.customer_id = ca.customer_id
    WHERE a.account_id = v_account_id
      AND UPPER(ca.city) = UPPER(v_location);

    IF v_location_match = 0 THEN
      v_reason := v_reason || 'Unusual transaction location; ';
    END IF;
  END IF;

  IF v_level IN ('MEDIUM', 'HIGH') THEN
    generate_alert(
      p_transaction_id,
      v_score,
      v_level,
      v_reason
    );

    IF v_level = 'HIGH' THEN
      UPDATE bank_transaction
      SET status = 'FLAGGED'
      WHERE transaction_id = p_transaction_id;
    END IF;
  END IF;

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(
      -20004,
      'DETECT_FRAUD: Transaction ID ' || p_transaction_id || ' not found'
    );
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(
      -20099,
      'DETECT_FRAUD: Unexpected error - ' || SQLERRM
    );
END;
/

-- >>>>>>>>>>>>>>>>>>>> 07_triggers.sql
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

-- >>>>>>>>>>>>>>>>>>>> 08_cursor.sql
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

-- >>>>>>>>>>>>>>>>>>>> 09_package.sql
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

-- >>>>>>>>>>>>>>>>>>>> 10_views.sql
CREATE OR REPLACE VIEW v_high_risk_transactions AS
SELECT
  t.transaction_id,
  t.account_id,
  a.account_number,
  c.customer_id,
  c.first_name || ' ' || c.last_name AS customer_name,
  t.amount,
  t.transaction_type,
  t.transaction_time,
  t.location,
  m.merchant_name,
  d.device_type,
  fa.risk_score,
  fa.risk_level,
  fa.reason,
  fa.status AS alert_status
FROM bank_transaction t
JOIN account a ON a.account_id = t.account_id
JOIN customer c ON c.customer_id = a.customer_id
JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
LEFT JOIN merchant m ON m.merchant_id = t.merchant_id
LEFT JOIN device d ON d.device_id = t.device_id
WHERE fa.risk_level = 'HIGH';

CREATE OR REPLACE VIEW v_fraud_alert_summary AS
SELECT
  risk_level,
  status,
  COUNT(*) AS alert_count,
  ROUND(AVG(risk_score), 2) AS avg_risk_score,
  MIN(created_at) AS earliest_alert,
  MAX(created_at) AS latest_alert
FROM fraud_alert
GROUP BY risk_level, status;

CREATE OR REPLACE VIEW v_customer_transaction_summary AS
SELECT
  c.customer_id,
  c.first_name || ' ' || c.last_name AS customer_name,
  CASE WHEN ic.customer_id IS NOT NULL THEN 'INDIVIDUAL' ELSE 'BUSINESS' END AS customer_type,
  COUNT(t.transaction_id) AS total_transactions,
  SUM(t.amount) AS total_amount,
  ROUND(AVG(t.amount), 2) AS avg_amount,
  SUM(CASE WHEN fa.alert_id IS NOT NULL THEN 1 ELSE 0 END) AS flagged_transactions
FROM customer c
JOIN account a ON a.customer_id = c.customer_id
JOIN bank_transaction t ON t.account_id = a.account_id
LEFT JOIN individual_customer ic ON ic.customer_id = c.customer_id
LEFT JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
GROUP BY c.customer_id, c.first_name, c.last_name, ic.customer_id;

CREATE OR REPLACE VIEW v_daily_transaction_analytics AS
SELECT
  TRUNC(t.transaction_time) AS txn_date,
  COUNT(*) AS total_transactions,
  SUM(t.amount) AS total_amount,
  ROUND(AVG(t.amount), 2) AS avg_amount,
  SUM(CASE WHEN fa.risk_level = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_count,
  SUM(CASE WHEN fa.risk_level = 'MEDIUM' THEN 1 ELSE 0 END) AS medium_risk_count
FROM bank_transaction t
LEFT JOIN fraud_alert fa ON fa.transaction_id = t.transaction_id
GROUP BY TRUNC(t.transaction_time);

-- >>>>>>>>>>>>>>>>>>>> 11_indexes.sql
CREATE INDEX idx_txn_account
ON bank_transaction(account_id);

CREATE INDEX idx_txn_merchant
ON bank_transaction(merchant_id);

CREATE INDEX idx_txn_device
ON bank_transaction(device_id);

CREATE INDEX idx_txn_time
ON bank_transaction(transaction_time);

CREATE INDEX idx_alert_risk_level
ON fraud_alert(risk_level);

CREATE INDEX idx_alert_status
ON fraud_alert(status);

-- >>>>>>>>>>>>>>>>>>>> 03_seed_data.sql (BANK_TRANSACTION replay through the fraud trigger)

-- ---------------------------------------------------------------------
-- BANK_TRANSACTION
-- Run only after 05_functions.sql - 09_package.sql are installed, so the
-- fraud-monitoring trigger evaluates every replayed transaction.
-- ---------------------------------------------------------------------
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 1, 1, 1200, 'DEBIT', TIMESTAMP '2026-09-07 14:09:46', 'Mumbai', 'COMPLETED') /* id 1 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 2, 2, 850, 'DEBIT', TIMESTAMP '2026-09-08 14:09:46', 'Kolkata', 'COMPLETED') /* id 2 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (5, 5, 12, 480000, 'TRANSFER', TIMESTAMP '2026-09-09 14:09:46', 'Lagos', 'COMPLETED') /* id 3 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 1, 3, 2500, 'DEBIT', TIMESTAMP '2026-09-27 13:52:46', 'Chennai', 'COMPLETED') /* id 4 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 3, 3, 1800, 'DEBIT', TIMESTAMP '2026-09-27 13:53:46', 'Chennai', 'COMPLETED') /* id 5 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 6, 3, 4200, 'DEBIT', TIMESTAMP '2026-09-27 13:54:46', 'Chennai', 'COMPLETED') /* id 6 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 4, 3, 3100, 'DEBIT', TIMESTAMP '2026-09-27 13:55:46', 'Chennai', 'COMPLETED') /* id 7 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (9, 8, 11, 95000, 'TRANSFER', TIMESTAMP '2026-09-17 14:09:46', 'Mumbai', 'COMPLETED') /* id 8 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (14, 7, 8, 6200, 'DEBIT', TIMESTAMP '2026-09-18 14:09:46', 'Pune', 'COMPLETED') /* id 9 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 4, 4, 15200, 'DEBIT', TIMESTAMP '2026-09-19 14:09:46', 'Bengaluru', 'COMPLETED') /* id 10 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (20, 1, 2, 14069.75, 'CREDIT', TIMESTAMP '2026-09-15 11:23:00', 'Pune', 'COMPLETED') /* id 11 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 1, 1, 12904.89, 'DEBIT', TIMESTAMP '2026-09-16 19:00:32', 'Mumbai', 'COMPLETED') /* id 12 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 3, 5, 2778.47, 'CREDIT', TIMESTAMP '2026-09-08 06:54:32', 'Bengaluru', 'COMPLETED') /* id 13 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (10, 3, 6, 17647.53, 'DEBIT', TIMESTAMP '2026-09-09 03:00:03', 'Chennai', 'COMPLETED') /* id 14 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (18, 6, 1, 13441.09, 'DEBIT', TIMESTAMP '2026-09-19 10:12:54', 'Pune', 'COMPLETED') /* id 15 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 7, 8, 9541.29, 'CREDIT', TIMESTAMP '2026-09-08 08:03:38', 'Delhi', 'COMPLETED') /* id 16 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (10, 7, 2, 9831.64, 'DEBIT', TIMESTAMP '2026-08-31 08:50:14', 'Bengaluru', 'COMPLETED') /* id 17 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (19, 6, 6, 16500.06, 'DEBIT', TIMESTAMP '2026-08-30 10:03:58', 'Delhi', 'COMPLETED') /* id 18 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (5, 1, 5, 6299.28, 'CREDIT', TIMESTAMP '2026-09-02 13:02:01', 'Bengaluru', 'COMPLETED') /* id 19 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (5, 6, 11, 15828.71, 'TRANSFER', TIMESTAMP '2026-09-22 21:48:31', 'Mumbai', 'COMPLETED') /* id 20 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (14, 6, 9, 17430.36, 'DEBIT', TIMESTAMP '2026-08-28 19:20:31', 'Chennai', 'COMPLETED') /* id 21 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (10, 1, 10, 1951.11, 'TRANSFER', TIMESTAMP '2026-09-03 08:16:31', 'Mumbai', 'COMPLETED') /* id 22 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (19, 3, 8, 6172.32, 'TRANSFER', TIMESTAMP '2026-08-29 23:22:02', 'Pune', 'COMPLETED') /* id 23 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 2, 4, 10179.91, 'DEBIT', TIMESTAMP '2026-09-16 06:17:27', 'Pune', 'COMPLETED') /* id 24 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (15, 2, 8, 16070.91, 'DEBIT', TIMESTAMP '2026-08-31 20:02:53', 'Pune', 'COMPLETED') /* id 25 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (20, 3, 10, 13496.33, 'CREDIT', TIMESTAMP '2026-09-17 23:12:00', 'Chennai', 'COMPLETED') /* id 26 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (16, 4, 2, 5270.55, 'TRANSFER', TIMESTAMP '2026-09-11 12:01:43', 'Bengaluru', 'COMPLETED') /* id 27 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (9, 6, 10, 2176.37, 'DEBIT', TIMESTAMP '2026-09-20 00:34:39', 'Bengaluru', 'COMPLETED') /* id 28 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (16, 4, 4, 17424.92, 'DEBIT', TIMESTAMP '2026-09-16 17:50:36', 'Pune', 'COMPLETED') /* id 29 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (7, 5, 11, 11594.17, 'CREDIT', TIMESTAMP '2026-09-08 01:59:13', 'Pune', 'COMPLETED') /* id 30 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (14, 5, 8, 8560.16, 'DEBIT', TIMESTAMP '2026-09-14 04:07:30', 'Mumbai', 'COMPLETED') /* id 31 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (20, 8, 2, 8091.94, 'DEBIT', TIMESTAMP '2026-09-03 02:04:28', 'Delhi', 'COMPLETED') /* id 32 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (8, 2, 2, 765.75, 'DEBIT', TIMESTAMP '2026-08-30 10:22:13', 'Delhi', 'COMPLETED') /* id 33 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (7, 5, 2, 12195.5, 'CREDIT', TIMESTAMP '2026-09-15 16:38:35', 'Delhi', 'COMPLETED') /* id 34 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (17, 7, 11, 9429.29, 'DEBIT', TIMESTAMP '2026-08-31 16:40:57', 'Mumbai', 'COMPLETED') /* id 35 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (16, 8, 7, 2447.3, 'CREDIT', TIMESTAMP '2026-09-21 09:28:54', 'Delhi', 'COMPLETED') /* id 36 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (14, 5, 9, 7287.12, 'TRANSFER', TIMESTAMP '2026-09-16 18:43:53', 'Bengaluru', 'COMPLETED') /* id 37 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (14, 2, 7, 11903.52, 'DEBIT', TIMESTAMP '2026-09-16 11:14:13', 'Pune', 'COMPLETED') /* id 38 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (19, 8, 10, 17215.64, 'TRANSFER', TIMESTAMP '2026-09-13 05:45:41', 'Delhi', 'COMPLETED') /* id 39 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (19, 3, 4, 1424.75, 'DEBIT', TIMESTAMP '2026-09-12 15:32:59', 'Delhi', 'COMPLETED') /* id 40 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 4, 3, 14508.35, 'TRANSFER', TIMESTAMP '2026-09-06 11:50:25', 'Pune', 'COMPLETED') /* id 41 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (11, 5, 1, 1960.72, 'CREDIT', TIMESTAMP '2026-09-13 05:53:32', 'Chennai', 'COMPLETED') /* id 42 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 6, 10, 17032.83, 'DEBIT', TIMESTAMP '2026-09-05 06:28:11', 'Pune', 'COMPLETED') /* id 43 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (19, 8, 7, 5515.18, 'CREDIT', TIMESTAMP '2026-09-04 16:07:01', 'Bengaluru', 'COMPLETED') /* id 44 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (15, 2, 10, 9269.43, 'TRANSFER', TIMESTAMP '2026-09-12 18:18:55', 'Bengaluru', 'COMPLETED') /* id 45 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 3, 4, 14744.38, 'CREDIT', TIMESTAMP '2026-09-27 01:55:09', 'Bengaluru', 'COMPLETED') /* id 46 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (11, 7, 5, 2969.17, 'DEBIT', TIMESTAMP '2026-09-02 01:35:58', 'Delhi', 'COMPLETED') /* id 47 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (9, 1, 9, 1188.55, 'DEBIT', TIMESTAMP '2026-08-31 10:32:37', 'Mumbai', 'COMPLETED') /* id 48 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 7, 7, 8998.02, 'TRANSFER', TIMESTAMP '2026-09-27 06:07:53', 'Bengaluru', 'COMPLETED') /* id 49 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 6, 7, 10155.45, 'DEBIT', TIMESTAMP '2026-09-27 14:03:00', 'Chennai', 'COMPLETED') /* id 50 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 3, 11, 12060.67, 'CREDIT', TIMESTAMP '2026-09-25 15:32:49', 'Mumbai', 'COMPLETED') /* id 51 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 8, 2, 1779.5, 'CREDIT', TIMESTAMP '2026-09-04 21:05:42', 'Bengaluru', 'COMPLETED') /* id 52 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (10, 8, 5, 2525.42, 'CREDIT', TIMESTAMP '2026-09-12 03:34:25', 'Mumbai', 'COMPLETED') /* id 53 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 8, 10, 17742.51, 'DEBIT', TIMESTAMP '2026-09-25 15:00:50', 'Pune', 'COMPLETED') /* id 54 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 3, 2, 2752.57, 'CREDIT', TIMESTAMP '2026-09-24 02:35:05', 'Chennai', 'COMPLETED') /* id 55 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (15, 8, 2, 6132.39, 'DEBIT', TIMESTAMP '2026-09-20 23:13:07', 'Mumbai', 'COMPLETED') /* id 56 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (9, 2, 3, 6582.35, 'CREDIT', TIMESTAMP '2026-09-05 07:02:27', 'Bengaluru', 'COMPLETED') /* id 57 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 6, 1, 8425.09, 'TRANSFER', TIMESTAMP '2026-09-26 00:25:20', 'Chennai', 'COMPLETED') /* id 58 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (7, 5, 9, 13075.73, 'CREDIT', TIMESTAMP '2026-09-22 18:29:38', 'Delhi', 'COMPLETED') /* id 59 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 8, 3, 6542.64, 'CREDIT', TIMESTAMP '2026-09-03 07:43:55', 'Chennai', 'COMPLETED') /* id 60 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 4, 4, 14750, 'DEBIT', TIMESTAMP '2026-09-11 06:58:39', 'Pune', 'COMPLETED') /* id 61 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (12, 3, 9, 1168.64, 'DEBIT', TIMESTAMP '2026-09-10 03:52:19', 'Mumbai', 'COMPLETED') /* id 62 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 8, 3, 17897.86, 'CREDIT', TIMESTAMP '2026-09-14 16:13:23', 'Chennai', 'COMPLETED') /* id 63 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (9, 3, 6, 12824.75, 'DEBIT', TIMESTAMP '2026-09-03 21:11:35', 'Bengaluru', 'COMPLETED') /* id 64 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (15, 2, 2, 12171.91, 'TRANSFER', TIMESTAMP '2026-09-02 13:49:42', 'Mumbai', 'COMPLETED') /* id 65 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (18, 7, 1, 6574.44, 'DEBIT', TIMESTAMP '2026-09-15 23:45:08', 'Pune', 'COMPLETED') /* id 66 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (17, 7, 4, 9520.79, 'DEBIT', TIMESTAMP '2026-09-08 17:40:30', 'Delhi', 'COMPLETED') /* id 67 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (7, 1, 9, 382.47, 'DEBIT', TIMESTAMP '2026-09-04 02:13:29', 'Delhi', 'COMPLETED') /* id 68 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (10, 7, 7, 16565.47, 'TRANSFER', TIMESTAMP '2026-09-20 15:33:51', 'Pune', 'COMPLETED') /* id 69 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 7, 10, 2471.91, 'TRANSFER', TIMESTAMP '2026-09-14 16:15:07', 'Bengaluru', 'COMPLETED') /* id 70 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 8, 5, 4204.42, 'TRANSFER', TIMESTAMP '2026-08-29 14:41:22', 'Pune', 'COMPLETED') /* id 71 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (11, 7, 4, 6730.96, 'CREDIT', TIMESTAMP '2026-09-05 21:44:04', 'Bengaluru', 'COMPLETED') /* id 72 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (7, 4, 6, 6989.1, 'TRANSFER', TIMESTAMP '2026-09-04 03:30:24', 'Bengaluru', 'COMPLETED') /* id 73 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (15, 6, 7, 4321.01, 'CREDIT', TIMESTAMP '2026-08-29 14:35:11', 'Delhi', 'COMPLETED') /* id 74 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (18, 8, 11, 5035.44, 'CREDIT', TIMESTAMP '2026-09-10 08:36:50', 'Mumbai', 'COMPLETED') /* id 75 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (16, 5, 11, 13798.7, 'DEBIT', TIMESTAMP '2026-09-01 23:42:24', 'Mumbai', 'COMPLETED') /* id 76 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (6, 2, 8, 4505.48, 'DEBIT', TIMESTAMP '2026-09-11 16:20:14', 'Pune', 'COMPLETED') /* id 77 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (14, 3, 11, 12921.75, 'DEBIT', TIMESTAMP '2026-09-18 15:22:41', 'Mumbai', 'COMPLETED') /* id 78 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (12, 6, 3, 10355.59, 'CREDIT', TIMESTAMP '2026-09-03 01:42:07', 'Chennai', 'COMPLETED') /* id 79 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 3, 11, 4662.95, 'DEBIT', TIMESTAMP '2026-09-24 06:16:17', 'Pune', 'COMPLETED') /* id 80 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 5, 3, 2467.39, 'CREDIT', TIMESTAMP '2026-08-29 06:50:33', 'Bengaluru', 'COMPLETED') /* id 81 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (18, 3, 9, 5541.21, 'CREDIT', TIMESTAMP '2026-09-10 14:47:11', 'Chennai', 'COMPLETED') /* id 82 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 8, 7, 16496.96, 'CREDIT', TIMESTAMP '2026-09-17 07:23:37', 'Pune', 'COMPLETED') /* id 83 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (3, 8, 7, 6210.61, 'CREDIT', TIMESTAMP '2026-09-12 09:38:56', 'Pune', 'COMPLETED') /* id 84 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (6, 3, 4, 14534.59, 'DEBIT', TIMESTAMP '2026-09-02 21:51:35', 'Pune', 'COMPLETED') /* id 85 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (20, 3, 8, 3768.01, 'DEBIT', TIMESTAMP '2026-09-01 03:11:11', 'Mumbai', 'COMPLETED') /* id 86 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (6, 1, 2, 14782.17, 'TRANSFER', TIMESTAMP '2026-09-24 14:21:52', 'Delhi', 'COMPLETED') /* id 87 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 6, 7, 4582.47, 'CREDIT', TIMESTAMP '2026-08-29 17:49:21', 'Pune', 'COMPLETED') /* id 88 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 1, 7, 16397.73, 'TRANSFER', TIMESTAMP '2026-09-06 12:01:53', 'Delhi', 'COMPLETED') /* id 89 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (11, 5, 2, 10184.05, 'DEBIT', TIMESTAMP '2026-09-15 18:30:25', 'Delhi', 'COMPLETED') /* id 90 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (5, 8, 12, 350000, 'TRANSFER', TIMESTAMP '2026-09-27 16:01:47', 'Lagos', 'COMPLETED') /* id 171 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (2, 2, 2, 900, 'DEBIT', TIMESTAMP '2026-09-27 16:50:45', 'Kolkata', 'COMPLETED') /* id 173 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (4, 4, 4, 120000, 'TRANSFER', TIMESTAMP '2026-09-27 16:50:45', 'Bengaluru', 'COMPLETED') /* id 174 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (6, 1, 6, 3000, 'DEBIT', TIMESTAMP '2026-09-27 16:50:45', 'Nagpur', 'COMPLETED') /* id 175 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (6, 3, 6, 2800, 'DEBIT', TIMESTAMP '2026-09-27 16:50:45', 'Nagpur', 'COMPLETED') /* id 176 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (6, 6, 6, 4100, 'DEBIT', TIMESTAMP '2026-09-27 16:50:45', 'Nagpur', 'COMPLETED') /* id 177 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (7, 1, 9, 5000, 'DEBIT', TIMESTAMP '2026-09-27 16:50:45', 'Chandigarh', 'COMPLETED') /* id 178 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (8, 8, 12, 2000, 'DEBIT', TIMESTAMP '2026-09-27 16:50:45', 'Lagos', 'COMPLETED') /* id 179 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (9, 5, 12, 250000, 'TRANSFER', TIMESTAMP '2026-09-27 16:50:46', 'Lagos', 'COMPLETED') /* id 180 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (13, 5, 11, 300000, 'TRANSFER', TIMESTAMP '2026-09-27 16:50:46', 'Unknown', 'COMPLETED') /* id 183 */;
INSERT INTO bank_transaction (account_id, merchant_id, device_id, amount, transaction_type, transaction_time, location, status) VALUES (1, 5, 12, 95000, 'TRANSFER', TIMESTAMP '2026-09-30 10:46:58', 'Lagos', 'COMPLETED') /* id 201 */;

COMMIT;

-- >>>>>>>>>>>>>>>>>>>> 14_demo_customer_profile.sql
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

-- >>>>>>>>>>>>>>>>>>>> 15_api_security.sql
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

-- >>>>>>>>>>>>>>>>>>>> ords_endpoints.sql
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

SELECT 'SmartBank installation finished' AS result FROM dual;
