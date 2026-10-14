# SmartBank — Database-Driven Fraud Detection and Transaction Monitoring System

Advanced Database Management Systems project
**Ashmita Mazumdar** · SVKM's NMIMS, MPSTME, Shirpur Campus · 2026–2027

SmartBank is a banking database in which fraud detection happens **inside Oracle**.
Every row inserted into `BANK_TRANSACTION` is scored by PL/SQL, and suspicious
transactions automatically raise a `FRAUD_ALERT` that is assigned to the least-loaded
analyst. Oracle REST Data Services (ORDS) exposes the data as a REST API, and a React
dashboard serves two roles: fraud analysts and customers.

```
React (Vite) ──HTTP/JSON──▶ ORDS (localhost:8080) ──▶ Oracle 21c XE (XEPDB1, SMARTBANK_USER)
                                                        ├─ TRG_VALIDATE_TRANSACTION
                                                        ├─ TRG_FRAUD_MONITOR ─▶ DETECT_FRAUD
                                                        │      ├─ CALCULATE_RISK / CLASSIFY_RISK
                                                        │      └─ GENERATE_ALERT
                                                        └─ views, indexes, PKG_FRAUD_DETECTION
```

## Technology

| Layer | Technology |
|---|---|
| Database | Oracle Database 21c Express Edition, pluggable database `XEPDB1` |
| Logic | SQL, PL/SQL: functions, procedures, compound trigger, cursor, package |
| API | Oracle REST Data Services, module `smartbank.api`, schema alias `sb` |
| Frontend | React 19, Vite 8, React Router 7, Recharts, Lucide icons |

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
| `13_testing.sql` | 15 scripted tests (inserts test rows) |
| `ords_endpoints.sql` | REST module definition |
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

Base URL: `http://localhost:8080/ords/smartbank/sb/api`

| Method | Path | Purpose |
|---|---|---|
| GET | `/kpis` | Dashboard counters |
| GET | `/transactions?search=` | Transactions with customer, merchant, device |
| POST | `/transactions` | Insert a transaction; returns its ID, status and any alert raised |
| GET | `/alerts?risk_level=` | Fraud alerts |
| GET / PUT | `/alerts/:id` | Alert detail / set `{"status": "..."}` |
| GET | `/risk-distribution`, `/daily-analytics`, `/analysts/workload` | Analytics |
| GET | `/accounts?customer_id=`, `/merchants`, `/devices?customer_id=` | Customer portal and transfer form |

## Frontend

| Role | Demo login | Pages |
|---|---|---|
| Fraud analyst | `admin@smartbank.com` / `admin123` | Overview (KPIs, charts, review queue), Transactions (search + filters), Fraud Alerts (review dialog with status actions), Analyst Workload, System & Settings (live endpoint diagnostics) |
| Customer (linked to customer #1, Aarav Sharma) | `user@smartbank.com` / `user123` | Dashboard, My Accounts, Transactions, New Transfer (real `POST /transactions` with fraud result), Profile |

The interface shows live database data only. When the API is unreachable, pages show
an error with Retry and the status indicator turns red. No sample data is substituted.

## Quick start

See [docs/SETUP.md](docs/SETUP.md) for the full setup and [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) for the demonstration script.

```powershell
# 1. Backend: starts the Oracle listener service (UAC prompt) and ORDS, then checks the API
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1

#    If it reports a missing ORDS pool password, run once first:
#    powershell -ExecutionPolicy Bypass -File scripts\repair-ords-pool.ps1   (add -ResetPassword if unknown)

# 2. One time only: publish the latest REST endpoints (hidden SMARTBANK_USER password prompt)
powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1

# 3. Frontend
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

The API URL can be overridden with `VITE_API_BASE_URL` (see `frontend/.env.example`).

## Testing

* `database/13_testing.sql` holds 15 database tests (risk rules, triggers, cursor, package, constraints, rollback).
* `npm run lint` and `npm run build` in `frontend/`.
* Status and results of the latest verification: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Limitations

* **Demo authentication only.** Logins are checked in the browser and roles are enforced only in the UI.
* **The ORDS module is unauthenticated.** Keep ORDS on localhost; do not expose it publicly.
* **Transfers do not move money.** They are recorded in `BANK_TRANSACTION` and screened for fraud, but balances are not changed.
* The backend runs locally. A hosted frontend alone cannot reach a local Oracle/ORDS.
  A manual GitHub Pages workflow is provided for the static interface (see SETUP §6), but it has not been enabled.
