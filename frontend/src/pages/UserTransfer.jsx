import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  ShieldCheck,
  User,
} from "lucide-react";

function UserTransfer() {
  const [form, setForm] = useState({
    recipient: "",
    accountNumber: "",
    amount: "",
    note: "",
  });

  const [submitted, setSubmitted] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.recipient ||
      !form.accountNumber ||
      !form.amount
    ) {
      return;
    }

    setSubmitted(true);
  }

  function resetTransfer() {
    setForm({
      recipient: "",
      accountNumber: "",
      amount: "",
      note: "",
    });

    setSubmitted(false);
  }

  return (
    <>
      <section className="page-header">
        <div className="section-label">
          MONEY TRANSFER
        </div>

        <h1>Transfer Money</h1>

        <p>
          Transfer funds to another SmartBank account using
          the secure banking interface.
        </p>
      </section>

      <section className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                NEW TRANSFER
              </div>

              <h3>Transfer Details</h3>
            </div>

            <div className="panel-icon cyan">
              <CreditCard size={20} />
            </div>
          </div>

          {!submitted ? (
            <form
              className="transfer-form"
              onSubmit={handleSubmit}
            >
              <div className="form-group">
                <label htmlFor="recipient">
                  Recipient Name
                </label>

                <div className="input-with-icon">
                  <User size={17} />

                  <input
                    id="recipient"
                    name="recipient"
                    type="text"
                    value={form.recipient}
                    onChange={handleChange}
                    placeholder="Enter recipient name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="accountNumber">
                  Account Number
                </label>

                <div className="input-with-icon">
                  <CreditCard size={17} />

                  <input
                    id="accountNumber"
                    name="accountNumber"
                    type="text"
                    value={form.accountNumber}
                    onChange={handleChange}
                    placeholder="Enter account number"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="amount">
                  Amount
                </label>

                <div className="input-with-icon">
                  <IndianRupee size={17} />

                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="note">
                  Transfer Note
                </label>

                <textarea
                  id="note"
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  placeholder="Optional note"
                  rows="3"
                />
              </div>

              <div className="security-note">
                <ShieldCheck size={18} />

                <span>
                  Transfers are protected by SmartBank's
                  transaction monitoring and fraud detection
                  system.
                </span>
              </div>

              <button
                type="submit"
                className="primary-action transfer-button"
              >
                Continue Transfer
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <div className="transfer-success">
              <div className="success-icon">
                <CheckCircle2 size={32} />
              </div>

              <h2>Transfer Request Created</h2>

              <p>
                Your transfer request for{" "}
                <strong>
                  ₹
                  {Number(form.amount).toLocaleString(
                    "en-IN"
                  )}
                </strong>{" "}
                to{" "}
                <strong>{form.recipient}</strong> has been
                prepared successfully.
              </p>

              <span>
                Account ending in{" "}
                {form.accountNumber.slice(-4)}
              </span>

              <button
                className="primary-action"
                onClick={resetTransfer}
              >
                Make Another Transfer
              </button>
            </div>
          )}
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">
                SECURITY
              </div>

              <h3>SmartBank Protection</h3>
            </div>

            <div className="panel-icon purple">
              <ShieldCheck size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div>
              <span>Fraud Monitoring</span>
              <strong className="online-text">
                ACTIVE
              </strong>
            </div>

            <div>
              <span>Transaction Screening</span>
              <strong className="online-text">
                ENABLED
              </strong>
            </div>

            <div>
              <span>Risk Evaluation</span>
              <strong>PL/SQL Engine</strong>
            </div>

            <div>
              <span>Database</span>
              <strong>Oracle 21c XE</strong>
            </div>
          </div>

          <div className="security-note">
            <ShieldCheck size={18} />

            <span>
              Suspicious transactions can automatically
              generate fraud alerts for analyst review.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

export default UserTransfer;