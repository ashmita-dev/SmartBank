# SmartBank — Project Status

_Last updated: 14 Oct 2026 (ninth pass)_

## Current status at a glance

| Question | Answer (verified 14 Oct 2026) |
|---|---|
| Public frontend URL | `https://ashmita-dev.github.io/SmartBank/` |
| What the public link does | **DEMO MODE**, after this pass's deployment: an in-browser simulation, labelled on every page. It makes no API calls and never claims Oracle processed anything. |
| Is a public Oracle backend running? | **No.** No free option exists without a new account; Oracle Cloud needs card verification, which the owner declined. See [DEPLOYMENT.md](DEPLOYMENT.md). |
| Genuine Oracle transactions | On the author's computer (REAL ORACLE MODE). Verified read-only against the laptop database this pass; full insert → trigger → alert verified on the Oracle 23ai rehearsal. |
| Why the public site said "API offline" | The bundle pointed at a Cloudflare quick tunnel to the laptop; cloudflared lost its connection (the network blocked QUIC/UDP 7844) and the hostname stopped resolving. |
| Local laptop API | Still the **older, unauthenticated** module. The current frontend supports it, with a notice; `register-endpoints.ps1` upgrades it. |

## Ninth pass: public DEMO MODE and local compatibility (14 Oct 2026)

**Diagnosis:** see the table above and DEPLOYMENT.md, *Why the public link stopped working*.

**Found:** the previous pass's frontend required `/auth/login`, which the laptop's older ORDS
module does not have. The local Oracle demonstration would have failed at sign-in until
`register-endpoints.ps1` was run. Fixed with a guarded fallback: it applies only when the API is on
localhost **and** an unauthenticated `GET /merchants` succeeds (the older module), and it is labelled.
The older `POST /transactions` reply (no score for LOW risk) is now displayed correctly.

**Built:** DEMO MODE (`VITE_DEMO_MODE=true`): `frontend/src/demo/` (simulated API, JS fraud
engine, seed JSON generated from `03_seed_data.sql`), a demo banner on every page, a DEMO MODE
badge, a SIMULATED tag on created rows, and a reset button. The workflow publishes DEMO MODE unless
`SMARTBANK_API_URL` is set and healthy, and rejects tunnel URLs.

**Tests run (all actually executed)**

| Test | Result |
|---|---|
| `npm run lint` | **Pass** |
| `npm test` (Vitest) | **38/38**: includes the demo engine replay = Oracle totals (84 alerts, 3 HIGH, 3 FLAGGED, 8 for customer #1), the rule-by-rule scores, demo labelling with no network calls, the older local API fallback (and that it is *not* used for a hosted, new or unreachable API), and the older POST reply |
| Demo-mode production build at `/SmartBank/` + bundle scans | **Pass**: no `trycloudflare.com` URL, no credential patterns |
| `npm run test:e2e:demo` (real Chrome, local preview of the Pages build) | **24/24**: banner and DEMO MODE badge on all 10 routes after direct link and refresh; simulated transfer = score 80, HIGH, FLAGGED, alert #85; labelled SIMULATED and never "inserted into BANK_TRANSACTION"; persists after refresh; analyst sees the tagged alert; alert change labelled simulated; reset; 390 px without horizontal scroll; no request except site files and Google Fonts; no console errors |
| Real Chrome against the **laptop's live Oracle**, read-only | **12/12**: older-module sign-in with notice; name from `CUSTOMER`; LIVE badge; 12 customer transactions; transfer form with 8 payees (not submitted); analyst overview "Connected to Oracle" (102 transactions, 76 alerts); 76 alerts; refresh; **no write requests**; no page errors |
| Transfer submitted to the laptop database | **Not run**: it writes permanent rows; needs the owner's approval |
| Public site after deployment | Recorded in the commit and deployment notes below this table once checked |

## Eighth pass: production architecture, server-side security, rehearsal (14 Oct 2026)

**Audit findings**
* Pages is enabled and serving; the last deployment (manual run, 14:25 UTC) was built against
  `https://jay-wherever-knives-interventions.trycloudflare.com/api`, which answered while the laptop was on.
* The laptop's ORDS module had no authentication; login was checked in the browser with
  passwords in the JavaScript bundle; customer isolation was a frontend filter.
* `03_seed_data.sql` could not build a fresh schema: 158 `INSERT … ; -- id n` lines are never
  executed by SQL*Plus, because the `;` is not the last character on the line. Fixed (`/* id n */;`).
* ORDS returned `transaction_time` with a `Z` (UTC) suffix for IST wall-clock values, so new
  transactions showed 5½ hours late in the browser. Fixed: the API now converts explicitly to UTC.

**Built**
* `database/15_api_security.sql`: `API_USER` (salted PBKDF2-HMAC-SHA256), `API_SESSION`
  (SHA-256 of random 256-bit tokens, 8-hour expiry), `API_EVENT` (audit and rate limits), and
  `PKG_SMARTBANK_API`, which every REST handler calls: session check, CUSTOMER / ANALYST role,
  customer scoping in SQL, input validation, rate limits and JSON errors. Core tables and fraud engine unchanged.
* `database/ords_endpoints.sql` rewritten: 18 one-line handlers; the token comes from the
  `X-Session-Token` header; CORS is limited to GitHub Pages and localhost.
* `POST /transactions` validates, checks account ownership, inserts once, lets
  `TRG_FRAUD_MONITOR → DETECT_FRAUD` run (never called again by the API), and returns the
  committed ID, status, score, level, reasons and alert. LOW risk stores no alert, so its score
  comes from `CALCULATE_RISK` (read-only).
* `deploy/oci/`: `00_admin_setup.sql`, a generated `01_install_smartbank.sql` (via
  `scripts/build-cloud-install.mjs`, checked in CI), and `02_demo_logins.sql`.
* Frontend: server-side sign-in, token on every request, session kept across refresh and
  re-checked with the server, automatic sign-out on 401, no passwords in the bundle, transfer
  result shows the database's score, level, reasons and alert, and database labels match the build.
* CI/CD: tests on every push; Pages deploys only when `SMARTBANK_API_URL` is set and `/health`
  answers; a keep-awake workflow. Removed the laptop gateway and tunnel script.
* Tests: Vitest (23), `scripts/api-smoke-test.mjs` (42 read-only + 20 write checks),
  `frontend/e2e/run-e2e.mjs` (real Chrome, 20 checks).

**Tests run (all actually executed)**

| Test | Environment | Result |
|---|---|---|
| `npm run lint` | local | **Pass** |
| `npm test` (Vitest) | local, fake API | **23/23** |
| `npm run build` (also `/SmartBank/` base) | local | **Pass** |
| `npm audit` | local | **0 vulnerabilities** (one build-tool advisory fixed with `npm audit fix`) |
| Clean install of `00` → `01` → `02` on an empty schema | Rehearsal: Docker `gvenzl/oracle-free:23-slim-faststart`, ORDS 26.2.3 on 127.0.0.1:8181 | **Exit 0, no errors**; all objects VALID; 101 transactions → 84 alerts (3 HIGH = 3 FLAGGED) |
| `api-smoke-test.mjs --write` | Rehearsal | **62/62**: health; 401 without or with a forged token; wrong password; 403 for wrong role; customer scoping (11 own rows, other `customer_id` ignored); CORS allowed for Pages, refused for an unknown origin; 9 invalid inputs rejected with nothing inserted; LOW transfer (score 0 = predicted, no alert, COMPLETED); HIGH transfer (score 95 = predicted, FLAGGED, exactly 1 alert, reasons match, assigned to Kavita Rao); analyst moves that alert to INVESTIGATING and the customer sees it; signed-out token refused |
| `npm run test:e2e` (real Chrome) | Rehearsal + Pages-style build at `/SmartBank/` | **20/20**: deep-link redirect, server rejects a wrong password, both logins, live data, refresh keeps the session, transfer via the UI → #223, score 100, alert, FLAGGED, listed after refresh, analyst finds and opens the alert, role redirect, no console errors |
| Same suites against the cloud deployment | — | **Not run**: the cloud database does not exist yet |
| Laptop XE database | — | **Not changed in this pass** (no writes, no installs). The new frontend needs `register-endpoints.ps1` run there before it can sign in locally. |

The 62-check API run and the 20-check browser run were repeated after a final clean reinstall from the committed scripts, with the same results.

## History of earlier passes

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

### Seventh pass: public deployment preparation (14 Oct 2026, evening)

**Audit findings**
* ORDS listened on **all interfaces** (`:::8080`), and Windows Firewall allowed Java inbound on
  the Public profile, so the unauthenticated module, including POST/PUT, was reachable from the
  local network. Fixed: `standalone.binds = 127.0.0.1,::1` (verified on a temporary second ORDS
  instance on port 8081: it answers on 127.0.0.1 and ::1 and refuses the LAN address). The running
  instance on 8080 picks it up at its next restart.
* The production build fell back to `http://localhost:8080/...`, so a hosted copy would have called
  each visitor's own computer. Fixed: the localhost default applies only when the page is served
  from localhost; otherwise the app says no backend is configured.
* The ORDS module has no authentication and is CORS-open. It must not be tunnelled directly.
* No tunnel tool is installed. GitHub CLI is signed in; the repo is public; Pages is not enabled.

**Built**
* `gateway/server.mjs`: read-only GET allow-list gateway (no dependencies).
* `VITE_READ_ONLY`: disables New Transfer and alert actions with an explanation; non-GET requests
  are refused in the client too.
* Health badge: every endpoint answering 502/503/504 now shows OFFLINE (not DEGRADED).
* Workflow inputs `api_base_url` / `read_only`, URL validation, bundle credential scan.
* `scripts/start-public-demo.ps1` (not run: it would expose the gateway publicly).
* Page title "SmartBank · Fraud Detection" instead of "frontend".

**Tests run**

| Test | Result |
|---|---|
| Lint, production build | **Pass** |
| Gateway against live ORDS: 11 GETs (incl. `/alerts/:id`) | **200**, no internal ORDS links in responses |
| Gateway: POST/PUT/DELETE · unknown path · path traversal · `customers/1;drop` · foreign Origin · preflight | **405 · 404 · 404 · 404 · no CORS header · 204 with CORS** |
| Gateway listens on | `127.0.0.1:8787` only |
| Hosted build (`/SmartBank/`, read-only, via gateway, live Oracle): 10 routes by direct link, refresh, KPIs, diagnostics 10/10, disabled write actions, no request to `:8080`, no writes | **19/19** |
| Hosted build, gateway up but backend down | **5/5** (OFFLINE badge, "backend is offline") |
| Build without `VITE_API_BASE_URL`, served as `http://smartbank.test` | Says "not connected to a backend", no data, no localhost request (4/4 relevant checks; the 5th failed only because the Python test server has no SPA fallback) |
| Bundle scan | No `localhost:8080`, no credential strings (only the intentional demo logins) |
| Local mode: live suites | **26/26** and **35/35**, no writes |
| Mocked write-path suite | **37/37** |

**Data observed:** between test runs a new live transaction appeared: **#221** (16:24 IST,
₹1,50,000, AC1000001 → QuickCash Loans, Lagos, DEV-IOS-0005), status **FLAGGED**, with **HIGH alert
#101, score 80** (40 amount + 20 new device + 20 location), assigned to Kavita Rao. None of the test
tools sent it (all recorded zero writes; the gateway logged none); it appears to have been submitted
through the local app. It confirms the live trigger → alert → FLAGGED path. IDs jumped from 201/81 to
221/101 because of Oracle identity caching, which is normal.

## Remaining work (needs the owner)

1. Nothing is required for the public demo mode or the local Oracle demonstration.
2. Optional: `scripts\register-endpoints.ps1` on the laptop, for server-side sign-in.
3. Optional: a public Oracle backend needs a new account. See DEPLOYMENT.md, *Optional next step*.
4. Optional, with approval: one live transfer on the laptop database, to record a local write test.

## Known limitations
* Shared demo logins (see README). Transfers do not move balances. Rule-based scoring.
* The risk preview on the transfer form is a client-side hint; `CALCULATE_RISK` is authoritative.
* Always Free: about 3–6 simultaneous HTTP users, no backups; stops after 7 idle days (keep-awake workflow).
* Re-running the seed regenerates alerts through the trigger, so statuses return to OPEN.
