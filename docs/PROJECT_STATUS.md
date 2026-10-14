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

### Fourth pass: live API verified (14 Oct 2026)

The owner stored the existing `ORDS_PUBLIC_USER` password with `repair-ords-pool.ps1`
(no password was changed), and ORDS reports the `smartbank` pool as VALID.

| Test (against the real ORDS + Oracle) | Result |
|---|---|
| `GET /kpis` | **200**: 15 customers, 20 accounts, 101 transactions, 75 alerts, 72 open, 3 high risk |
| `GET /transactions`, `/alerts`, `/alerts/81`, `/risk-distribution`, `/daily-analytics`, `/analysts/workload` | **All 200**, fields as the frontend expects |
| ORDS default page size | 50 rows with `hasMore=true`. With the frontend's `limit` parameter, all 101 are returned, so the pagination fix is confirmed. |
| CORS preflight (`POST` from `http://localhost:5173`) | **Allowed** |
| `GET /accounts`, `/merchants`, `/devices` | **404**: not registered yet |
| `npm run lint` / `npm run build` | **Pass** |
| Read-only browser test against the live API (16 checks, headless Chrome) | **16/16 pass**: live KPIs and chart, all 101 transactions, FLAGGED filter (3), search, alert detail dialog, analyst workload, endpoint diagnostics (6/9 as expected), customer scoping (11 transactions), honest fallbacks. **No write requests sent, no console errors.** |
| Table checksums before/after testing | Unchanged: `BANK_TRANSACTION` 101 rows (max id 201), `FRAUD_ALERT` 75 rows (max id 81) |

**Write-path impact analysis (verified, not yet executed).** All six deployed objects on the
insert path (`CALCULATE_RISK`, `CLASSIFY_RISK`, `DETECT_FRAUD`, `GENERATE_ALERT`, both
triggers) match the repository source exactly. One transfer inserts 1 `BANK_TRANSACTION` row
and at most 1 `FRAUD_ALERT` row, and can update only the new transaction's status
(`WHERE transaction_id = p_transaction_id`). No statement touches balances or existing rows.

**Live write test: not run yet.** The authorised test must go through the transfer page,
which stays disabled until `/merchants` and `/devices` exist. Registering them needs the
`SMARTBANK_USER` password.

### Fifth pass: issues found in the browser (14 Oct 2026)

**Fraud engine, verified against the live data** (read-only queries):

| Fact | Live result |
|---|---|
| Transaction statuses | 98 COMPLETED, 3 FLAGGED |
| Alerts | 3 HIGH (score 80, INVESTIGATING), 72 MEDIUM (40–65, OPEN) |
| HIGH alert → transaction FLAGGED | 3 of 3 |
| MEDIUM alert → transaction stays COMPLETED | 72 of 72 (by design in `DETECT_FRAUD`) |
| FLAGGED without a HIGH alert | 0 |
| Customer #1 | 11 transactions, 0 FLAGGED, **8 with an OPEN MEDIUM alert** |

The engine matches its specification. The customer KPI "Flagged for review: 0" counted only
FLAGGED status and ignored open MEDIUM alerts. It is now split into **Under fraud review**
(8, from the customer's own OPEN/INVESTIGATING alerts) and **Flagged (high risk)** (0, from
payment status). Transaction tables show payment status and fraud review as separate columns.

**Fixes:** the customer name is read from the database (`GET /customers/:id`, falling back to the
name on the customer's own transactions); nothing is hard-coded. "Customer #1" was removed.
`14_demo_customer_profile.sql` renames customer #1 to Ashmita Mazumdar. The health indicator
probes every endpoint the portal needs (online / degraded / offline). ORDS's raw "Not Found"
is replaced with "The GET /x endpoint is not published in ORDS yet…" plus a working Retry, and
data that failed to load shows "—" instead of 0.

| Test | Result |
|---|---|
| New GET handler SQL (`accounts`, `merchants`, `devices`, `customers/:id`), read-only | 20 accounts / 20 distinct IDs (no duplicates); customer 1 → 2 accounts; 8 merchants; 12 devices; 1 profile row |
| `POST /transactions`, `PUT /alerts/:id` PL/SQL | Both compile (`DBMS_SQL.PARSE`, not executed) |
| `npm run lint` / `npm run build` | **Pass** |
| Live read-only browser test, 27 checks (identity, KPIs, fraud columns and filters, helpful errors, health states, alerts page, diagnostics) | **27/27 pass**, no write requests, no console errors |
| Mocked full UI suite (includes the transfer and alert-status UI) | **37/37 pass** |
| Table checksums before/after | **Identical** (no data changed) |
| `13_testing.sql` as an isolated write test | **Not suitable**: tests 1–9 commit their rows; not run against live data |

### Sixth pass: full audit, reliability and diagnostics (14 Oct 2026, evening)

**Prioritised checklist** (✅ done this pass, ☑ verified already correct, ⏳ needs you)

| # | Priority | Item | State |
|---|---|---|---|
| 1 | Critical | `/accounts`, `/merchants`, `/devices`, `/customers/:id` published | ☑ live: you ran `register-endpoints.ps1`; all return 200 |
| 2 | Critical | Customer #1 shows as Ashmita Mazumdar (from `CUSTOMER`) | ☑ live; only that row changed (checked against the pre-rename export) |
| 3 | Critical | Requests could hang forever on a stuck ORDS/database | ✅ 15 s timeout with a clear message |
| 4 | High | A slow earlier response could overwrite a newer refresh | ✅ sequence-numbered loads in `useApiData`; repeated Refresh clicks reuse the running request |
| 5 | High | Malformed responses (HTML/text instead of a JSON list) treated as empty data | ✅ now an explicit "unexpected response format" error |
| 6 | High | Alert actions trusted a PUT response without a status | ✅ reads the alert back with `GET /alerts/:id` before claiming it was saved; list reloads after success |
| 7 | High | Transfer: Submit disabled with no explanation; double click could send two POSTs | ✅ inline amount errors (> ₹0, ≤ ₹1,00,00,000 trigger limit, 2 decimals), list of missing fields, synchronous double-submit guard |
| 8 | High | Transfer above the displayed balance | ✅ allowed but explained: the database does not debit balances, so it does not check them |
| 9 | High | Diagnostics: no HTTP codes, no time, no run guard | ✅ Not tested / Testing / Healthy / Failed per endpoint, HTTP status, row count and latency, last-tested time, summary, overlapping runs blocked |
| 10 | Medium | Risk model text vs `CALCULATE_RISK` | ✅ location rule corrected ("none of the customer's address cities"); 5-step pipeline added; "rule-based point total, not a probability" |
| 11 | Medium | Database objects claimed without verification | ✅ list checked against `DBA_OBJECTS` (read-only): 12 tables, 4 views, 2 functions, 3 procedures, 2 triggers, package spec + body, all VALID; page states the date |
| 12 | Medium | Demonstration limits written for developers | ✅ rewritten in plain language (demo login, UI-only roles, unauthenticated API, filter-based isolation, no money movement, rule-based scoring, what production needs) |
| 13 | ☑ | KPI "Fraud Alerts" = 75 | ☑ `/kpis.flagged_transactions` is `COUNT(*) FROM fraud_alert`; labelled as alerts, not FLAGGED payments (3) |
| 14 | ☑ | Payment status vs fraud review, customer scoping, INR formatting, login/logout/role redirects | ☑ verified by the browser suites below |
| 15 | ⏳ | Live write test (transfer → alert) | Needs your approval: it adds permanent rows |

**Tests run in this pass**

| Test | Result |
|---|---|
| `npm run lint`, `npm run build` | **Pass** |
| Live read-only suite against the real API (`after` mode: name, KPIs 8/0, fraud columns and filter, accounts with balances, transfer form 8 merchants / 12 devices / 2 accounts, admin 101/75/72/3, 75 alerts, diagnostics 10/10 healthy, settings text) | **26/26 pass**, no write requests, no console errors |
| Live read-only route suite: logged-out redirects, invalid login error, both demo logins, cross-role redirects, refresh keeps the route, logout, all 10 routes at 1440 px and 390 px (no `undefined`/`NaN`/invalid dates, no horizontal scroll), mobile menu, transfer validation (never submitted) | **35/35 pass**, no write requests, no console errors |
| Mocked full suite (incl. transfer submission and alert status change, against a local stand-in API, not Oracle) | **37/37 pass** |
| Degraded modes: API offline (incl. diagnostics showing 10 failed, none healthy) / endpoints missing | **6/6** and **4/4 pass** |
| Table checksums after testing | `ACCOUNT`, `BANK_TRANSACTION`, `FRAUD_ALERT` identical to before; `CUSTOMER` differs only by your customer #1 rename. Highest IDs still txn 201 / alert 81 |

**Not run:** any live write (transfer POST or alert PUT against Oracle) and `13_testing.sql`
(tests 1–9 commit rows). Both need your approval.

## Remaining work (needs you)

1. ~~Run `scripts\register-endpoints.ps1`~~ **Done**: all 13 handlers are live and customer #1
   is Ashmita Mazumdar.
2. Optional live write test (permanent: cleanup would require deleting rows, which is not done):
   as customer #1, transfer ₹1,50,000 to *QuickCash Loans* from AC1000001, location `Lagos`, device
   `DEV-WIN-0003`. Expected: FLAGGED, HIGH alert, score 80. Run only with explicit approval.

## Known limitations
* Demo authentication runs in the browser; roles are enforced only in the UI. The ORDS module has no OAuth.
* Transfers record and screen a transaction but do not move balances.
* The risk preview on the transfer form is a client-side hint. `CALCULATE_RISK` is authoritative.
* Customer isolation is a query filter in the frontend; ORDS would return any customer's rows if asked.
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
