import { useRef, useState } from "react";
import { CheckCircle2, Clock, Database, Loader2, Lock, PlugZap, Shield, XCircle } from "lucide-react";
import {
  API_BASE_URL,
  DATABASE_LABEL,
  getAccounts,
  getAlerts,
  getAnalystWorkload,
  getCustomer,
  getDailyAnalytics,
  getDevices,
  getHealth,
  getKPIs,
  getMerchants,
  getRiskDistribution,
  getTransactions,
} from "../api";
import { PageHeader } from "../components/ui";
import { formatDate } from "../utils/format";

// Read-only GET endpoints that can be checked without changing data.
const ENDPOINT_CHECKS = [
  { path: "GET /health", run: getHealth },
  { path: "GET /kpis", run: getKPIs },
  { path: "GET /transactions", run: getTransactions },
  { path: "GET /alerts", run: getAlerts },
  { path: "GET /risk-distribution", run: getRiskDistribution },
  { path: "GET /daily-analytics", run: getDailyAnalytics },
  { path: "GET /analysts/workload", run: getAnalystWorkload },
  { path: "GET /accounts", run: () => getAccounts(1) },
  { path: "GET /merchants", run: getMerchants },
  { path: "GET /devices", run: () => getDevices(1) },
  { path: "GET /customers/:id", run: () => getCustomer(1) },
];

// Mirrors CALCULATE_RISK and CLASSIFY_RISK in database/05_functions.sql.
const RISK_RULES = [
  { rule: "Amount above ₹1,00,000", points: "+40" },
  { rule: "Amount ₹50,001 – ₹1,00,000", points: "+25" },
  { rule: "Amount ₹20,001 – ₹50,000", points: "+10" },
  { rule: "2+ other transactions on the account in the previous 10 minutes", points: "+25" },
  { rule: "1 other transaction in the previous 10 minutes", points: "+15" },
  { rule: "Device never used before by this account", points: "+20" },
  { rule: "Location matches none of the customer’s address cities", points: "+20" },
];

// Confirmed in the live SMARTBANK_USER schema on 14 Oct 2026 with a read-only
// DBA_OBJECTS query: every object below exists with STATUS = VALID.
// The browser cannot query the data dictionary, so this is a dated record.
const DB_OBJECTS = [
  { kind: "Tables (12)", names: "CUSTOMER, CUSTOMER_ADDRESS, INDIVIDUAL_CUSTOMER, BUSINESS_CUSTOMER, ACCOUNT, SAVINGS_ACCOUNT, CURRENT_ACCOUNT, MERCHANT, DEVICE, BANK_TRANSACTION, FRAUD_ANALYST, FRAUD_ALERT" },
  { kind: "Functions", names: "CALCULATE_RISK, CLASSIFY_RISK" },
  { kind: "Procedures", names: "DETECT_FRAUD, GENERATE_ALERT, REVIEW_HIGH_RISK_ALERTS (explicit cursor, FOR UPDATE)" },
  { kind: "Triggers", names: "TRG_VALIDATE_TRANSACTION (before insert), TRG_FRAUD_MONITOR (compound)" },
  { kind: "Package", names: "PKG_FRAUD_DETECTION (spec + body)" },
  { kind: "Views", names: "V_DAILY_TRANSACTION_ANALYTICS, V_FRAUD_ALERT_SUMMARY, V_HIGH_RISK_TRANSACTIONS, V_CUSTOMER_TRANSACTION_SUMMARY" },
  { kind: "Indexes", names: "6 lookup indexes on BANK_TRANSACTION and FRAUD_ALERT, plus 6 unique-constraint indexes" },
];

const STATE_LABEL = { pending: "Not tested", testing: "Testing…", healthy: "Healthy", failed: "Failed" };

function AdminSettings() {
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  // Prevents overlapping runs even if the button is clicked twice quickly.
  const runningRef = useRef(false);

  async function runChecks() {
    if (runningRef.current) return;
    runningRef.current = true;
    setTesting(true);
    setResults(Object.fromEntries(ENDPOINT_CHECKS.map(({ path }) => [path, { state: "testing" }])));

    await Promise.all(
      ENDPOINT_CHECKS.map(async ({ path, run }) => {
        const started = performance.now();

        try {
          const body = await run();
          const ms = Math.round(performance.now() - started);
          const rows = Array.isArray(body) ? `${body.length} row${body.length === 1 ? "" : "s"}` : "1 record";
          setResults((r) => ({ ...r, [path]: { state: "healthy", code: 200, text: `${rows} · ${ms} ms` } }));
        } catch (err) {
          setResults((r) => ({
            ...r,
            [path]: { state: "failed", code: err.status || null, text: err.message },
          }));
        }
      })
    );

    setLastRun(new Date());
    setTesting(false);
    runningRef.current = false;
  }

  const values = Object.values(results);
  const healthy = values.filter((r) => r.state === "healthy").length;
  const failed = values.filter((r) => r.state === "failed").length;

  return (
    <>
      <PageHeader
        eyebrow="SYSTEM"
        title="System & Settings"
        description="Connection diagnostics, the fraud scoring model implemented in PL/SQL, and the limits of this demonstration build."
      />

      <section className="settings-grid">
        <div className="panel settings-panel span-2">
          <div className="panel-header">
            <div>
              <div className="section-label">ORDS CONNECTION</div>
              <h3>API diagnostics</h3>
            </div>

            <button type="button" className="primary-action" onClick={runChecks} disabled={testing}>
              <PlugZap size={16} />
              {testing ? "Testing…" : "Test all endpoints"}
            </button>
          </div>

          <div className="diag-summary">
            <div><span>API base URL</span><code>{API_BASE_URL || "Not configured in this build"}</code></div>
            <div>
              <span>Last tested</span>
              <strong>{lastRun ? formatDate(lastRun) : "Not yet in this session"}</strong>
            </div>
            <div>
              <span>Result</span>
              <strong>
                {testing
                  ? "Testing…"
                  : lastRun
                    ? `${healthy} healthy · ${failed} failed of ${ENDPOINT_CHECKS.length}`
                    : "—"}
              </strong>
            </div>
          </div>

          <p className="muted">
            Each check sends one real, read-only GET request to Oracle through ORDS. Nothing is
            written. An endpoint is shown healthy only when it answered with HTTP 200 and valid JSON.
          </p>

          <ul className="endpoint-list">
            {ENDPOINT_CHECKS.map(({ path }) => {
              const result = results[path] || { state: "pending" };
              const Icon = { pending: Clock, testing: Loader2, healthy: CheckCircle2, failed: XCircle }[result.state];

              return (
                <li key={path}>
                  <div className="endpoint-head">
                    <code>{path}</code>
                    <span className={`endpoint-state ${result.state}`}>
                      <Icon size={14} className={result.state === "testing" ? "spin" : undefined} />
                      {STATE_LABEL[result.state]}
                      {result.code ? ` · HTTP ${result.code}` : result.state === "failed" ? " · no response" : ""}
                    </span>
                  </div>
                  {result.text && <span className={`endpoint-detail ${result.state}`}>{result.text}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">FRAUD ENGINE</div>
              <h3>Risk scoring model</h3>
            </div>
            <div className="panel-icon red">
              <Shield size={20} />
            </div>
          </div>

          <table className="rules-table">
            <tbody>
              {RISK_RULES.map(({ rule, points }) => (
                <tr key={rule}>
                  <td>{rule}</td>
                  <td className="num">{points}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="risk-bands">
            <span className="risk-badge low">LOW 0–39 · no alert</span>
            <span className="risk-badge medium">MEDIUM 40–69 · alert</span>
            <span className="risk-badge high">HIGH 70–100 · alert + FLAGGED</span>
          </div>

          <ol className="engine-steps">
            <li>A row is inserted into BANK_TRANSACTION (for example by New Transfer).</li>
            <li>TRG_VALIDATE_TRANSACTION rejects inactive accounts and amounts over ₹1,00,00,000.</li>
            <li>TRG_FRAUD_MONITOR calls DETECT_FRAUD, which totals the points above with CALCULATE_RISK (capped at 100) and names the band with CLASSIFY_RISK.</li>
            <li>MEDIUM or HIGH: GENERATE_ALERT inserts a FRAUD_ALERT with the reasons and assigns the analyst with the fewest open alerts.</li>
            <li>HIGH only: the transaction status becomes FLAGGED. A MEDIUM alert leaves the payment COMPLETED while it is reviewed.</li>
          </ol>

          <p className="muted">
            The score is a <strong>rule-based point total</strong>, not a probability and not a
            machine-learning prediction. A high score means “worth a human look”; only an analyst’s
            decision (Confirm fraud / False positive) records whether fraud actually happened. The
            rules are copied read-only from CALCULATE_RISK and CLASSIFY_RISK (database/05_functions.sql).
          </p>
        </div>

        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <div className="section-label">ARCHITECTURE</div>
              <h3>Database objects</h3>
            </div>
            <div className="panel-icon purple">
              <Database size={20} />
            </div>
          </div>

          <div className="system-info-list">
            <div><span>Database</span><strong>{DATABASE_LABEL}, schema SMARTBANK_USER</strong></div>
            <div><span>API layer</span><strong>Oracle REST Data Services, module smartbank.api (session-authenticated)</strong></div>
            {DB_OBJECTS.map(({ kind, names }) => (
              <div key={kind}><span>{kind}</span><strong>{names}</strong></div>
            ))}
          </div>

          <p className="muted">
            Verified in the live schema on 14 Oct 2026 with a read-only data-dictionary query: every
            object above exists and is VALID. The browser cannot read the data dictionary, so this is a
            dated record; re-check with <code>SELECT object_type, object_name, status FROM user_objects</code>{" "}
            after changing the database.
          </p>
        </div>

        <div className="panel settings-panel span-2">
          <div className="panel-header">
            <div>
              <div className="section-label">SECURITY</div>
              <h3>Demonstration limits</h3>
            </div>
            <div className="panel-icon purple">
              <Lock size={20} />
            </div>
          </div>

          <ul className="limits-list">
            <li><strong>Server-side sign-in.</strong> Passwords are checked in Oracle against salted PBKDF2-SHA256 hashes, and Oracle issues an 8-hour session token. Only a hash of each token is stored.</li>
            <li><strong>Roles are enforced by the database.</strong> Every API handler checks the session: customers cannot read analyst dashboards or change alerts, and analysts cannot submit customer transfers.</li>
            <li><strong>Customer isolation is enforced in SQL.</strong> A customer session only ever receives that customer&apos;s accounts, transactions, alerts and profile, whatever it asks for.</li>
            <li><strong>Shared demo logins.</strong> The two demonstration accounts are shared by everyone who is given the password, so this is access control for a demo, not for real customers. Write requests are rate-limited.</li>
            <li><strong>Transfers do not move money.</strong> New Transfer records a transaction and screens it for fraud; account balances are not debited or credited.</li>
            <li><strong>Rule-based detection.</strong> A risk score points to patterns worth reviewing. It does not prove fraud, and a low score does not prove a payment is safe.</li>
            <li><strong>For production</strong> a bank would use individual accounts with an identity provider (OAuth2/OIDC, multi-factor sign-in), audited administrative access and a web application firewall.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

export default AdminSettings;
