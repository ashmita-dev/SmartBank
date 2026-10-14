import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { createTransaction, getAlerts, getDevices, getMerchants, getTransactions } from "../api";
import { ErrorBanner, LoadingState, PageHeader, RiskBadge, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import useApiData from "../hooks/useApiData";
import { loadCustomerData } from "../utils/customerData";
import { formatCurrency } from "../utils/format";

async function loadTransferData(customerId) {
  const [customer, merchants, devices] = await Promise.all([
    loadCustomerData(customerId),
    getMerchants().catch((err) => ({ error: err })),
    getDevices(customerId).catch((err) => ({ error: err })),
  ]);

  return { ...customer, merchants, devices };
}

// Older ORDS handler returns 201 with no body: look the new row up instead.
async function findCreatedTransaction(accountNumber, accountId, previousMaxId) {
  const rows = await getTransactions(accountNumber);
  const created = rows
    .filter((t) => Number(t.account_id) === Number(accountId) && Number(t.transaction_id) > previousMaxId)
    .sort((a, b) => Number(b.transaction_id) - Number(a.transaction_id))[0];

  if (!created) return null;

  const alerts = await getAlerts();
  const alert = alerts.find((a) => Number(a.transaction_id) === Number(created.transaction_id));

  return {
    transaction_id: created.transaction_id,
    transaction_status: created.transaction_status,
    alert: alert || null,
  };
}

const EMPTY_FORM = { accountId: "", merchantId: "", deviceId: "", amount: "", location: "" };

function UserTransfer() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useApiData(
    () => loadTransferData(user.customerId),
    [user.customerId]
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  if (loading) {
    return <LoadingState text="Preparing transfer form…" />;
  }

  const accounts = data?.accounts || [];
  const merchants = Array.isArray(data?.merchants) ? data.merchants : [];
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  const referenceError = data?.merchants?.error || data?.devices?.error;
  const homeCity = accounts.find((a) => a.home_city)?.home_city || "";

  const accountId = form.accountId || String(accounts[0]?.account_id ?? "");

  // CALCULATE_RISK treats a device as recognised only if it was used before
  // on the same account, so derive that from the account's own history.
  const accountDevices = new Set(
    (data?.transactions || [])
      .filter((t) => String(t.account_id) === accountId && t.device_identifier)
      .map((t) => t.device_identifier)
  );
  const isRecognised = (device) => accountDevices.has(device.device_identifier);

  const values = {
    ...form,
    accountId,
    deviceId: form.deviceId || String(devices.find(isRecognised)?.device_id ?? ""),
    location: form.location || homeCity,
  };

  const selectedAccount = accounts.find((a) => String(a.account_id) === values.accountId);
  const selectedDevice = devices.find((d) => String(d.device_id) === values.deviceId);
  const amount = Number(values.amount);
  const canSubmit =
    !referenceError && !error && values.accountId && values.merchantId && values.deviceId &&
    amount > 0 && values.location.trim() && !submitting;

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, ...values, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    const previousMaxId = Math.max(0, ...(data?.transactions || []).map((t) => Number(t.transaction_id)));

    try {
      let outcome = await createTransaction({
        account_id: Number(values.accountId),
        merchant_id: Number(values.merchantId),
        device_id: Number(values.deviceId),
        amount,
        transaction_type: "TRANSFER",
        location: values.location.trim(),
      });

      if (!outcome?.transaction_id) {
        outcome = await findCreatedTransaction(selectedAccount?.account_number, values.accountId, previousMaxId);
      }

      if (!outcome) {
        throw new Error("The API accepted the request but the new transaction could not be found. Refresh your transactions to check.");
      }

      setResult({
        ...outcome,
        amount,
        accountNumber: selectedAccount?.account_number,
        merchant: merchants.find((m) => String(m.merchant_id) === values.merchantId)?.merchant_name,
      });
      refresh();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setForm(EMPTY_FORM);
  }

  return (
    <>
      <PageHeader
        eyebrow="MONEY TRANSFER"
        title="New Transfer"
        description="Submits a TRANSFER transaction to Oracle through POST /transactions. The fraud-monitoring trigger scores it the moment it is inserted."
      />

      <ErrorBanner error={error} onRetry={refresh} />

      <div className="notice info" role="note">
        <Info size={17} />
        <div>
          <strong>Demonstration scope:</strong> the transfer is recorded in BANK_TRANSACTION and screened
          by the fraud engine, but account balances are not debited or credited. No real money moves.
        </div>
      </div>

      {referenceError && (
        <ErrorBanner
          error={{
            message: `The transfer form needs the GET /merchants and /devices endpoints. ${referenceError.message}`,
          }}
          onRetry={refresh}
        />
      )}

      <section className="settings-grid">
        <div className="panel settings-panel">
          {result ? (
            <TransferResult result={result} onReset={reset} />
          ) : (
            <form className="transfer-form" onSubmit={handleSubmit} noValidate>
              <div className="panel-header">
                <div>
                  <div className="section-label">TRANSFER DETAILS</div>
                  <h3>Send a transfer</h3>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="accountId">From account</label>
                <select id="accountId" name="accountId" value={values.accountId} onChange={update} required>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={String(a.account_id)}>
                      {a.account_number}
                      {a.account_type ? ` · ${a.account_type}` : ""}
                      {a.balance != null ? ` · ${formatCurrency(a.balance)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="merchantId">Payee (merchant)</label>
                <select id="merchantId" name="merchantId" value={values.merchantId} onChange={update} required>
                  <option value="">Select a payee…</option>
                  {merchants.map((m) => (
                    <option key={m.merchant_id} value={String(m.merchant_id)}>
                      {m.merchant_name} · {m.category}
                      {m.risk_level && m.risk_level !== "LOW" ? ` · ${m.risk_level} risk merchant` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="amount">Amount (₹)</label>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="0.01"
                    value={values.amount}
                    onChange={update}
                    placeholder="e.g. 2500"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    maxLength={100}
                    value={values.location}
                    onChange={update}
                    placeholder="City"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="deviceId">Device</label>
                <select id="deviceId" name="deviceId" value={values.deviceId} onChange={update} required>
                  {devices.map((d) => (
                    <option key={d.device_id} value={String(d.device_id)}>
                      {d.device_identifier} · {d.device_type}
                      {isRecognised(d) ? " · used on this account" : " · new for this account"}
                    </option>
                  ))}
                </select>
              </div>

              <RiskPreview
                amount={amount}
                deviceIsNew={Boolean(selectedDevice) && !isRecognised(selectedDevice)}
                location={values.location}
                homeCity={homeCity}
              />

              <ErrorBanner error={submitError} />

              <button type="submit" className="primary-action transfer-button" disabled={!canSubmit}>
                {submitting ? "Submitting to Oracle…" : "Submit transfer"}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
          )}
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">WHAT HAPPENS NEXT</div>
              <h3>Fraud screening pipeline</h3>
            </div>
            <div className="panel-icon purple">
              <ShieldCheck size={20} />
            </div>
          </div>

          <ol className="pipeline-steps">
            <li><strong>TRG_VALIDATE_TRANSACTION</strong> rejects inactive accounts and amounts above ₹1,00,00,000.</li>
            <li><strong>TRG_FRAUD_MONITOR</strong> calls DETECT_FRAUD for the new row.</li>
            <li><strong>CALCULATE_RISK</strong> scores amount, velocity, device and location (0–100).</li>
            <li>Score 40+ creates a <strong>FRAUD_ALERT</strong> for the least-loaded analyst; 70+ also marks the transaction <strong>FLAGGED</strong>.</li>
          </ol>
        </div>
      </section>
    </>
  );
}

// Client-side hint only; the authoritative score comes from CALCULATE_RISK.
function RiskPreview({ amount, deviceIsNew, location, homeCity }) {
  const signals = [];

  if (amount > 100000) signals.push("Amount above ₹1,00,000 (+40)");
  else if (amount > 50000) signals.push("Amount above ₹50,000 (+25)");
  else if (amount > 20000) signals.push("Amount above ₹20,000 (+10)");

  if (deviceIsNew) signals.push("Device never used on this account (+20)");
  if (homeCity && location.trim() && location.trim().toLowerCase() !== homeCity.toLowerCase()) {
    signals.push(`Location differs from your home city, ${homeCity} (+20)`);
  }

  return (
    <div className={`risk-preview ${signals.length ? "warn" : ""}`}>
      {signals.length ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
      <div>
        <strong>{signals.length ? "Expected risk signals" : "No obvious risk signals"}</strong>
        {signals.length > 0 && (
          <ul>
            {signals.map((s) => <li key={s}>{s}</li>)}
          </ul>
        )}
        <span>Preview only. Recent-activity velocity is also scored by the database.</span>
      </div>
    </div>
  );
}

function TransferResult({ result, onReset }) {
  const alert = result.alert;

  return (
    <div className="transfer-success">
      <div className={`success-icon ${alert ? "warn" : ""}`}>
        {alert ? <AlertTriangle size={30} /> : <CheckCircle2 size={30} />}
      </div>

      <h2>Transaction #{result.transaction_id} recorded</h2>

      <p>
        {formatCurrency(result.amount)} TRANSFER from {result.accountNumber}
        {result.merchant ? ` to ${result.merchant}` : ""} was inserted into BANK_TRANSACTION with
        status <StatusBadge status={result.transaction_status} />
      </p>

      {alert ? (
        <div className="result-alert">
          <div>
            <RiskBadge level={alert.risk_level} />
            <strong>Risk score {alert.risk_score}/100</strong>
          </div>
          <p>Fraud alert #{alert.alert_id} was created for analyst review.</p>
          <small>{alert.reason}</small>
        </div>
      ) : (
        <p className="muted">
          No fraud alert was raised: the risk score was below the MEDIUM threshold of 40.
        </p>
      )}

      <p className="muted">Account balances were not changed (demonstration scope).</p>

      <div className="modal-actions">
        <Link className="secondary-action" to="/user/transactions">
          View my transactions
        </Link>
        <button type="button" className="primary-action" onClick={onReset}>
          New transfer
        </button>
      </div>
    </div>
  );
}

export default UserTransfer;
