import { useState } from "react";
import { CheckCircle2, Database, Lock, PlugZap, Shield, XCircle } from "lucide-react";
import {
  API_BASE_URL,
  getAccounts,
  getAlerts,
  getAnalystWorkload,
  getDailyAnalytics,
  getDevices,
  getKPIs,
  getMerchants,
  getRiskDistribution,
  getTransactions,
} from "../api";
import { PageHeader } from "../components/ui";

// Read-only GET endpoints that can be checked without changing data.
const ENDPOINT_CHECKS = [
  { path: "GET /kpis", run: getKPIs },
  { path: "GET /transactions", run: getTransactions },
  { path: "GET /alerts", run: getAlerts },
  { path: "GET /risk-distribution", run: getRiskDistribution },
  { path: "GET /daily-analytics", run: getDailyAnalytics },
  { path: "GET /analysts/workload", run: getAnalystWorkload },
  { path: "GET /accounts", run: () => getAccounts(1) },
  { path: "GET /merchants", run: getMerchants },
  { path: "GET /devices", run: () => getDevices(1) },
];

// Mirrors CALCULATE_RISK and CLASSIFY_RISK in database/05_functions.sql.
const RISK_RULES = [
  { rule: "Amount above ₹1,00,000", points: "+40" },
  { rule: "Amount ₹50,001 – ₹1,00,000", points: "+25" },
  { rule: "Amount ₹20,001 – ₹50,000", points: "+10" },
  { rule: "2+ other transactions on the account in the previous 10 minutes", points: "+25" },
  { rule: "1 other transaction in the previous 10 minutes", points: "+15" },
  { rule: "Device never used before by this account", points: "+20" },
  { rule: "Location differs from the customer’s address city", points: "+20" },
];

function AdminSettings() {
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState(false);

  async function runChecks() {
    setTesting(true);
    setResults({});

    await Promise.all(
      ENDPOINT_CHECKS.map(async ({ path, run }) => {
        const started = performance.now();

        try {
          const body = await run();
          const rows = Array.isArray(body) ? `${body.length} rows` : "OK";
          setResults((r) => ({ ...r, [path]: { ok: true, text: `${rows} · ${Math.round(performance.now() - started)} ms` } }));
        } catch (err) {
          setResults((r) => ({ ...r, [path]: { ok: false, text: err.message } }));
        }
      })
    );

    setTesting(false);
  }

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

          <p className="muted">
            Base URL: <code>{API_BASE_URL}</code>. The test only sends read-only GET requests.
          </p>

          <ul className="endpoint-list">
            {ENDPOINT_CHECKS.map(({ path }) => {
              const result = results[path];

              return (
                <li key={path}>
                  <code>{path}</code>
                  {result ? (
                    <span className={result.ok ? "ok" : "fail"}>
                      {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      {result.text}
                    </span>
                  ) : (
                    <span className="idle">{testing ? "…" : "Not tested"}</span>
                  )}
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

          <p className="muted">
            Thresholds are defined in the database (CALCULATE_RISK / CLASSIFY_RISK) and are
            shown read-only here. Score is capped at 100.
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
            <div><span>Database</span><strong>Oracle Database 21c XE (XEPDB1)</strong></div>
            <div><span>Schema</span><strong>SMARTBANK_USER · 12 tables</strong></div>
            <div><span>Triggers</span><strong>TRG_VALIDATE_TRANSACTION, TRG_FRAUD_MONITOR</strong></div>
            <div><span>Package</span><strong>PKG_FRAUD_DETECTION</strong></div>
            <div><span>Cursor workflow</span><strong>REVIEW_HIGH_RISK_ALERTS</strong></div>
            <div><span>API layer</span><strong>Oracle REST Data Services</strong></div>
          </div>
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
            <li>Sign-in uses two demo accounts checked in the browser. It is not secure authentication.</li>
            <li>The ORDS module is published without OAuth, so anyone who can reach the API can call it. Keep ORDS on localhost.</li>
            <li>Role separation (customer vs analyst) is enforced only in the user interface.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

export default AdminSettings;
