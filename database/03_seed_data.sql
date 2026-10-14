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
