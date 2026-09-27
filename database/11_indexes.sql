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