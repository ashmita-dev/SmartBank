# SmartBank — Project Status

_Last updated: 14 Oct 2026_

## Completed

### Database (Oracle 21c XE, schema `SMARTBANK_USER` in `XEPDB1`)
* All 12 tables, 2 triggers, 2 functions, 3 procedures, 1 package and 4 views exist in the
  live schema and have status **VALID** (checked in the data dictionary on 14 Oct 2026).
  The live data: 15 customers, 20 accounts, 101 transactions, 75 fraud alerts, 2 analysts.
* Risk model as specified: LOW 0–39, MEDIUM 40–69, HIGH 70–100. The rules are amount,
  rapid transactions, unrecognised device and unusual location.
* **Recovered `01_tables.sql` and `03_seed_data.sql`.** Both had been committed as empty
  files. They were rebuilt from the live schema with read-only dictionary and table queries.
* **ORDS fixes** in `ords_endpoints.sql`:
  * `PUT /alerts/:id` now applies the requested status (validated against the CHECK
    constraint values) instead of always setting INVESTIGATING. It returns JSON, or 404/400
    JSON errors. Previously it returned its row through an undeclared `:result` bind.
  * `POST /transactions` returns the new `transaction_id`, its status and any fraud alert,
    and turns validation/trigger errors into readable 400 JSON.
  * New read-only endpoints: `GET /accounts`, `/merchants`, `/devices`.
* Day-4 and Day-5 test scripts preserved under `database/tests/`.

### Frontend (React + Vite)
* **Navigation fixed.** Only `/admin` previously had a sidebar. `/admin/*` sub-pages and every
  `/user/*` page rendered without navigation or sign-out. All routes now share one layout.
* `react-router-dom` added to `package.json`. It was imported but missing, so a fresh clone could not build.
* **Real data only, no fake success:**
  * The transfer page used to show "Transfer Request Created" without calling any API.
    It now posts to `POST /transactions` and shows the database result (ID, status, alert).
    It states clearly that balances are not moved.
  * My Accounts showed hard-coded balances. It now reads `GET /accounts`.
  * The admin and user settings pages had "Save" buttons that saved nothing. They were replaced
    with live endpoint diagnostics, the read-only risk model and a statement of demo limits.
  * "System Online / Oracle + ORDS connected" and "LIVE" were hard-coded. They now reflect a real API check.
* **Customer portal scoped to the customer.** It previously listed every customer's
  transactions. The demo login is now linked to customer #1.
* Bugs fixed: transaction status was read from the wrong field, so FLAGGED never matched;
  daily chart dates were missing (`txn_date`); ORDS 50-row pagination hid half the
  transactions; empty 201 responses would have crashed JSON parsing.
* Alert review dialog: full context (customer, merchant, device, analyst) and all status
  transitions. Analyst workload shows the full status breakdown.
* Search and filters: by customer, account, merchant, device, location; status, type and risk filters.
* Accessibility: keyboard-operable tables and dialogs (Enter, Escape), focus rings, skip link,
  ARIA labels, larger type (8–9 px text raised to 10.5–13 px).
* Responsive down to 390 px. Route-level code splitting, so the customer portal skips the chart library.

## Tests executed (14 Oct 2026)

| Test | Command / method | Result |
|---|---|---|
| Lint | `npm run lint` | **Pass** (0 problems) |
| Production build | `npm run build` | **Pass** |
| Live schema objects | Read-only `DBA_OBJECTS` query | **Pass**: all objects VALID |
| Live ORDS handlers | Read-only `ORDS_METADATA` query | 9 handlers, matching the original script |
| UI end-to-end, 37 checks | Headless Chrome (DevTools Protocol) against a **local mock ORDS server serving JSON exported read-only from the live schema** | **37/37 pass, 0 console errors**: logins, role guards, all 11 routes, search/filters, alert review, transfer flow, analyst diagnostics, mobile layout |
| Degraded modes, 9 checks | Same harness: API offline; old ORDS module without the new endpoints | **9/9 pass**: clear errors, no invented data, transfer disabled with explanation |

### Second pass (14 Oct 2026, afternoon)

| Step | Result |
|---|---|
| Found every obsolete IP | `listener.ora` (10.168.41.144), `tnsnames.ora` (10.168.42.20, two aliases), DB parameter `LOCAL_LISTENER` (10.168.41.144), ORDS `pool.xml` (10.168.41.144). The current Wi-Fi IP is 10.168.59.154. |
| Repointed all four to `localhost` | **Done**; backups saved as `*.bak-20261014` |
| User-mode listener on `localhost:1521` | Started, and `xepdb1` registered, which confirms the new `LOCAL_LISTENER` works |
| ORDS started | Started and reached the listener, but got **ORA-12518**: a listener running as the user cannot hand off to the DB service (`NT SERVICE\OracleServiceXE`). Stopped again. |
| Start the listener **service** | **Blocked**: `OpenSCManager err=5` (not elevated); the elevation request was not permitted in this session |
| Register endpoints | **Not done**: needs the `SMARTBANK_USER` password. `scripts/register-endpoints.ps1` added for a one-command run. |
| Lint / build | **Pass** (also a `/SmartBank/` sub-path build) |
| UI end-to-end (mock API) | **37/37 pass**, 0 console errors (re-run after the router change) |
| Sub-path routing (GitHub Pages layout) | **Pass**: `/SmartBank/login` renders; `/SmartBank/admin` redirects to login |

### Not tested against a live API
* No request has reached the real ORDS with a working database connection. That waits on
  the listener service starting (see below).
* The updated `ords_endpoints.sql` has **not been run** against the database.
* `01_tables.sql` / `03_seed_data.sql` have not been executed on a fresh schema; `13_testing.sql` was not re-run.

### Third pass: ORDS startup failure diagnosed (14 Oct 2026)

* The listener **service** is now running (started via `start-backend.ps1`), and `xepdb1` is registered on `localhost:1521`.
* First exception in the full ORDS log (at startup, before any request):
  `The pool named: |smartbank|lo| is invalid and will be ignored: ... The database password secret in the wallet associated with the pool ... is missing`.
  Requests then fail with HTTP 571, root cause `ORA-01005: null password given`. The
  `TenantMapping…` frames are where ORDS reports the ignored pool, not the cause.
* Confirmed with `ords config --db-pool smartbank list`: every setting is present except
  `db.password`. `ORDS_PUBLIC_USER` is OPEN and not expired. The network path is fine.
* Added `scripts/repair-ords-pool.ps1` and a pre-flight check in `start-backend.ps1`.

## Remaining work (needs you, about 3 minutes)

1. `powershell -ExecutionPolicy Bypass -File scripts\repair-ords-pool.ps1`: type the `ORDS_PUBLIC_USER` password, **or** add `-ResetPassword` if nobody knows it.
2. `powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1` (expect "API is up").
3. `powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1`, then type the `SMARTBANK_USER` password (expect "All 9 endpoints respond").
4. Optional: run the transfer scenario from DEMO_GUIDE §3 to see trigger → alert integration live.

## Known limitations
* Demo authentication runs in the browser; roles are enforced only in the UI. The ORDS module has no OAuth.
* Transfers record and screen a transaction but do not move balances.
* The risk preview on the transfer form is a client-side hint. `CALCULATE_RISK` is authoritative.
* Re-running `03_seed_data.sql` regenerates alerts through the trigger, so statuses return to OPEN.

## Deployment status
**Not deployed.** The only provider available is GitHub: the CLI is authenticated and the repo
is public, but Pages is not enabled. Enabling it is a repository settings change that was not
made without your approval. Prepared instead:
* `.github/workflows/deploy-frontend.yml`, a manual-only build-and-publish to GitHub Pages
* sub-path support (`BASE_PATH` build variable and router `basename`), verified locally

A hosted copy would show the interface only, with "API offline" for visitors. ORDS must not
be exposed publicly while the module has no authentication. The supported demonstration
setup is local.
