# SmartBank — Demonstration Guide (about 10 minutes)

There are two ways to show SmartBank. Say which one you are using.

| | Where | What it proves |
|---|---|---|
| **REAL ORACLE MODE** (main demonstration) | The author's laptop, `http://localhost:5173` | Transactions inserted into Oracle and scored by the PL/SQL trigger, procedures and functions |
| **DEMO MODE** (public link) | `https://ashmita-dev.github.io/SmartBank/`, any device | The interface and the fraud rules, **simulated in the browser**. Every page is labelled; nothing reaches Oracle. |

**Demo logins:** `user@smartbank.com` (customer) and `admin@smartbank.com` (analyst). On the
login page, **Use demo account** fills in the email.
* Demo mode: no password is needed.
* Laptop with the older REST module (current state): any password is accepted, and a notice says
  the password is not checked.
* Laptop after `scripts\register-endpoints.ps1`: the passwords chosen in that script, checked by Oracle.

## Before the presentation

* Local: `scripts\start-backend.ps1` (accept the UAC prompt), then `npm run dev` in `frontend/`.
* Sign in as the analyst → **System & Settings → Test all endpoints**. With the older module,
  `GET /health` shows as failed (it does not exist there); the other 10 should be healthy.
* Public link: open it once. You should see the amber **DEMO MODE** banner after signing in.

## 1. The problem and the design (1 min)

* Fraud logic lives **in the database**, so every channel that inserts a transaction is screened.
* Show the 12-table schema (README): supertype/subtype customers and accounts, transactions, fraud alerts.
* Sign-in is checked by Oracle too: `PKG_SMARTBANK_API` verifies the password hash, issues a
  session, and enforces what each role may see and do.

## 2. Analyst console (3 min) — analyst login

1. **Overview**: KPIs come from `GET /kpis`. Point out the **LIVE** status (a real check of every endpoint), the daily chart (`V_DAILY_TRANSACTION_ANALYTICS`) and the risk donut.
2. **Transactions**: search `Lagos`, then click **FLAGGED**. FLAGGED is set automatically for HIGH risk.
3. **Fraud Alerts**: open an alert. Show the score, the reasons, the customer, the device and the assigned analyst.
4. **Analyst Workload**: `GENERATE_ALERT` assigns each alert to the analyst with the fewest OPEN alerts.

## 3. Live fraud detection (3 min) — customer login

The customer login is linked to customer #1, **Ashmita Mazumdar** (home city Mumbai), and the
database returns only that customer's data.

1. **Dashboard / My Accounts**: the customer's own accounts only.
2. **New Transfer, low risk.** Account AC1000001, any payee, amount `500`, location `Mumbai`,
   a device marked *used on this account*. Submit. Expected result: **LOW, score 0**, no alert,
   status COMPLETED. The score is 15 instead if another transfer was made on the account in
   the last 10 minutes; that is the velocity rule, working as designed.
3. **New Transfer, high risk.** Payee *QuickCash Loans*, amount `150000`, location `Lagos`, a
   device marked *new for this account*. The preview lists the expected signals. Submit.
   Expected result: **HIGH**, transaction **FLAGGED**, a new **fraud alert #…** with reasons.
   The score is 40 (amount) + 20 (new device) + 20 (location) = 80, plus 15 if step 2 was less
   than 10 minutes ago (95).
   * A device becomes *used on this account* once it has been used, so for a repeat demo pick
     another device marked *new*.
4. **Transactions**: both transfers are listed. Press **F5**: they are still there, because they are stored in Oracle.

## 4. Close the loop (1 min)

Sign out and sign in as the analyst. **Fraud Alerts**: the new alert is at the top. Open it and
click **Start investigation** or **Confirm fraud**. Refresh the page: the status persists.

## 5. Database proof (2 min)

In SQL Developer (local), or Database Actions → SQL (cloud), as `SMARTBANK_USER`:

```sql
SELECT transaction_id, amount, location, status
FROM bank_transaction ORDER BY transaction_id DESC FETCH FIRST 3 ROWS ONLY;

SELECT alert_id, transaction_id, risk_score, risk_level, reason, status, analyst_id
FROM fraud_alert ORDER BY alert_id DESC FETCH FIRST 3 ROWS ONLY;

-- Which rows came through the web API, and from which demo login
SELECT e.created_at, u.email, e.event_type, e.transaction_id, e.alert_id, e.detail
FROM api_event e LEFT JOIN api_user u ON u.user_id = e.user_id
ORDER BY e.event_id DESC FETCH FIRST 10 ROWS ONLY;
```

## Questions you may be asked

* **Why a compound trigger?** `DETECT_FRAUD` queries `BANK_TRANSACTION`. In a row-level trigger that raises ORA-04091 (mutating table), so the IDs are collected per row and processed after the statement.
* **Does the API run fraud detection itself?** No. It inserts the row; `TRG_FRAUD_MONITOR` runs `DETECT_FRAUD` once. The API then reads the result back. For LOW risk, which stores no alert, it reports the score from `CALCULATE_RISK`, a read-only function.
* **Is the login secure?** For a demo, yes. Passwords are salted PBKDF2 hashes in Oracle, sessions are random tokens stored only as hashes, and every handler checks the role and customer scope. The limit is that the logins are shared demo accounts; a real bank would use individual identities with MFA.
* **Where does it run?** Oracle XE and ORDS on the laptop (ORDS listens on 127.0.0.1 only). The public link is a clearly labelled browser simulation, because no free, persistent Oracle hosting was available without a new account or card verification (docs/DEPLOYMENT.md).
* **How do we know the simulation matches Oracle?** Replaying the seed through the JavaScript rules gives the same 84 alerts, 3 HIGH and 3 FLAGGED that Oracle produced from the same script; an automated test checks it.
* **Why not move balances?** The scope is fraud detection. A real transfer would debit and credit both accounts atomically in one PL/SQL procedure.
