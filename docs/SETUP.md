# SmartBank — Setup Guide

This guide covers Oracle XE, the database scripts, ORDS and the React frontend.
Replace `<password>` with your own values and never commit them.

## 1. Prerequisites

| Component | Version used |
|---|---|
| Oracle Database Express Edition | 21c (pluggable database `XEPDB1`) |
| Oracle REST Data Services | standalone, installed in `C:\ords`, config in `C:\ords-config` |
| Java | 17+ (for ORDS) |
| Node.js | 22 (npm 10+) |

## 2. Oracle XE

1. Install Oracle XE 21c. Windows services: `OracleServiceXE` (database) and
   `OracleOraDB21Home1TNSListener` (listener).
2. Make sure both are **Running** (`services.msc`, or `lsnrctl status` in a terminal).

### Networking uses `localhost` (fixed 14 Oct 2026)

The listener, client aliases, the database's registration target and the ORDS pool were
originally pinned to Wi-Fi addresses (`10.168.41.144`, `10.168.42.20`). Whenever the
network handed out a different IP, the listener could not start and the dashboard showed
**API offline**. All four now use `localhost`, which is stable and keeps port 1521 off the network:

| Setting | Now |
|---|---|
| `...\OraDB21Home1\network\admin\listener.ora` | `(HOST = localhost)` |
| `...\OraDB21Home1\network\admin\tnsnames.ora` (`XE`, `LISTENER_XE`) | `(HOST = localhost)` |
| Database parameter `LOCAL_LISTENER` | `(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))` |
| `C:\ords-config\databases\smartbank\pool.xml` | `db.hostname = localhost` |
| ORDS global `standalone.binds` (set 14 Oct 2026, evening) | `127.0.0.1,::1`. ORDS previously listened on every interface (`:::8080`) with a Windows Firewall allow rule for Java, so the unauthenticated API was reachable from the Wi-Fi network. Takes effect when ORDS is next restarted. Undo: `C:\ords\bin\ords.exe --config C:\ords-config config delete --global standalone.binds` |

Backups of the original files sit next to them with the suffix `.bak-20261014`. To undo
the parameter change: `ALTER SYSTEM SET local_listener='(ADDRESS=(PROTOCOL=TCP)(HOST=10.168.41.144)(PORT=1521))' SCOPE=BOTH;`

### Starting the listener needs administrator rights

`OracleOraDB21Home1TNSListener` is a Windows service, so a normal terminal gets
`Unable to OpenSCManager: err=5` (access denied). Running `tnslsnr.exe` as your own user
does not help either: it cannot hand connections to the database service, which runs as
`NT SERVICE\OracleServiceXE` (ORA-12518). Either:

* run `scripts\start-backend.ps1`, which asks for elevation (UAC) only to start the service, or
* in an administrator terminal: `Start-Service OracleOraDB21Home1TNSListener`

Optionally set the service's startup type to **Automatic** (`services.msc`) so this is never needed again.

## 3. Database schema

Create the application user once (as an administrator, in `XEPDB1`):

```sql
ALTER SESSION SET CONTAINER = XEPDB1;
CREATE USER smartbank_user IDENTIFIED BY "<password>" QUOTA UNLIMITED ON users;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE,
      CREATE PROCEDURE, CREATE TRIGGER TO smartbank_user;
```

Then connect as `smartbank_user` (for example
`sql smartbank_user@localhost:1521/XEPDB1`) and run the scripts from the `database/` folder:

| Order | Script | Notes |
|---|---|---|
| 1 | `01_tables.sql` | 12 tables |
| 2 | `02_constraints.sql` | UNIQUE / CHECK constraints |
| 3 | `03_seed_data.sql`, **reference sections only** | Everything above the `BANK_TRANSACTION` heading, then `COMMIT` |
| 4 | `05_functions.sql`, `06_procedures.sql`, `07_triggers.sql`, `08_cursor.sql`, `09_package.sql` | Fraud engine |
| 5 | `03_seed_data.sql`, **`BANK_TRANSACTION` section** | Replayed through the trigger, so alerts are generated |
| 6 | `10_views.sql`, `11_indexes.sql` | Reporting views and indexes |
| 7 | `04_verification_queries.sql` | Optional checks |

> **Already have the database?** The live `SMARTBANK_USER` schema on the development
> machine already contains every object. **Do not re-run 01–03 against it**: those scripts
> are for a fresh, empty schema. `01_tables.sql` and `03_seed_data.sql` were reconstructed
> from that live schema because the original files were empty.

## 4. ORDS

The REST schema alias is `sb` (already enabled on the development machine). On a new
database, as `smartbank_user`:

```sql
BEGIN
  ORDS.ENABLE_SCHEMA(p_enabled => TRUE, p_schema => 'SMARTBANK_USER',
                     p_url_mapping_type => 'BASE_PATH', p_url_mapping_pattern => 'sb');
  COMMIT;
END;
/
```

Publish or refresh the API by running **`database/ords_endpoints.sql` as `smartbank_user`**.
The script redefines the whole `smartbank.api` module, so it is safe to run repeatedly.
It publishes 13 handlers, including `GET /accounts`, `/merchants`, `/devices` and
`/customers/:id` and the updated `PUT /alerts/:id` and `POST /transactions`, used by the
current frontend. The SELECTs of the new GET handlers were run read-only against the live
schema (20 accounts with 20 distinct IDs, so no duplicate rows; customer 1 has 2 accounts),
and both PL/SQL handlers compile (`DBMS_SQL.PARSE`, nothing executed).

The easiest way (with ORDS running) is:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1
```

It asks for the `SMARTBANK_USER` password in a hidden prompt, passes it to `sqlplus` on
standard input only (never on the command line or in a file), runs `ords_endpoints.sql` and
`14_demo_customer_profile.sql` (add `-SkipProfile` to leave customer #1's name unchanged),
then calls all 11 read endpoints.

Start ORDS (keep this terminal open), or let `scripts\start-backend.ps1` do it:

```powershell
C:\ords\bin\ords.exe --config C:\ords-config serve
```

Check it:

```powershell
curl http://localhost:8080/ords/smartbank/sb/api/kpis
```

### Verified state (14 Oct 2026)

* The listener service runs on `localhost:1521` and `xepdb1` is registered.
* The ORDS `smartbank` pool is VALID (`ORDS_PUBLIC_USER` password stored in the pool wallet).
* `http://localhost:8080/ords/smartbank/sb/api/kpis` returns live data.
* `scripts\register-endpoints.ps1` has been run: all 13 handlers are published, including
  `/accounts`, `/merchants`, `/devices` and `/customers/:id`, and customer #1 is Ashmita Mazumdar.
* Live schema objects checked with a read-only `DBA_OBJECTS` query: 12 tables, 4 views,
  `CALCULATE_RISK`, `CLASSIFY_RISK`, `DETECT_FRAUD`, `GENERATE_ALERT`, `REVIEW_HIGH_RISK_ALERTS`,
  both triggers and `PKG_FRAUD_DETECTION` (spec and body), all VALID.

## 5. Frontend

```powershell
cd frontend
npm ci            # installs exactly what package-lock.json specifies
npm run dev       # http://localhost:5173
```

The API base URL defaults to `http://localhost:8080/ords/smartbank/sb/api`. To change it,
copy `frontend/.env.example` to `frontend/.env.local`. Only public values belong there,
because `VITE_` variables are visible in the browser.

Production build:

```powershell
npm run lint
npm run build     # output in frontend/dist
npm run preview   # serve the build on http://localhost:4173
```

In the analyst console, **System & Settings → Test all endpoints** checks every
read-only endpoint against the live API.

## 6. Public read-only demo (optional)

A hosted frontend cannot use `localhost`, and the ORDS module has no authentication, so ORDS
and Oracle are never published. Instead:

| Piece | File | Role |
|---|---|---|
| Static frontend | `.github/workflows/deploy-frontend.yml` | Builds with `BASE_PATH=/SmartBank/`, `VITE_API_BASE_URL=<gateway URL>`, `VITE_READ_ONLY=true`; copies `index.html` to `404.html` so deep links and refreshes work; fails on localhost/LAN/plain-http/port-8080 URLs; scans the bundle for credentials |
| Read-only gateway | `gateway/server.mjs` (Node 18+, no dependencies) | Listens on `127.0.0.1:8787` only; forwards the 10 GET endpoints; rejects writes (`405`), unknown paths (`404`), bad parameters; `limit` ≤ 1000; 240 requests/min per client; CORS only for `ALLOWED_ORIGINS` (default `https://ashmita-dev.github.io`) |
| HTTPS tunnel | `scripts/start-public-demo.ps1` | Starts the gateway and a Cloudflare quick tunnel (`cloudflared`, free, no account) and, with `-Deploy`, runs the workflow with the tunnel address |

**One-time:** enable **Settings → Pages → Source: GitHub Actions**, and install
`winget install --id Cloudflare.cloudflared`.

**Each session:** start the backend, then
`powershell -ExecutionPolicy Bypass -File scripts\start-public-demo.ps1 -Deploy` and keep the
window open. The site is `https://ashmita-dev.github.io/SmartBank/`. Quick-tunnel addresses
change on every start; for a stable address use a named Cloudflare tunnel on your own domain
(needs a Cloudflare account) and run the workflow once with that URL.

**What visitors get:** both portals with live Oracle data; transfers and alert actions are
disabled with an explanation. If the laptop is off, pages say the backend is offline. A build
without `VITE_API_BASE_URL` says it is not connected to a backend; it never falls back to
`localhost` or to sample data.

**CORS:** the browser talks only to the gateway, which answers `Access-Control-Allow-Origin`
for the configured origin(s). ORDS's own CORS setting does not matter because browsers never
reach ORDS directly. For local development the app calls ORDS directly from `localhost`.

**Not suitable for a public URL:** tunnelling ORDS (port 8080) itself. Anyone could create
transactions and change alerts. Full public write access would need ORDS OAuth2 (or another
identity provider) and server-side role checks first.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Red **API offline** badge, "Cannot reach the SmartBank API" | ORDS not running, or the listener is down. Run `scripts\start-backend.ps1`. |
| `lsnrctl start`: `Unable to OpenSCManager: err=5` | Not an administrator terminal. See §2. |
| ORDS log: `The pool named: \|smartbank\|lo\| is invalid ... database password secret in the wallet ... is missing`; requests return HTTP 571 / ORA-01005 | The pool wallet has no password for `ORDS_PUBLIC_USER`. Close ORDS and run `scripts\repair-ords-pool.ps1` (hidden prompt), or add `-ResetPassword` if the password is unknown. `start-backend.ps1` checks for this before starting ORDS. |
| ORDS `DatabaseConnectionError` / ORA-12518 | Listener started as a normal user instead of as the Windows service. Stop it and start the service (§2). |
| ORA-12514 (service XEPDB1 not known) | Wait about 60 s after starting the listener, or check that `LOCAL_LISTENER` points at `localhost`. |
| My Accounts says balances are unavailable; transfer form disabled | `GET /accounts`, `/merchants`, `/devices` are not published yet. Re-run `ords_endpoints.sql`. |
| Alert action says "The API saved status INVESTIGATING instead of …" | The old `PUT /alerts/:id` handler is still deployed. Re-run `ords_endpoints.sql`. |
| Browser CORS error | Open the app via `localhost`, not a LAN IP, or adjust ORDS allowed origins. |
| "did not answer within 15 s" | ORDS accepted the connection but the database did not reply (listener or pool problem). Restart with `scripts\start-backend.ps1`. |
| "returned an unexpected response format" | Something other than ORDS JSON answered (wrong `VITE_API_BASE_URL`, proxy page or an old handler). Check the URL in System & Settings. |
