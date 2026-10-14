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

### Not tested against a live API
* **ORDS was not running and could not be started during this session.** The listener and
  ORDS are bound to an old LAN IP (see SETUP §2). Changing those system files was outside
  the permitted scope, so no request reached the real ORDS.
* The updated `ords_endpoints.sql` (new endpoints and handler changes) has **not been run**
  against the database. It needs `smartbank_user` credentials.
* `01_tables.sql` / `03_seed_data.sql` have not been executed on a fresh schema.
* `13_testing.sql` was not re-run in this session.

## Remaining work (manual, about 15 minutes)

1. Point `listener.ora` and `C:\ords-config\databases\smartbank\pool.xml` at `localhost`, then restart the listener (SETUP §2).
2. Run `database/ords_endpoints.sql` as `smartbank_user`.
3. Start ORDS. In the analyst console, use **System & Settings → Test all endpoints**; expect 9/9 green.
4. Run the transfer scenario from DEMO_GUIDE §3 to confirm live trigger → alert integration.

## Known limitations
* Demo authentication runs in the browser; roles are enforced only in the UI. The ORDS module has no OAuth.
* Transfers record and screen a transaction but do not move balances.
* The risk preview on the transfer form is a client-side hint. `CALCULATE_RISK` is authoritative.
* Re-running `03_seed_data.sql` regenerates alerts through the trigger, so statuses return to OPEN.

## Deployment status
**Not deployed.** No hosting provider is configured in the repository. A public frontend
would be unable to reach the local ORDS API, and exposing ORDS publicly is unsafe because
the module is unauthenticated. The supported demonstration setup is local
(`npm run dev` or `npm run build && npm run preview`). To host later: deploy `frontend/dist`
to any static host, set `VITE_API_BASE_URL` to an HTTPS ORDS endpoint, and first protect the
ORDS module with OAuth2 and CORS restricted to the site's origin.
