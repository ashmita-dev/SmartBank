# SmartBank — Demonstration Guide (about 10 minutes)

## Before the presentation (5 minutes)

1. Start the backend: `powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1`.
   Accept the UAC prompt; it only starts the Oracle listener service. Wait for "API is up".
2. Start the frontend: `cd frontend` then `npm run dev`, and open <http://localhost:5173>.
3. Sign in as the analyst, open **System & Settings → Test all endpoints**, and confirm the summary reads
   **10 healthy · 0 failed of 10** (each row shows HTTP 200, row count and latency).
4. Keep SQL Developer (or SQLcl) open as `smartbank_user`, with `05_functions.sql` and `07_triggers.sql` ready to show.

> All endpoints were published on 14 Oct 2026. If a check ever fails, the row shows the HTTP code and
> the reason; `scripts\register-endpoints.ps1` republishes the module (hidden password prompt).

## 1. The problem and the design (1 min)

* Fraud logic lives **in the database**, so every channel that inserts a transaction is screened.
* Show the 12-table schema (README table): supertype/subtype customers and accounts, transactions, fraud alerts.

## 2. Analyst console (3 min) — `admin@smartbank.com` / `admin123`

1. Login page: select **Fraud Analyst**, click **Use demo credentials**, then sign in.
2. **Overview**: KPIs come straight from `GET /kpis`. Point out the green **LIVE / API online** status, the daily volume chart (`V_DAILY_TRANSACTION_ANALYTICS`) and the risk donut.
3. **Transactions**: type `Lagos` in the search, then click **FLAGGED**. Explain that FLAGGED is set automatically for HIGH risk.
4. **Fraud Alerts**: open the top alert. Show the score, the readable reasons, the customer, the device and the assigned analyst.
   Click **Start investigation**. The success message confirms the update was saved in `FRAUD_ALERT`.
5. **Analyst Workload**: explain that `GENERATE_ALERT` assigns each alert to the analyst with the fewest OPEN alerts.

## 3. Live fraud detection (3 min) — `user@smartbank.com` / `user123`

Sign out, then sign in as **Customer**. This demo login is linked to customer #1 (home city Mumbai),
shown as **Ashmita Mazumdar**, read from the `CUSTOMER` table.

Point out the two fraud figures on the dashboard: **Under fraud review = 8** (customer #1's
transactions with an OPEN MEDIUM alert) and **Flagged (high risk) = 0**. MEDIUM risk raises an
alert but leaves the payment COMPLETED; only HIGH sets FLAGGED. The Transactions page shows
both columns side by side, and the **UNDER REVIEW** filter lists the 8.

1. **Dashboard / My Accounts**: the customer sees only their own savings and current accounts.
2. **New Transfer**, a safe transaction first:
   * Account AC1000001, any payee, amount `2500`, location `Mumbai`, device `DEV-AND-0001 · used on this account`.
   * Submit. The result says the transaction was recorded and **no alert** was raised (score 0, below 40).
3. **New Transfer**, a suspicious transaction:
   * Account AC1000001, payee *QuickCash Loans*, amount `150000`, location `Lagos`,
     device `DEV-WIN-0003 · new for this account`.
   * The risk preview lists the expected signals. Submit.
   * The result shows the new transaction ID, status **FLAGGED**, and a **HIGH** alert with its score and reasons:
     amount (+40) + new device (+20) + unusual location (+20) = 80. If you submit within
     10 minutes of step 2, velocity adds +15 (95, still HIGH).
   * Each submitted transaction becomes part of the account's history, so a device used once
     is "used on this account" afterwards. For a repeat demo, pick another device marked "new".
4. Point out the notice that balances are not moved; this is a demonstration of screening.

## 4. Close the loop (1 min)

Sign back in as the analyst. Open **Fraud Alerts**: the new alert is at the top. Click **Confirm fraud**.

## 5. System & Settings (1 min)

Explain the four panels: live endpoint diagnostics (read-only GETs), the risk rules copied from
`CALCULATE_RISK` / `CLASSIFY_RISK` (a rule-based point total, **not** a probability), the database
objects (verified VALID in the live schema), and the demonstration limits.

## 6. Database proof (2 min, in SQL Developer)

```sql
SELECT transaction_id, amount, location, status
FROM bank_transaction ORDER BY transaction_id DESC FETCH FIRST 3 ROWS ONLY;

SELECT alert_id, transaction_id, risk_score, risk_level, reason, status, analyst_id
FROM fraud_alert ORDER BY alert_id DESC FETCH FIRST 3 ROWS ONLY;

SELECT pkg_fraud_detection.get_risk_level(85) FROM dual;    -- HIGH
```

Optionally show `13_testing.sql` (15 tests) and `database/tests/day5_explain_plan_test.sql` (index usage).

## Questions you may be asked

* **Why a compound trigger?** `DETECT_FRAUD` queries `BANK_TRANSACTION`. Doing that in a row-level trigger would raise ORA-04091 (mutating table), so the IDs are collected per row and processed after the statement.
* **Is the login secure?** No. It is a demo login checked in the browser. Production would use ORDS OAuth2 or another identity provider with server-side role checks.
* **Why not move balances?** The project scope is fraud detection. A real transfer would debit and credit both accounts atomically in one PL/SQL procedure.
