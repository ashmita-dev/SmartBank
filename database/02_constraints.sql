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