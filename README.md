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

[![Open SmartBank Live Demo](https://img.shields.io/badge/Open-SmartBank%20Live%20Demo-0ea5e9?style=for-the-badge)](https://ashmita-dev.github.io/SmartBank/)

**[Open SmartBank Live Demo → https://ashmita-dev.github.io/SmartBank/](https://ashmita-dev.github.io/SmartBank/)**

> **Status (14 Oct 2026): the frontend is online, but the always-on backend is not deployed yet.**
> The page loads from GitHub Pages. Its data currently comes through a **temporary, read-only**
> link to the author's laptop, so it works only while that laptop is on, and transfers are
> disabled. The permanent backend, Oracle Autonomous Database (Always Free) with sign-in and live
> transfers, is built and fully tested in a rehearsal environment. It goes live after a
> one-time Oracle Cloud account setup by the author ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).
> This notice will be replaced with the API health link once that is verified.

| Part | Where | State |
|---|---|---|
| Frontend | GitHub Pages | ✅ Online, verified 14 Oct 2026 |
| Oracle database, PL/SQL fraud engine, ORDS API | Oracle Autonomous Database, Always Free | ⏳ Install scripts ready and rehearsed (62/62 API checks, 20/20 browser checks); waiting for the cloud account |
| Live transaction → fraud score → alert, without the laptop | — | ⏳ After the step above |

### Demonstration login

| Portal | Email | Password |
|---|---|---|
| Customer (demo customer #1, Ashmita Mazumdar) | `user@smartbank.com` | provided with the project submission |
| Fraud analyst | `admin@smartbank.com` | provided with the project submission |

Passwords are set when the database is installed and are checked **by Oracle** (salted
PBKDF2 hashes). They are not in this repository or in the website's code. All customers,
accounts and transactions are synthetic.

### Try a live transaction (once the backend is live)

1. Sign in as the **customer** → **New Transfer**.
2. Payee *QuickCash Loans*, amount `150000`, location `Lagos`, a device marked *new for this account* → **Submit**.
3. The result comes from the database: the new transaction ID, risk score **80** (or 95 if you made
   another transfer in the last 10 minutes), **HIGH**, status **FLAGGED**, and a new **fraud alert** with its reasons.
4. A low-risk check: amount `500`, location `Mumbai`, a device marked *used on this account* → **LOW**, no alert.
5. Sign out, sign in as the **analyst** → **Fraud Alerts**: the new alert is at the top, assigned to the
   least-loaded analyst. Open it and **Start investigation**. Refresh: everything persists in Oracle.

Step-by-step script: [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md).

## Technology

| Layer | Technology |
|---|---|
| Database | Oracle Database: 21c Express Edition locally (`XEPDB1`); Oracle Autonomous Database (Always Free, 19c/26ai) for the public demo |
| Logic | SQL, PL/SQL: functions, procedures, compound trigger, cursor, packages |
| API | Oracle REST Data Services, module `smartbank.api`, schema alias `sb`; session authentication in `PKG_SMARTBANK_API` |
| Frontend | React 19, Vite 8, React Router 7, Recharts, Lucide icons |
| Hosting | GitHub Pages (frontend, GitHub Actions); Oracle Cloud (database + ORDS) |
| Tests | Vitest + Testing Library (23), API end-to-end script (62 checks), Chrome end-to-end via playwright-core (20 checks) |

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

Base URL: `http://localhost:8080/ords/smartbank/sb/api` (local) or
`https://<adb-host>/ords/sb/api` (Oracle Cloud). Except for `/health` and `/auth/login`, every
call needs the `X-Session-Token` header returned by sign-in. Oracle enforces the role and the
customer's data scope.

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

# 2. Install/refresh the API and security layer; choose local demo passwords (hidden prompts)
powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1

# 3. Frontend
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

The API URL can be overridden with `VITE_API_BASE_URL` (see `frontend/.env.example`).

## Deployment

```
Browser ──HTTPS──▶ GitHub Pages (static React build; contains no secrets)
   └──HTTPS──▶ Oracle Autonomous Database, Always Free (Oracle Cloud)
                 ├─ ORDS, managed by Oracle: /ords/sb/api → PKG_SMARTBANK_API
                 └─ SMARTBANK_USER: 12 tables, triggers, fraud engine (unchanged)
```

* **Frontend:** `.github/workflows/deploy-frontend.yml` lints, tests and builds on every push,
  and publishes to Pages with the repository variable `SMARTBANK_API_URL`. It checks
  `/health` first and refuses `localhost` or tunnel URLs.
* **Backend:** three SQL files in [`deploy/oci/`](deploy/oci/) are run once in Oracle's web
  console. `keep-database-awake.yml` pings `/health` every 3 days, so the free database is
  never stopped for inactivity.
* **Cost:** $0 (Oracle Always Free + GitHub Pages). Oracle requires a card for identity
  verification only.
* Full guide, security model and rehearsal results: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Testing

Latest results (14 Oct 2026; all actually run):

| Suite | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass |
| Unit/component (API client, login, protected routes, refresh, transfer validation, submission, failures, risk result) | `npm test` | ✅ 23/23 |
| Production build (`/SmartBank/` sub-path) | `npm run build` | ✅ pass |
| API end-to-end (auth, roles, scoping, CORS, validation, LOW + HIGH live transactions, alert, persistence) | `node scripts/api-smoke-test.mjs --write` | ✅ 62/62 on the rehearsal database (Oracle 23ai Free + ORDS 26.2, clean install from `deploy/oci/`) |
| Browser end-to-end (real Chrome, Pages-style build) | `npm run test:e2e` | ✅ 20/20 on the same rehearsal |
| Against the public cloud deployment | same commands | ⏳ not run yet: the cloud database does not exist yet |

* `database/13_testing.sql` holds 15 database tests (risk rules, triggers, cursor, package, constraints, rollback).
* **System & Settings → Test all endpoints** checks 11 endpoints live (HTTP status, rows, latency).
* Details: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Limitations

* **Shared demo logins.** Sign-in and roles are enforced by Oracle, but the two demonstration
  accounts are shared by everyone who has the password. This is acceptable only because all data
  is synthetic and writes are rate-limited. A real bank would use individual identities and MFA.
* **Transfers do not move money.** They are recorded in `BANK_TRANSACTION` and screened for fraud; balances are not changed.
* **Rule-based scoring.** The risk score is a point total from fixed rules, not a probability or a machine-learning prediction.
* **Always Free limits.** About 3–6 simultaneous users, and no backups or point-in-time restore.
  The database stops after 7 days without activity; the keep-alive workflow prevents that.
* **Seed timestamps** were written in Indian time. On the UTC cloud database, the historical seed
  rows show 5½ hours later than on the laptop; new transactions show the correct local time.
