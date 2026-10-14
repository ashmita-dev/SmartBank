// SmartBank browser end-to-end test (real Chrome via playwright-core).
//
// Drives the deployed (or locally previewed) frontend against a real
// SmartBank API: customer sign-in, live data, ONE test transfer through the
// New Transfer page, the fraud result, persistence after refresh, and the
// resulting alert in the analyst portal. Use --read-only to skip the transfer.
//
// Environment (passwords only via environment variables):
//   E2E_BASE_URL                 e.g. https://ashmita-dev.github.io/SmartBank/
//   SMARTBANK_CUSTOMER_PASSWORD
//   SMARTBANK_ANALYST_PASSWORD
//   CHROME_PATH                  optional; defaults to the installed Chrome
//
//   npm run test:e2e             (from frontend/)
import process from "node:process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.E2E_BASE_URL || "").replace(/\/?$/, "/");
const READ_ONLY = process.argv.includes("--read-only");
const CHROME =
  process.env.CHROME_PATH ||
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

if (!process.env.E2E_BASE_URL) {
  console.error("Set E2E_BASE_URL first.");
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

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
const requests = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));

async function signIn(roleTab, email, password) {
  await page.goto(`${BASE}login`);
  if (roleTab === "analyst") await page.getByRole("button", { name: /Fraud Analyst/ }).click();
  await page.getByRole("button", { name: /use demo account/i }).click();
  check(`${roleTab}: demo button fills ${email}`, (await page.locator("#email").inputValue()) === email);
  await page.locator("#password").fill(password);
  await page.locator("form.login-form button[type=submit]").click();
}

try {
  // ---- Signed-out deep link and wrong password ---------------------------
  await page.goto(`${BASE}user/transfer`);
  await page.waitForURL(/\/login$/);
  check("Deep link while signed out goes to /login", page.url().endsWith("/login"));

  await page.locator("#email").fill("user@smartbank.com");
  await page.locator("#password").fill("not-the-password");
  await page.locator("form.login-form button[type=submit]").click();
  await page.getByText("Invalid email or password.").waitFor({ timeout: 20000 });
  check("Wrong password is refused by the server", true);

  // ---- Customer portal -----------------------------------------------------
  await signIn("customer", "user@smartbank.com", process.env.SMARTBANK_CUSTOMER_PASSWORD || "");
  await page.waitForURL(/\/user$/, { timeout: 20000 });
  check("Customer signs in and lands on the dashboard", true);
  await page.getByText("Ashmita Mazumdar").first().waitFor({ timeout: 20000 });
  check("Customer name is read from the database", true);

  await page.goto(`${BASE}user/transactions`);
  await page.locator("tbody tr").first().waitFor({ timeout: 20000 });
  const rowsBefore = await page.locator("tbody tr").count();
  check("My Transactions shows live rows", rowsBefore > 0, `${rowsBefore} rows`);
  await page.reload();
  await page.locator("tbody tr").first().waitFor({ timeout: 20000 });
  check("Refreshing a deep link keeps the session and the page", page.url().endsWith("/user/transactions"));

  let txnId = null;
  let alertId = null;
  if (!READ_ONLY) {
    await page.goto(`${BASE}user/transfer`);
    await page.getByLabel("Payee (merchant)").waitFor({ timeout: 20000 });
    const payee = page.getByLabel("Payee (merchant)");
    await payee.selectOption({ label: await payee.locator("option", { hasText: "QuickCash" }).first().innerText() });
    await page.getByLabel("Amount (₹)").fill("150000");
    const device = page.getByLabel("Device");
    const newDevice = await device.locator("option", { hasText: "new for this account" }).first().getAttribute("value");
    await device.selectOption(newDevice);
    await page.getByLabel("Location").fill("Lagos");
    await page.getByRole("button", { name: /submit transfer/i }).click();

    const heading = page.getByRole("heading", { name: /Transaction #\d+ recorded/ });
    await heading.waitFor({ timeout: 30000 });
    txnId = Number((await heading.innerText()).match(/#(\d+)/)[1]);
    const resultText = await page.locator(".transfer-success").innerText();
    const score = Number(resultText.match(/Risk score (\d+)\/100/)?.[1]);
    alertId = Number(resultText.match(/Fraud alert #(\d+)/)?.[1]) || null;
    check("Transfer inserted into Oracle with a database ID", Number.isInteger(txnId), `transaction #${txnId}`);
    check("Fraud result shows a HIGH score from the database", score >= 70, `score ${score}`);
    check("A fraud alert was generated", Boolean(alertId), `alert #${alertId}`);
    check("Transaction was FLAGGED", /FLAGGED/.test(resultText));

    await page.goto(`${BASE}user/transactions`);
    await page.locator("tbody tr").first().waitFor({ timeout: 20000 });
    await page.reload();
    await page.locator("tbody tr").first().waitFor({ timeout: 20000 });
    const listed = await page.locator("tbody tr", { hasText: `#${txnId}` }).count()
      || await page.locator("tbody tr", { hasText: String(txnId) }).count();
    check("New transaction is listed after a full page refresh", listed > 0);
  }

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login$/);
  check("Sign out returns to the login page", true);

  // ---- Analyst portal ------------------------------------------------------
  await signIn("analyst", "admin@smartbank.com", process.env.SMARTBANK_ANALYST_PASSWORD || "");
  await page.waitForURL(/\/admin$/, { timeout: 20000 });
  check("Analyst signs in and lands on the overview", true);

  await page.goto(`${BASE}admin/alerts`);
  await page.locator("tbody tr").first().waitFor({ timeout: 20000 });
  if (alertId) {
    await page.getByPlaceholder(/Search reason, analyst/).fill(String(alertId));
    const row = page.locator("tbody tr", { hasText: String(txnId) }).first();
    await row.waitFor({ timeout: 10000 });
    check("Analyst finds the new alert in Fraud Alerts", true);
    await row.click();
    await page.getByRole("heading", { name: `Alert #${alertId}` }).waitFor({ timeout: 20000 });
    const dialog = await page.getByRole("dialog").innerText();
    check("Alert detail shows the transaction and the reasons", dialog.includes(String(txnId)) && /Unrecognized device/i.test(dialog));
    await page.reload();
    await page.locator("tbody tr").first().waitFor({ timeout: 20000 });
    check("Alert list still loads after refresh", page.url().endsWith("/admin/alerts"));
  } else {
    check("Fraud Alerts list loads", (await page.locator("tbody tr").count()) > 0);
  }

  await page.goto(`${BASE}user`);
  await page.waitForURL(/\/admin$/);
  check("Analyst cannot open the customer portal", true);

  const local = requests.filter((r) => /localhost:8080|127\.0\.0\.1:8080/.test(r));
  if (!/localhost|127\.0\.0\.1/.test(BASE)) check("No request went to a local ORDS", local.length === 0);
  const relevantErrors = consoleErrors.filter((e) => !/401|Unauthorized|status of 401/.test(e) && !/status of 4\d\d/.test(e));
  check("No unexpected console errors", relevantErrors.length === 0, relevantErrors.slice(0, 3).join(" | "));
} catch (err) {
  failed++;
  console.error(`ERROR ${err.message}`);
  await page.screenshot({ path: "e2e-failure.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
