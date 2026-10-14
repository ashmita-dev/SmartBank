# SmartBank — Deployment

_Last updated: 14 Oct 2026_

## Current status

| Part | Status |
|---|---|
| Frontend on GitHub Pages, `https://ashmita-dev.github.io/SmartBank/` | **Online.** It still serves the earlier **read-only** build, which reaches Oracle only through a temporary Cloudflare tunnel to the author's laptop. The new build is published automatically once the cloud API exists. |
| Oracle database + API independent of the laptop | **Not deployed yet.** Everything needed has been built and rehearsed (below). It is waiting on one manual step: creating a free Oracle Cloud account, which only the owner can do. |
| Public transaction submission | Works in the rehearsal environment (below). **Not yet available publicly.** |

## Target architecture

```
Browser ──HTTPS──▶ GitHub Pages                (static React build; no secrets)
   │
   └──HTTPS──▶ Oracle Autonomous Database, Always Free (Oracle Cloud)
                 ├─ ORDS (managed by Oracle):  /ords/sb/api/...  module smartbank.api
                 │     every handler → PKG_SMARTBANK_API  (session check, role, validation)
                 └─ SMARTBANK_USER schema: the same 12 tables, constraints,
                    TRG_VALIDATE_TRANSACTION, TRG_FRAUD_MONITOR → DETECT_FRAUD,
                    CALCULATE_RISK, CLASSIFY_RISK, GENERATE_ALERT, PKG_FRAUD_DETECTION …
```

Nothing runs on the laptop. There is no tunnel, no self-managed server and no open listener
port: Oracle runs ORDS and terminates HTTPS.

### Why this option

| Option | Verdict |
|---|---|
| **A. Oracle Autonomous Database, Always Free** | **Chosen.** Real Oracle Database (19c or 26ai), so the schema, triggers, PL/SQL and package run unchanged. ORDS is built in and served over HTTPS. **Cost: $0.** Limits: 2 databases per account, 20 GB, about 3–6 simultaneous HTTP users (enough for a class demonstration; extra users may briefly get HTTP 429), and it stops after 7 days without activity (see *Keeping it awake*). Source: Oracle's *Always Free Autonomous AI Database* documentation, checked 14 Oct 2026. |
| B. Always-on VM running Oracle Free + ORDS (for example an OCI Always Free compute VM) | Possible and also free, but you would patch the OS, database and ORDS yourself, manage TLS certificates and open a firewall. More work and more risk for the same result. |
| C. General web hosts (Render, Vercel, Netlify, Heroku, …) | Not compatible: none of them host Oracle Database or ORDS. Replacing Oracle with PostgreSQL or SQLite would discard the PL/SQL engine, which is the subject of the project. |
| Laptop + tunnel (previous setup) | Not a hosting solution: it stops when the laptop sleeps, and the address changes on every restart. Retired. |

## Security model

* **Authentication in Oracle.** `POST /auth/login` checks the password against a salted
  PBKDF2-HMAC-SHA256 hash (20,000 iterations) in `API_USER`. On success Oracle returns a random
  256-bit session token. Only a SHA-256 hash of the token is stored (`API_SESSION`), and it
  expires after 8 hours or on sign-out.
* **Authorisation in Oracle.** Every handler calls `PKG_SMARTBANK_API`, which reads the
  `X-Session-Token` header and enforces the role:

  | Operation | Customer | Analyst | Signed out |
  |---|---|---|---|
  | `GET /health` | ✓ | ✓ | ✓ (no data) |
  | `GET /kpis`, `/risk-distribution`, `/daily-analytics`, `/analysts/workload` | 403 | ✓ | 401 |
  | `GET /transactions`, `/alerts`, `/alerts/:id`, `/accounts`, `/devices`, `/customers/:id` | own customer only | all | 401 |
  | `GET /merchants` | ✓ | ✓ | 401 |
  | `POST /transactions` | own accounts only | 403 | 401 |
  | `PUT /alerts/:id` | 403 | ✓ | 401 |

* **Input validation** in PL/SQL: JSON shape and types, positive whole-number IDs, account
  ownership, existing merchant and device, amount above 0, at most ₹1,00,00,000 and at most
  2 decimals, allowed transaction types, and city names limited to letters, spaces and `. , ' ( ) -`.
  `TRG_VALIDATE_TRANSACTION` still applies its own checks. Errors are returned as JSON
  (`400/401/403/404/429`); unexpected Oracle errors return a generic 500 with the error number only.
* **Abuse limits:** 20 transactions per demo account per 10 minutes and 500 per day in total;
  60 alert updates per 10 minutes; an account is locked for 5 minutes after 10 wrong passwords.
* **CORS:** browsers may call the API only from `https://ashmita-dev.github.io` (and
  `localhost` for development).
* **No secrets in the repository or the browser bundle.** Database and demo passwords are
  typed only into Oracle's own console. The CI build fails if the bundle contains credential
  patterns. `VITE_API_BASE_URL` is a public address, not a secret.
* **Audit trail:** `API_EVENT` records sign-ins, failed sign-ins, created transactions and
  alert status changes. These rows also identify which transactions were created through the
  public demo.
* **Not exposed:** no listener port on the laptop. Autonomous Database offers SQL*Net on its
  own TLS-only endpoint (mutual TLS with a wallet by default), managed by Oracle. Database
  Actions (Oracle's web SQL tool) is part of every Autonomous Database and cannot be switched
  off; it requires a database username and password. AutoREST metadata for the schema is set
  to require authentication.
* **Honest limits:** the two demo logins are shared, so anyone who is given a password can
  use that role. That is acceptable only because all data is synthetic and writes are
  rate-limited. A real bank would use individual identities, MFA and an identity provider.

## One-time setup (owner) — about 20 minutes

You need: a browser, an email address, and a credit or debit card **for identity
verification only**. Oracle states that Always Free resources are never charged. Do **not**
click *Upgrade to paid account*; then nothing can be billed.

1. **Create the Oracle Cloud account:** <https://signup.cloud.oracle.com/>. Choose the
   *home region* carefully, because it cannot be changed later; **India West (Mumbai)** supports
   Always Free 26ai databases.
2. **Create the database:** Console → *Oracle Database* → *Autonomous Database* → *Create*.
   * Turn on **Always Free**.
   * Workload type: **Transaction Processing**. Database version: **26ai** (19c also works).
   * Set the **ADMIN password**: keep it in your password manager and never commit it.
   * Network access: **Secure access from everywhere**. This is required, because GitHub
     Pages calls the HTTPS API from visitors' browsers. Do *not* add an IP access-control list;
     it would block visitors.
   * Leave *Require mutual TLS (mTLS) authentication* on. It only affects SQL*Net clients.
3. **Create the schema:** on the database page → *Database actions* → *SQL* (signed in as
   ADMIN). Paste [`deploy/oci/00_admin_setup.sql`](../deploy/oci/00_admin_setup.sql) and replace
   `CHOOSE_A_STRONG_PASSWORD` **in the worksheet only**. Click *Run Script* (F5). Expect
   *User created*, two *Grant succeeded* lines and *PL/SQL procedure successfully completed*.
4. **Install SmartBank as SMARTBANK_USER:** sign out of Database Actions and sign in again
   with username `SMARTBANK_USER` (or open `https://<your-database-host>/ords/sb/_sdw/`
   directly). Signing in works because step 3 REST-enabled the schema. In *SQL*, paste all of
   [`deploy/oci/01_install_smartbank.sql`](../deploy/oci/01_install_smartbank.sql) and click
   *Run Script*. It takes about a minute. The script output must end with
   `SmartBank installation finished`, with no `ORA-` errors.
5. **Create the demo logins:** in the same worksheet, paste
   [`deploy/oci/02_demo_logins.sql`](../deploy/oci/02_demo_logins.sql), replace the two
   placeholder passwords (8+ characters, no single quotes) **in the worksheet only**, and click
   *Run Script*. Keep these two passwords for whoever evaluates the demo.
6. **Check the API:** open `https://<your-database-host>/ords/sb/api/health` in a browser.
   You should see `{"status":"ok", … "fraud_engine":"VALID" …}`.
7. **Connect the frontend:** GitHub → repository → *Settings → Secrets and variables →
   Actions → Variables → New repository variable*:
   * Name `SMARTBANK_API_URL`
   * Value `https://<your-database-host>/ords/sb/api`

   Then *Actions → Deploy frontend → Run workflow*. The workflow checks `/health` before
   publishing and refuses `localhost` or tunnel URLs.

`<your-database-host>` looks like `abcd1234efgh-smartbank.adb.ap-mumbai-1.oraclecloudapps.com`.
It is shown in the Database Actions address, and on the database page under *Tool configuration*.

### Verifying the live deployment

After step 7, the full end-to-end checks can be run from any computer. Put the two demo
passwords in a git-ignored file instead of on the command line:

```powershell
# C:\Projects\SmartBank\.env.demo   (ignored by git via ".env.*"; never commit it)
SMARTBANK_API_URL=https://<your-database-host>/ords/sb/api
SMARTBANK_CUSTOMER_PASSWORD=...
SMARTBANK_ANALYST_PASSWORD=...
E2E_BASE_URL=https://ashmita-dev.github.io/SmartBank/
```

```powershell
# API: 42 read-only checks; add --write for the documented 2-transaction live test (20 more checks)
Get-Content .env.demo | ForEach-Object { $k, $v = $_ -split '=', 2; if ($k -and $k -notmatch '^#') { Set-Item "env:$k" $v } }
node scripts\api-smoke-test.mjs --write
cd frontend; npm run test:e2e      # real Chrome against the public site
```

`--write` inserts exactly two clearly labelled demo transfers for customer #1 (one LOW, one
HIGH), and moves only the alert it created to INVESTIGATING. The browser test inserts one more
HIGH-risk transfer through the New Transfer page. Nothing else is changed.

## Keeping it awake

Oracle **stops** an Always Free database after 7 days without activity, and may **delete** it
after 90 days stopped. `.github/workflows/keep-database-awake.yml` calls `GET /health` every
3 days, which counts as activity. If the database was stopped anyway, start it from the OCI
console (it takes about 5 minutes before ORDS answers). GitHub pauses scheduled workflows in
repositories with no commits for 60 days, so re-enable it from the Actions tab if needed.
There is no backup or point-in-time restore on Always Free. The data is the synthetic seed,
which `01_install_smartbank.sql` recreates.

## What was rehearsed (14 Oct 2026)

Autonomous Database cannot be created without the owner's account, so the exact deployment
scripts were rehearsed against a **disposable Oracle Database 23ai Free container** (Docker
image `gvenzl/oracle-free:23-slim-faststart`, UTC time zone like Autonomous Database), with
**ORDS 26.2.3** installed into it and serving on `127.0.0.1:8181`. The rehearsal used the same
files, in the same order:

| Step | Result |
|---|---|
| `00_admin_setup.sql` (tablespace `USERS` instead of `DATA`, the only difference) | User, grants and `ORDS_ADMIN.ENABLE_SCHEMA` succeeded |
| `01_install_smartbank.sql` on an empty schema | **Exit 0, no errors.** 15 tables, 2 triggers, 2 functions, 3 procedures, 2 packages, 4 views, 30 indexes, all VALID; 208 seed rows; 101 transactions replayed through the trigger → 84 alerts, 3 HIGH = 3 FLAGGED |
| `02_demo_logins.sql` | Created both logins; refuses unedited placeholder passwords |
| `scripts/api-smoke-test.mjs --write` | **62/62 passed** (see PROJECT_STATUS.md) |
| `frontend` browser test (`npm run test:e2e`, real Chrome, Pages-style `/SmartBank/` build) | **20/20 passed** |

Two problems were found and fixed during the rehearsal: `03_seed_data.sql` had 158 statements
that SQL*Plus never ran (a `-- comment` after the `;`), and a package function was being called
from SQL. Neither would have been caught without a clean install.

## Local development (unchanged workflow)

The laptop database keeps working for development: `scripts\start-backend.ps1`, then
`scripts\register-endpoints.ps1` (now also installs the security layer and sets the local demo
passwords), then `npm run dev` in `frontend/`. See [SETUP.md](SETUP.md).
