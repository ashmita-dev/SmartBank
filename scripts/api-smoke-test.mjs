// SmartBank API end-to-end check (Node 18+, no dependencies).
//
// Read-only by default: health, authentication, role enforcement, customer
// scoping, CORS and input validation (rejected requests never insert rows).
// With --write it also runs the documented live demonstration test: ONE
// low-risk and ONE high-risk transfer for the demo customer, verifies the
// fraud engine's result end to end, and moves only the alert created by the
// test to INVESTIGATING. Nothing else is modified.
//
// Configuration comes from environment variables, so passwords never appear
// on the command line or in shell history:
//   SMARTBANK_API_URL           e.g. https://<adb-host>/ords/sb/api
//   SMARTBANK_CUSTOMER_EMAIL    default user@smartbank.com
//   SMARTBANK_CUSTOMER_PASSWORD
//   SMARTBANK_ANALYST_EMAIL     default admin@smartbank.com
//   SMARTBANK_ANALYST_PASSWORD
//   SMARTBANK_ORIGIN            default https://ashmita-dev.github.io
//
//   node scripts/api-smoke-test.mjs            read-only checks
//   node scripts/api-smoke-test.mjs --write    plus the live transaction test
import process from "node:process";

const env = process.env;
const API = (env.SMARTBANK_API_URL || "").replace(/\/+$/, "");
const ORIGIN = env.SMARTBANK_ORIGIN || "https://ashmita-dev.github.io";
const WRITE = process.argv.includes("--write");

if (!API) {
  console.error("Set SMARTBANK_API_URL first.");
  process.exit(2);
}

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  return ok;
}

async function call(method, path, { token, body, raw, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Origin: ORIGIN,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Session-Token": token } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

async function login(email, password) {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  return r.status === 200 ? r.json : null;
}

const minutes = (a, b) => (a - b) / 60000;

// Mirrors CALCULATE_RISK (database/05_functions.sql) using API data, so the
// test can say what the database SHOULD return before it inserts anything.
function expectedRisk({ amount, accountId, deviceIdentifier, location, homeCities, history, now }) {
  let score = 0;
  const reasons = [];
  if (amount > 100000) score += 40;
  else if (amount > 50000) score += 25;
  else if (amount > 20000) score += 10;
  if (amount > 50000) reasons.push("High transaction amount");

  const onAccount = history.filter((t) => Number(t.account_id) === Number(accountId));
  const recent = onAccount.filter((t) => {
    const age = minutes(now, new Date(t.transaction_time));
    return age >= 0 && age <= 10;
  }).length;
  if (recent >= 2) score += 25;
  else if (recent === 1) score += 15;
  if (recent >= 1) reasons.push("Multiple transactions in short period");

  if (!onAccount.some((t) => t.device_identifier === deviceIdentifier)) {
    score += 20;
    reasons.push("Unrecognized device");
  }
  if (!homeCities.some((c) => c.toUpperCase() === location.toUpperCase())) {
    score += 20;
    reasons.push("Unusual transaction location");
  }
  score = Math.min(score, 100);
  const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  return { score, level, reasons, recent };
}

async function main() {
  console.log(`SmartBank API check against ${API}${WRITE ? " (with live write test)" : " (read-only)"}\n`);

  // ---- Public health -------------------------------------------------
  const health = await call("GET", "/health");
  check("GET /health is public and healthy", health.status === 200 && health.json?.status === "ok",
    `HTTP ${health.status}, fraud_engine=${health.json?.fraud_engine}`);

  // ---- Authentication -------------------------------------------------
  check("GET /transactions without a session is refused", (await call("GET", "/transactions")).status === 401);
  check("A forged session token is refused",
    (await call("GET", "/transactions", { token: "a".repeat(64) })).status === 401);
  const wrong = await call("POST", "/auth/login", {
    body: { email: env.SMARTBANK_CUSTOMER_EMAIL || "user@smartbank.com", password: "definitely-wrong" },
  });
  check("Wrong password is refused", wrong.status === 401 && !wrong.json?.token);
  check("Malformed login body is rejected", (await call("POST", "/auth/login", { raw: "not json" })).status === 400);

  const cust = await login(env.SMARTBANK_CUSTOMER_EMAIL || "user@smartbank.com", env.SMARTBANK_CUSTOMER_PASSWORD || "");
  const anal = await login(env.SMARTBANK_ANALYST_EMAIL || "admin@smartbank.com", env.SMARTBANK_ANALYST_PASSWORD || "");
  if (!check("Customer demo login succeeds", cust?.user?.role === "customer" && /^[0-9a-f]{64}$/.test(cust?.token || ""))) return;
  if (!check("Analyst demo login succeeds", anal?.user?.role === "analyst")) return;
  const ct = cust.token;
  const at = anal.token;
  const customerId = cust.user.customer_id;

  const session = await call("GET", "/auth/session", { token: ct });
  check("GET /auth/session returns the signed-in user", session.status === 200 && session.json?.user?.customer_id === customerId);

  // ---- Role enforcement and customer scoping --------------------------
  check("Customer cannot read analyst KPIs", (await call("GET", "/kpis", { token: ct })).status === 403);
  check("Customer cannot read analyst workload", (await call("GET", "/analysts/workload", { token: ct })).status === 403);
  check("Customer cannot read another customer's profile",
    (await call("GET", `/customers/${customerId === 2 ? 3 : 2}`, { token: ct })).status === 403);

  const custTxns = await call("GET", "/transactions", { token: ct });
  const own = custTxns.json?.items || [];
  check("Customer sees only their own transactions",
    custTxns.status === 200 && own.length > 0 && own.every((t) => t.customer_id === customerId), `${own.length} rows`);
  const custAccounts = await call("GET", "/accounts?customer_id=2", { token: ct });
  check("Customer account list ignores other customer_id values",
    (custAccounts.json?.items || []).every((a) => a.customer_id === customerId));
  const custAlerts = await call("GET", "/alerts", { token: ct });
  check("Customer sees only alerts on their own transactions",
    (custAlerts.json?.items || []).every((a) => a.customer_id === customerId));

  // ---- Analyst reads ----------------------------------------------------
  const analystReads = ["/kpis", "/transactions", "/alerts", "/risk-distribution", "/daily-analytics",
    "/analysts/workload", "/accounts", "/merchants", "/devices", `/customers/${customerId}`];
  for (const path of analystReads) {
    const r = await call("GET", path, { token: at });
    check(`Analyst GET ${path}`, r.status === 200 && r.json && !r.json.error,
      Array.isArray(r.json?.items) ? `${r.json.items.length} rows` : "object");
  }
  const kpis = (await call("GET", "/kpis", { token: at })).json;
  const allAlerts = (await call("GET", "/alerts", { token: at })).json?.items || [];
  check("Analyst sees every alert", allAlerts.length === kpis?.flagged_transactions, `${allAlerts.length} alerts`);

  // ---- CORS -------------------------------------------------------------
  const preflight = await fetch(`${API}/transactions`, {
    method: "OPTIONS",
    headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-session-token" },
  });
  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  check("CORS preflight allows the GitHub Pages origin", allowOrigin === ORIGIN || allowOrigin === "*",
    `allow-origin=${allowOrigin}, allow-headers=${preflight.headers.get("access-control-allow-headers")}`);
  const evil = await fetch(`${API}/health`, { headers: { Origin: "https://evil.example" } });
  const evilAllow = evil.headers.get("access-control-allow-origin");
  check("CORS does not allow an unknown origin", !evilAllow || evilAllow === "null", `allow-origin=${evilAllow}`);

  // ---- Validation (all rejected: nothing is inserted) -------------------
  const accounts = (await call("GET", "/accounts", { token: ct })).json?.items || [];
  const merchants = (await call("GET", "/merchants", { token: ct })).json?.items || [];
  const devices = (await call("GET", "/devices", { token: ct })).json?.items || [];
  const account = accounts.find((a) => a.status === "ACTIVE") || accounts[0];
  const base = { account_id: account.account_id, merchant_id: merchants[0].merchant_id,
    device_id: devices[0].device_id, amount: 100, transaction_type: "TRANSFER", location: "Mumbai" };
  const otherAccount = (await call("GET", "/accounts", { token: at })).json.items.find((a) => a.customer_id !== customerId);
  const invalid = [
    ["missing amount", { ...base, amount: undefined }, 400],
    ["negative amount", { ...base, amount: -5 }, 400],
    ["three decimals", { ...base, amount: 10.123 }, 400],
    ["amount above the trigger limit", { ...base, amount: 10000001 }, 400],
    ["amount as text", { ...base, amount: "100" }, 400],
    ["location with markup", { ...base, location: "<script>" }, 400],
    ["unknown transaction type", { ...base, transaction_type: "REFUND" }, 400],
    ["unknown merchant", { ...base, merchant_id: 999999 }, 400],
    ["another customer's account", { ...base, account_id: otherAccount.account_id }, 404],
  ];
  const before = kpis.total_transactions;
  for (const [name, body, status] of invalid) {
    const r = await call("POST", "/transactions", { token: ct, body });
    check(`Rejects ${name}`, r.status === status, `HTTP ${r.status}: ${r.json?.error}`);
  }
  check("Rejects a non-JSON body", (await call("POST", "/transactions", { token: ct, raw: "{oops" })).status === 400);
  check("Analyst cannot create customer transactions",
    (await call("POST", "/transactions", { token: at, body: base })).status === 403);
  check("Unauthenticated POST /transactions is refused",
    (await call("POST", "/transactions", { body: base })).status === 401);
  check("Customer cannot change alert status",
    (await call("PUT", `/alerts/${allAlerts[0].alert_id}`, { token: ct, body: { status: "CLOSED" } })).status === 403);
  check("Invalid alert status is rejected",
    (await call("PUT", `/alerts/${allAlerts[0].alert_id}`, { token: at, body: { status: "DELETED" } })).status === 400);
  const after = (await call("GET", "/kpis", { token: at })).json.total_transactions;
  check("Rejected requests inserted nothing", after === before, `${before} -> ${after}`);

  // ---- Live write test ---------------------------------------------------
  if (WRITE) {
    const profile = (await call("GET", `/customers/${customerId}`, { token: ct })).json;
    const homeCities = [profile.home_city].filter(Boolean);
    const accountTxns = () => call("GET", "/transactions", { token: ct }).then((r) => r.json.items);
    const usedDevice = devices.find((d) => own.some((t) =>
      Number(t.account_id) === Number(account.account_id) && t.device_identifier === d.device_identifier));
    const newDevice = devices.find((d) => !own.some((t) =>
      Number(t.account_id) === Number(account.account_id) && t.device_identifier === d.device_identifier));
    const merchant = merchants.find((m) => m.risk_level === "HIGH") || merchants[0];

    const cases = [
      { label: "LOW-risk test transfer", amount: 500, device: usedDevice, location: homeCities[0] },
      { label: "HIGH-risk test transfer", amount: 150000, device: newDevice, location: "Lagos" },
    ];

    for (const c of cases) {
      const nowServer = new Date((await call("GET", "/health")).json.server_time);
      const exp = expectedRisk({ amount: c.amount, accountId: account.account_id,
        deviceIdentifier: c.device.device_identifier, location: c.location, homeCities,
        history: await accountTxns(), now: nowServer });
      console.log(`\n${c.label}: ${account.account_number} -> ${merchant.merchant_name}, INR ${c.amount}, ` +
        `${c.device.device_identifier}, ${c.location}. Expected score ${exp.score} (${exp.level}), ` +
        `${exp.recent} recent transaction(s) on the account.`);

      const r = await call("POST", "/transactions", { token: ct, body: {
        account_id: account.account_id, merchant_id: merchant.merchant_id, device_id: c.device.device_id,
        amount: c.amount, transaction_type: "TRANSFER", location: c.location } });
      const t = r.json || {};
      check(`${c.label}: inserted (201) with a database transaction_id`, r.status === 201 && Number.isInteger(t.transaction_id),
        `HTTP ${r.status}, id=${t.transaction_id}${t.error ? `, ${t.error}` : ""}`);
      if (r.status !== 201) continue;
      check(`${c.label}: risk score matches CALCULATE_RISK rules`, t.risk_score === exp.score,
        `expected ${exp.score}, database ${t.risk_score} (${t.score_source})`);
      check(`${c.label}: classification ${exp.level}`, t.risk_level === exp.level, t.risk_level);
      const wantAlert = exp.level !== "LOW";
      check(`${c.label}: alert ${wantAlert ? "created" : "not created"}`, Boolean(t.alert) === wantAlert,
        t.alert ? `alert #${t.alert.alert_id}, ${t.alert.status}` : "none");
      check(`${c.label}: status ${exp.level === "HIGH" ? "FLAGGED" : "COMPLETED"}`,
        t.transaction_status === (exp.level === "HIGH" ? "FLAGGED" : "COMPLETED"), t.transaction_status);
      if (wantAlert) {
        check(`${c.label}: reasons match the rules`,
          JSON.stringify(t.reasons) === JSON.stringify(exp.reasons), (t.reasons || []).join("; "));
      }

      const listed = (await accountTxns()).find((x) => x.transaction_id === t.transaction_id);
      check(`${c.label}: appears in the customer's transaction list`, listed?.transaction_status === t.transaction_status);
      const analystView = (await call("GET", `/transactions?search=${account.account_number}`, { token: at })).json.items
        .find((x) => x.transaction_id === t.transaction_id);
      check(`${c.label}: appears in the analyst's transaction list`, Boolean(analystView));

      if (t.alert) {
        const a = await call("GET", `/alerts/${t.alert.alert_id}`, { token: at });
        check(`${c.label}: alert #${t.alert.alert_id} visible to the analyst`,
          a.status === 200 && a.json.transaction_id === t.transaction_id && a.json.risk_score === t.risk_score,
          `assigned to ${a.json?.analyst_name}`);
        const dupes = (await call("GET", "/alerts", { token: at })).json.items
          .filter((x) => x.transaction_id === t.transaction_id).length;
        check(`${c.label}: exactly one alert for the transaction`, dupes === 1, `${dupes}`);
        const put = await call("PUT", `/alerts/${t.alert.alert_id}`, { token: at, body: { status: "INVESTIGATING" } });
        check(`${c.label}: analyst moves the test alert to INVESTIGATING`, put.status === 200 && put.json.status === "INVESTIGATING");
        const reread = await call("GET", `/alerts/${t.alert.alert_id}`, { token: ct });
        check(`${c.label}: customer sees the persisted alert status`, reread.json?.status === "INVESTIGATING");
      }
    }
  }

  // ---- Sign out -----------------------------------------------------------
  await call("POST", "/auth/logout", { token: ct, body: {} });
  check("Signed-out token no longer works", (await call("GET", "/transactions", { token: ct })).status === 401);
  await call("POST", "/auth/logout", { token: at, body: {} });
}

main()
  .catch((err) => {
    failed++;
    console.error(`ERROR ${err.stack || err}`);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
