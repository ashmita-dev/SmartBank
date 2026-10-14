# SmartBank — Database-Driven Fraud Detection and Transaction Monitoring System

Advanced Database Management Systems project
**Ashmita Mazumdar** · SVKM's NMIMS, MPSTME, Shirpur Campus · 2026–2027

SmartBank is a banking database in which fraud detection happens **inside Oracle**.
Every row inserted into `BANK_TRANSACTION` is scored by PL/SQL, and suspicious
transactions automatically raise a `FRAUD_ALERT` that is assigned to the least-loaded
analyst. Oracle REST Data Services (ORDS) exposes the data as an authenticated REST API,
and a React dashboard serves two roles: fraud analysts and customers.

```
React (Vite) ──HTTPS/JSON──▶ ORDS ──▶ Oracle Database, schema SMARTBANK_USER
                                       ├─ PKG_SMARTBANK_API (sign-in, roles, validation)
                                                        ├─ TRG_VALIDATE_TRANSACTION
                                                        ├─ TRG_FRAUD_MONITOR ─▶ DETECT_FRAUD
                                                        │      ├─ CALCULATE_RISK / CLASSIFY_RISK
                                                        │      └─ GENERATE_ALERT
                                                        └─ views, indexes, PKG_FRAUD_DETECTION
```

## Live Demo

[![Open SmartBank Live Demo](https://img.shields.io/badge/Open-SmartBank%20Live%20Demo%20(demo%20mode)-f59e0b?style=for-the-badge)](https://ashmita-dev.github.io/SmartBank/)

**[Open SmartBank → https://ashmita-dev.github.io/SmartBank/](https://ashmita-dev.github.io/SmartBank/)**

SmartBank runs in two clearly separated modes:

| | **DEMO MODE**: the public link above | **REAL ORACLE MODE**: the author's computer |
|---|---|---|
| Where | GitHub Pages, any browser, always on | `http://localhost:5173` with Oracle XE + ORDS running |
| Data | The project's synthetic seed (`03_seed_data.sql`), loaded into your browser | The `SMARTBANK_USER` schema in Oracle |
| New transfer | **Simulated** in your browser and labelled *SIMULATED, not processed by Oracle* | Inserted into `BANK_TRANSACTION`; `TRG_FRAUD_MONITOR → DETECT_FRAUD` scores it |
| Fraud scoring | A JavaScript copy of `CALCULATE_RISK` / `CLASSIFY_RISK` / `DETECT_FRAUD` / `GENERATE_ALERT` | The PL/SQL engine itself |
| Persistence | This browser only (**Reset** restores the seed) | The Oracle database |
| Labels | Amber **DEMO MODE** banner on every page; never shows LIVE | **LIVE** only when every API check passes |

**Why the public site is a simulation.** A permanent public Oracle backend needs either a cloud
account that asks for card verification (Oracle Cloud Always Free) or a separate sign-up whose
suitability is unverified (the free APEX evaluation service). The author chose neither, so the
public site does **not** claim to reach Oracle. The earlier public link to the laptop (a Cloudflare
quick tunnel) has been retired: it worked only while the laptop and tunnel were running, and it
failed on 14 Oct 2026 when the network blocked the tunnel. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**How faithful is the simulation?** Replaying the 101 seed transactions through the JavaScript
rules gives exactly the result Oracle produced from the same script on 14 Oct 2026: **84 alerts,
3 HIGH, 3 FLAGGED**, and 8 alerts for customer #1. An automated test checks this on every build.

### Try it on the public link (simulated)

1. Open the link. **Use demo account** (no password in demo mode) → **Sign in**.
2. **New Transfer**: payee *QuickCash Loans*, amount `150000`, location `Lagos`, a device marked *new for this account* → **Simulate transfer**.
3. The result is labelled **SIMULATED**: score **80** (40 amount + 20 new device + 20 location), **HIGH**, status FLAGGED, and a simulated alert with its reasons.
4. Sign out, choose **Fraud Analyst** → **Use demo account** → **Fraud Alerts**: the alert is at the top, tagged **SIMULATED**.

### Genuine Oracle transaction (on the author's computer)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1   # Oracle listener + ORDS
cd frontend; npm run dev                                              # http://localhost:5173
```

Sign in, open **New Transfer** and submit the same transfer. The row is inserted into Oracle,
and the result shows the real transaction ID, score, alert and status. Prove it in SQL:

```sql
SELECT transaction_id, amount, location, status FROM bank_transaction ORDER BY transaction_id DESC FETCH FIRST 3 ROWS ONLY;
SELECT alert_id, transaction_id, risk_score, risk_level, reason, status FROM fraud_alert ORDER BY alert_id DESC FETCH FIRST 3 ROWS ONLY;
```

**Sign-in on the laptop.** The laptop database currently has the *older* REST module, which has
no server-side login. The app detects this, accepts the demo emails, and shows a notice that the
password is not checked; data and transfers are still real Oracle. To switch to the authenticated
API (passwords verified by Oracle), run `scripts\register-endpoints.ps1` once. Details:
[docs/SETUP.md](docs/SETUP.md).

| Portal | Email |
|---|---|
| Customer (demo customer #1, Ashmita Mazumdar) | `user@smartbank.com` |
| Fraud analyst | `admin@smartbank.com` |

All customers, accounts and transactions are synthetic.

## Technology

| Layer | Technology |
|---|---|
| Database | Oracle Database 21c Express Edition (`XEPDB1`); scripts also tested on Oracle 23ai Free |
| Logic | SQL, PL/SQL: functions, procedures, compound trigger, cursor, packages |
| API | Oracle REST Data Services, module `smartbank.api`, schema alias `sb`; session authentication in `PKG_SMARTBANK_API` |
| Frontend | React 19, Vite 8, React Router 7, Recharts, Lucide icons |
| Hosting | GitHub Pages (frontend, GitHub Actions): demo mode publicly, real Oracle mode locally |
| Tests | Vitest + Testing Library (38), API end-to-end script (62 checks), Chrome end-to-end via playwright-core (Oracle mode 20, demo mode 24) |

## Database architecture (12 tables)

| Area | Tables |
|---|---|
| Customers | `CUSTOMER` (supertype), `INDIVIDUAL_CUSTOMER`, `BUSINESS_CUSTOMER`, `CUSTOMER_ADDRESS` |
| Accounts | `ACCOUNT` (supertype), `SAVINGS_ACCOUNT`, `CURRENT_ACCOUNT` |
| Activity | `BANK_TRANSACTION`, `MERCHANT`, `DEVICE` |
| Fraud operations | `FRAUD_ANALYST`, `FRAUD_ALERT` |

Primary keys use identity columns. Foreign keys enforce every relationship, and
named `UNIQUE`/`CHECK` constraints (`02_constraints.sql`) guard emails, account numbers,
balances, statuses, amounts and risk ranges.

### Scripts (`database/`)

| File | Contents |
|---|---|
| `01_tables.sql` | 12 tables with PKs, FKs, defaults |
| `02_constraints.sql` | Named UNIQUE and CHECK constraints |
| `03_seed_data.sql` | Synthetic demo data: 15 customers, 20 accounts, 8 merchants, 12 devices, 2 analysts, 101 transactions |
| `04_verification_queries.sql` | Row counts and relationship checks |
| `05_functions.sql` | `CALCULATE_RISK`, `CLASSIFY_RISK` |
| `06_procedures.sql` | `GENERATE_ALERT`, `DETECT_FRAUD` |
| `07_triggers.sql` | `TRG_VALIDATE_TRANSACTION` (row), `TRG_FRAUD_MONITOR` (compound) |
| `08_cursor.sql` | `REVIEW_HIGH_RISK_ALERTS` (explicit cursor, `FOR UPDATE` / `WHERE CURRENT OF`) |
| `09_package.sql` | `PKG_FRAUD_DETECTION` |
| `10_views.sql` | 4 reporting views, including `V_DAILY_TRANSACTION_ANALYTICS` |
| `11_indexes.sql` | 6 indexes on transaction and alert lookups |
| `12_analytics_queries.sql` | Analytical query bank |
| `13_testing.sql` | 15 scripted tests (tests 1–9 **commit** test rows; only 14–15 roll back) |
| `14_demo_customer_profile.sql` | Renames demo customer #1 to Ashmita Mazumdar (one guarded UPDATE) |
| `15_api_security.sql` | API layer: `API_USER`, `API_SESSION`, `API_EVENT` and `PKG_SMARTBANK_API` (sign-in, roles, customer scoping, validation, JSON) |
| `ords_endpoints.sql` | REST module: every handler calls `PKG_SMARTBANK_API` |
| `../deploy/oci/` | Cloud install: admin setup, one generated install file, demo logins |
| `tests/` | Day-4 trigger/package test, Day-5 `EXPLAIN PLAN` index test |

## Fraud-detection workflow

1. `TRG_VALIDATE_TRANSACTION` (BEFORE INSERT) rejects transactions on non-ACTIVE accounts and
   amounts over ₹1,00,00,000.
2. `TRG_FRAUD_MONITOR`, a compound trigger, collects new IDs per row and calls `DETECT_FRAUD`
   in its AFTER STATEMENT section. This avoids mutating-table errors.
3. `CALCULATE_RISK` scores the transaction (capped at 100):

   | Signal | Points |
   |---|---|
   | Amount > ₹1,00,000 / > ₹50,000 / > ₹20,000 | +40 / +25 / +10 |
   | 2+ / 1 other transactions on the account in the previous 10 minutes | +25 / +15 |
   | Device never used before by this account | +20 |
   | Location not one of the customer's address cities | +20 |

4. `CLASSIFY_RISK`: **LOW 0–39**, **MEDIUM 40–69**, **HIGH 70–100**.
5. MEDIUM and HIGH create a `FRAUD_ALERT` with readable reasons, assigned by
   `GENERATE_ALERT` to the analyst with the fewest OPEN alerts. HIGH also sets the
   transaction status to `FLAGGED`.
6. Analysts review alerts in the dashboard (OPEN → INVESTIGATING → CONFIRMED_FRAUD /
   FALSE_POSITIVE / CLOSED). `REVIEW_HIGH_RISK_ALERTS` bulk-moves OPEN HIGH alerts to
   INVESTIGATING using a cursor.

## REST API

Base URL: `http://localhost:8080/ords/smartbank/sb/api` (local). This is the authenticated API
installed by `register-endpoints.ps1` (`15_api_security.sql` + `ords_endpoints.sql`). Except for
`/health` and `/auth/login`, every call needs the `X-Session-Token` header returned by sign-in;
Oracle enforces the role and the customer's data scope. The public demo mode answers the same
endpoints from an in-browser simulation instead (`frontend/src/demo/`).

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | public | API, database and fraud-engine status (no data) |
| POST / GET | `/auth/login`, `/auth/logout`, `/auth/session` | public / signed in | Sign-in (password checked in Oracle), sign-out, session check |
| GET | `/kpis`, `/risk-distribution`, `/daily-analytics`, `/analysts/workload` | analyst | Dashboard figures |
| GET | `/transactions?search=`, `/alerts?risk_level=`, `/alerts/:id` | analyst: all; customer: own | Transactions and fraud alerts |
| POST | `/transactions` | customer (own accounts) | Validates, inserts, lets `TRG_FRAUD_MONITOR` score it, returns the committed ID, status, risk score, level, reasons and alert |
| PUT | `/alerts/:id` | analyst | Set `{"status": "..."}` |
| GET | `/accounts`, `/merchants`, `/devices`, `/customers/:id` | scoped | Customer portal and transfer form |

## Frontend

| Role | Demo login | Pages |
|---|---|---|
| Fraud analyst | `admin@smartbank.com` | Overview (KPIs, charts, review queue), Transactions (search + filters), Fraud Alerts (review dialog with status actions), Analyst Workload, System & Settings (live endpoint diagnostics) |
| Customer (linked to customer #1; the name shown is read from the `CUSTOMER` table) | `user@smartbank.com` | Dashboard, My Accounts, Transactions, New Transfer (real `POST /transactions` with fraud result), Profile |

Sign-in calls `POST /auth/login`; the session token is kept across page refreshes until it
expires (8 hours) or the user signs out. The interface shows live database data only. When the API is unreachable, pages show
an error with Retry and the status indicator turns red (amber when only some endpoints fail).
No sample data is substituted. Requests time out after 15 s, a newer refresh always wins over a
slower older one, and non-JSON responses are reported as errors rather than shown as empty data.

## Quick start

See [docs/SETUP.md](docs/SETUP.md) for the full setup and [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) for the demonstration script.

```powershell
# 1. Backend: starts the Oracle listener service (UAC prompt) and ORDS, then checks the API
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1

#    If it reports a missing ORDS pool password, run once first:
#    powershell -ExecutionPolicy Bypass -File scripts\repair-ords-pool.ps1

# 2. Optional: install the authenticated API (server-side sign-in); asks for the
#    SMARTBANK_USER password and new demo passwords in hidden prompts. Without it,
#    the app works with the older module and says the password is not checked.
powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1

# 3. Frontend
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

The API URL can be overridden with `VITE_API_BASE_URL` (see `frontend/.env.example`).
To try the public demo mode locally: `$env:VITE_DEMO_MODE="true"; npm run dev`.

## Deployment

```
Public:  Browser ──HTTPS──▶ GitHub Pages ── DEMO MODE (in-browser simulation; no API calls)

Local:   Browser ──▶ Vite (localhost:5173) ──▶ ORDS (127.0.0.1:8080) ──▶ Oracle XE (XEPDB1)
                                                 REAL ORACLE MODE: PL/SQL fraud engine
```

* `.github/workflows/deploy-frontend.yml` lints, tests and builds on every push. It publishes
  **DEMO MODE** unless the repository variable `SMARTBANK_API_URL` names a hosted SmartBank API
  whose `/health` answers; then it builds **REAL ORACLE MODE** against it. Tunnel URLs are refused.
* Oracle and ORDS are never exposed to the internet: ORDS listens on 127.0.0.1 only.
* Hosting options for a public Oracle backend, and why none is used: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Testing

Latest results (14 Oct 2026; all actually run):

| Suite | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass |
| Unit/component: API client, login, routes, refresh, transfer validation/submission/failures, demo engine vs Oracle totals, demo labelling, older local API | `npm test` | ✅ 38/38 |
| Production builds (Oracle mode and demo mode, `/SmartBank/` sub-path) | `npm run build` | ✅ pass |
| Browser, **demo mode** build (labels on all 10 routes, simulated transfer → alert, refresh, reset, mobile, no API/tunnel requests) | `npm run test:e2e:demo` | ✅ 24/24 (local preview of the Pages build) |
| Browser, **real Oracle** on the laptop, read-only (sign-in, live data, transfer form, alerts, refresh, no writes) | scripted Chrome check | ✅ 12/12 |
| API end-to-end with live LOW + HIGH transactions | `node scripts/api-smoke-test.mjs --write` | ✅ 62/62 on a disposable Oracle 23ai + ORDS rehearsal (clean install of `deploy/oci/`); **not run on the laptop database** (its writes need the owner's approval) |
| Browser, real Oracle with a submitted transfer | `npm run test:e2e` | ✅ 20/20 on the same rehearsal; not run on the laptop database |

* `database/13_testing.sql` holds 15 database tests (risk rules, triggers, cursor, package, constraints, rollback).
* Details: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Limitations

* **The public link is a simulation.** It demonstrates the interface and the fraud rules, not
  Oracle. Genuine Oracle processing is shown on the author's computer.
* **Simulated data is per browser.** Another visitor does not see your simulated transfers.
* **Shared demo logins.** With the authenticated API, sign-in and roles are enforced by Oracle,
  but the two demonstration accounts are shared. With the older local module, the password is not checked.
* **Transfers do not move money.** They are recorded and screened; balances are not changed.
* **Rule-based scoring.** The risk score is a point total from fixed rules, not a probability.
* **Alert assignment ties.** When both analysts have the same number of OPEN alerts, Oracle's choice
  is unspecified; the simulation picks the lower analyst ID.
