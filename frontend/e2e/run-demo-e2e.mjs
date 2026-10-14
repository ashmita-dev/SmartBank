// Browser end-to-end test for the public DEMO MODE build (real Chrome).
//
// Verifies that every page is labelled as a simulation, that nothing claims
// Oracle processed a transaction, that no request leaves the site's own
// origin (no API, tunnel or localhost calls), and that the simulated
// transfer -> alert flow works and survives a refresh.
//
//   E2E_BASE_URL=https://ashmita-dev.github.io/SmartBank/ npm run test:e2e:demo
import process from "node:process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.E2E_BASE_URL || "").replace(/\/?$/, "/");
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
}

const origin = new URL(BASE).origin;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
const foreign = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  // Web fonts come from Google Fonts (the stylesheet's @import); anything else
  // off-site would be an API, tunnel or localhost call.
  if (!url.startsWith(origin) && !url.startsWith("data:") && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) foreign.push(url);
});

const bannerText = "DEMO MODE: simulated, not connected to Oracle.";

async function signIn(role) {
  await page.goto(`${BASE}login`);
  await page.getByText("DEMO MODE: not connected to Oracle.").waitFor({ timeout: 20000 });
  if (role === "analyst") await page.getByRole("button", { name: /Fraud Analyst/ }).click();
  await page.getByRole("button", { name: /use demo account/i }).click();
  await page.locator("form.login-form button[type=submit]").click();
  await page.waitForURL(role === "analyst" ? /\/admin$/ : /\/user$/, { timeout: 20000 });
}

try {
  await page.goto(`${BASE}admin/alerts`);
  await page.waitForURL(/\/login$/);
  check("Signed-out deep link goes to the login page", true);
  check("Login page states DEMO MODE before sign-in", await page.getByText("DEMO MODE: not connected to Oracle.").isVisible());

  // ---- Customer --------------------------------------------------------------
  await signIn("customer");
  for (const route of ["user", "user/accounts", "user/transactions", "user/transfer", "user/settings"]) {
    await page.goto(`${BASE}${route}`);
    await page.getByText(bannerText).waitFor({ timeout: 20000 });
    await page.reload();
    await page.getByText(bannerText).waitFor({ timeout: 20000 });
    const live = await page.locator(".live-status").innerText();
    check(`/${route}: demo banner after direct link + refresh, badge "${live}"`, live.trim() === "DEMO MODE");
  }

  await page.goto(`${BASE}user/transfer`);
  const payee = page.getByLabel("Payee (merchant)");
  await payee.waitFor();
  await payee.selectOption({ label: await payee.locator("option", { hasText: "QuickCash" }).first().innerText() });
  await page.getByLabel("Amount (₹)").fill("150000");
  const device = page.getByLabel("Device");
  await device.selectOption(await device.locator("option", { hasText: "new for this account" }).first().getAttribute("value"));
  await page.getByLabel("Location").fill("Lagos");
  await page.getByRole("button", { name: /simulate transfer/i }).click();
  const heading = page.getByRole("heading", { name: /Simulated transaction #\d+/ });
  await heading.waitFor({ timeout: 20000 });
  const txnId = (await heading.innerText()).match(/#(\d+)/)[1];
  const result = await page.locator(".transfer-success").innerText();
  check("Transfer result is labelled SIMULATED, not processed by Oracle", /SIMULATED, not processed by Oracle/.test(result));
  check("Result never says it was inserted into BANK_TRANSACTION", !/was inserted into BANK_TRANSACTION/.test(result));
  check("Simulated HIGH score follows the rules (150000 + new device + Lagos = 80)", /Simulated risk score 80\/100/.test(result));
  const alertId = result.match(/Simulated fraud alert #(\d+)/)?.[1];
  check("Simulated alert created and FLAGGED", Boolean(alertId) && /FLAGGED/.test(result), `alert #${alertId}`);

  await page.goto(`${BASE}user/transactions`);
  await page.reload();
  const row = page.locator("tbody tr", { hasText: `#${txnId}` }).first();
  await row.waitFor({ timeout: 20000 });
  check("Simulated transaction persists after refresh, tagged SIMULATED", /SIMULATED/.test(await row.innerText()));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByText(bannerText).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("Mobile (390 px): banner visible, no horizontal scroll", overflow <= 1, `overflow ${overflow}px`);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login$/);

  // ---- Analyst ------------------------------------------------------------------
  await signIn("analyst");
  for (const route of ["admin", "admin/transactions", "admin/alerts", "admin/analysts", "admin/settings"]) {
    await page.goto(`${BASE}${route}`);
    await page.getByText(bannerText).waitFor({ timeout: 20000 });
    const text = await page.locator("main").innerText();
    check(`/${route}: banner shown, no "LIVE" or "Connected to Oracle"`, !/\bLIVE\b/.test(await page.locator(".live-status").innerText()) && !/Connected to Oracle/.test(text));
  }
  await page.goto(`${BASE}admin`);
  await page.getByText("Demo mode: not connected to Oracle").waitFor({ timeout: 20000 });
  check("Overview says it is not connected to Oracle", true);

  await page.goto(`${BASE}admin/alerts`);
  await page.getByPlaceholder(/Search reason, analyst/).fill(alertId);
  const alertRow = page.locator("tbody tr", { hasText: `#${alertId}` }).first();
  await alertRow.waitFor({ timeout: 10000 });
  check("Analyst sees the simulated alert, tagged SIMULATED", /SIMULATED/.test(await alertRow.innerText()));
  await alertRow.click();
  await page.getByRole("button", { name: /start investigation/i }).click();
  await page.getByText(/in the demo simulation \(this browser only, not Oracle\)/).waitFor({ timeout: 10000 });
  check("Alert status change is described as simulated", true);

  await page.getByRole("button", { name: /^Reset$/ }).click();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reset demo data" }).click()]);
  await page.goto(`${BASE}admin/transactions`);
  await page.locator("tbody tr").first().waitFor();
  check("Reset removes simulated rows", (await page.locator(".sim-tag").count()) === 0);

  check("No request left the site except web fonts (no API, tunnel or localhost)", foreign.length === 0, foreign.slice(0, 3).join(" "));
  check("No console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (err) {
  failed++;
  console.error(`ERROR ${err.message}`);
  await page.screenshot({ path: "e2e-failure.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
