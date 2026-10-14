# SmartBank — Deployment

_Last updated: 14 Oct 2026_

## Public frontend URL

**https://ashmita-dev.github.io/SmartBank/** (GitHub Pages, published by `.github/workflows/deploy-frontend.yml`).

## What works where

| | Public link (GitHub Pages) | Author's computer |
|---|---|---|
| Mode | **DEMO MODE** | **REAL ORACLE MODE** |
| Needs the laptop on? | No | Yes: Oracle XE, the listener service and ORDS |
| Sign-in | Simulated: demo emails, no password | The authenticated API (Oracle checks passwords) after `register-endpoints.ps1`; until then the older module, with a notice that the password is not checked |
| Data shown | Synthetic seed replayed in the browser | Live `SMARTBANK_USER` schema |
| New transfer | Simulated in the browser, labelled *SIMULATED, not processed by Oracle* | Inserted into `BANK_TRANSACTION`, scored by `TRG_FRAUD_MONITOR → DETECT_FRAUD` |
| Analyst alert actions | Simulated, labelled | Saved in `FRAUD_ALERT` |
| Persistence | This browser's storage (Reset button) | Oracle |

## Why the public link stopped working (diagnosed 14 Oct 2026)

1. The deployed bundle had a Cloudflare **quick tunnel** address hard-coded
   (`https://jay-wherever-knives-interventions.trycloudflare.com/api`).
2. The tunnel ran on the laptop (`cloudflared` → `gateway/server.mjs` → ORDS). Its log shows it
   losing its connection to Cloudflare from about 16:00 UTC: `failed to dial to edge with quic:
   timeout` and `A socket operation was attempted to an unreachable network`. The network appears
   to block cloudflared's outbound UDP/7844. While disconnected, the random hostname stopped
   resolving, so every API call from the public site failed: "Database unreachable" / "API offline".
3. Quick-tunnel hostnames also change on every restart, and the gateway only allowed GET requests,
   so even a working tunnel could never accept public transactions.

The tunnel approach is retired: the gateway and tunnel script were removed from the repository,
and the workflow now refuses `trycloudflare.com` URLs. (The `cloudflared` process that may still be
running on the laptop no longer serves anything the site uses; stop it in Task Manager if wanted.)

## Free, persistent Oracle hosting: what was evaluated

| Option | Free? | Blocker | Status |
|---|---|---|---|
| Oracle Cloud **Always Free Autonomous Database** (managed ORDS, HTTPS) | $0, but sign-up requires a credit/debit card for identity verification | The owner chose not to enter card details | Not used. Scripts in `deploy/oci/` are ready and were rehearsed (below) in case that changes. |
| Oracle **free APEX evaluation service** (apex.oracle.com, now oracleapex.com): Oracle Database + RESTful Services | Yes; Oracle says no payment is needed | Needs the owner to request a workspace (a new account). It is for demonstrations only, and workspaces are purged after 60 days of inactivity with no backups. Whether it grants `DBMS_CRYPTO` (used by the authenticated API) and allows the CORS settings is **unverified** | Not used; see *Optional next step* |
| General free hosts (Render, Vercel, Netlify, Fly, …) | Some tiers are free | None of them hosts Oracle Database or ORDS. Replacing Oracle would drop the PL/SQL engine that the project is about | Rejected |
| Laptop + tunnel | Free | Not persistent; blocked on the campus network | Retired |

**Conclusion:** without a new account, no free, persistent public Oracle backend is available.
The public site therefore runs DEMO MODE, and genuine Oracle processing is demonstrated locally.

## DEMO MODE (public)

* Built with `VITE_DEMO_MODE=true`. The workflow chooses it automatically whenever the
  repository variable `SMARTBANK_API_URL` is not set.
* `frontend/src/demo/demoApi.js` answers the same endpoints, JSON shapes, roles and validation
  messages as `PKG_SMARTBANK_API`, entirely in the browser. **No network request is made**: the
  browser test confirms that only the site's own files and Google Fonts are loaded.
* Data: `frontend/src/demo/seedData.json`, generated from `database/03_seed_data.sql` and
  `14_demo_customer_profile.sql` by `scripts/build-demo-data.mjs` (CI fails if it is stale).
* Scoring: `frontend/src/demo/fraudEngine.js`, a rule-by-rule copy of `CALCULATE_RISK`,
  `CLASSIFY_RISK`, `DETECT_FRAUD` and `GENERATE_ALERT`. Replaying the seed gives 84 alerts,
  3 HIGH and 3 FLAGGED, identical to the Oracle 23ai install of the same script; a unit test enforces it.
* Labelling: an amber banner on every signed-in page (*DEMO MODE: simulated, not connected to
  Oracle*), the status badge reads **DEMO MODE** (never LIVE), transfer results say *SIMULATED, not
  processed by Oracle*, alert changes say *in the demo simulation (this browser only, not Oracle)*,
  and created rows carry a **SIMULATED** tag.
* Try it locally: `cd frontend; $env:VITE_DEMO_MODE="true"; npm run dev`.

## REAL ORACLE MODE (local)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1   # listener (UAC) + ORDS
cd frontend; npm ci; npm run dev                                       # http://localhost:5173
```

* Sign in as `user@smartbank.com` (customer) or `admin@smartbank.com` (analyst).
* With the laptop's current, **older** REST module the app shows *"Local Oracle API without
  server-side sign-in detected"* and does not check the password. Data and transfers are real Oracle.
  It falls back like this only when the API is on `localhost` **and** the old module is confirmed
  (an unauthenticated `GET /merchants` succeeds); a hosted build never does.
* Optional: `scripts\register-endpoints.ps1` installs the authenticated API (`15_api_security.sql`
  + new `ords_endpoints.sql`), grants `DBMS_CRYPTO`, and sets the demo passwords through hidden
  prompts. After that, Oracle verifies passwords and enforces roles.
* ✅ Verified on 14 Oct 2026 (evening): transactions #241 (LOW) and #242 (HIGH, FLAGGED, alert #121) were created through this path and confirmed in Oracle (PROJECT_STATUS.md, tenth pass).
* Genuine transaction test: **New Transfer** → payee *QuickCash Loans*, `150000`, `Lagos`, a device
  marked *new for this account* (DEV-WIN-0003 is no longer new; use for example DEV-MAC-0006) → **Submit transfer**. Expected: a new transaction ID, HIGH,
  FLAGGED, and a fraud alert. Then check `BANK_TRANSACTION` / `FRAUD_ALERT` in SQL (README).

## Optional next step for a public Oracle backend (needs the owner)

If a real public Oracle demo is wanted later, the smallest path that needs **no payment**:

1. Request a free workspace at <https://apex.oracle.com> (email sign-up; demo use only).
2. Tell the assistant it exists. The assistant would then check, in that workspace, whether
   `DBMS_CRYPTO` is available and whether RESTful Services allow the GitHub Pages origin, before
   adapting the install scripts. Nothing is promised until that has been verified.
3. Set the repository variable `SMARTBANK_API_URL` to the verified API URL. The workflow then
   builds REAL ORACLE MODE automatically (after a `/health` check).

Alternatively, with card verification (still $0): the Oracle Cloud steps below.

## Oracle Cloud Always Free (not used: needs card verification)

### Steps, kept for reference

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

#### Verifying a hosted deployment

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

#### Keeping it awake

Oracle **stops** an Always Free database after 7 days without activity, and may **delete** it
after 90 days stopped. `.github/workflows/keep-database-awake.yml` calls `GET /health` every
3 days, which counts as activity. If the database was stopped anyway, start it from the OCI
console (it takes about 5 minutes before ORDS answers). GitHub pauses scheduled workflows in
repositories with no commits for 60 days, so re-enable it from the Actions tab if needed.
There is no backup or point-in-time restore on Always Free. The data is the synthetic seed,
which `01_install_smartbank.sql` recreates.

## Security model of the authenticated API (local, or any future hosted Oracle)

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


## Local development

See [SETUP.md](SETUP.md).
