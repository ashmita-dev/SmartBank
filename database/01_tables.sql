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
