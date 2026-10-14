# SmartBank — Setup Guide

This guide covers the **local development** setup: Oracle XE, the database scripts, ORDS
and the React frontend. For the public cloud deployment (Oracle Autonomous Database),
see [DEPLOYMENT.md](DEPLOYMENT.md).
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
GRANT EXECUTE ON SYS.DBMS_CRYPTO TO smartbank_user;   -- password hashing, session tokens
```

**Fresh schema, one file:** `node scripts/build-cloud-install.mjs` generates
`deploy/oci/01_install_smartbank.sql`, which runs every script below in the right order
(plus `14`, `15` and `ords_endpoints.sql`). That is the file used for the cloud install, and it
works on any empty schema. Run it as `smartbank_user` with SQLcl, SQL*Plus or SQL Developer.
CI fails if it is out of date.

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
| 7 | `14_demo_customer_profile.sql` | Names demo customer #1 |
| 8 | `15_api_security.sql` | `API_USER`, `API_SESSION`, `API_EVENT`, `PKG_SMARTBANK_API` (sign-in, roles, validation, JSON) |
| 9 | `ords_endpoints.sql` (after enabling ORDS, §4) | REST module |
| 10 | `04_verification_queries.sql` | Optional checks |

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

Publish or refresh the API with (ORDS running):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1
```

It:
1. grants `EXECUTE ON SYS.DBMS_CRYPTO` to `SMARTBANK_USER` (as SYSDBA via operating-system
   authentication; skip with `-SkipGrant`);
2. asks for the `SMARTBANK_USER` password and the two demo-login passwords in hidden prompts
   (press Enter to keep a demo password unchanged) and passes them to `sqlplus` on standard
   input only (never on the command line or in a file);
3. runs `15_api_security.sql`, `ords_endpoints.sql` and `14_demo_customer_profile.sql` (add
   `-SkipProfile` to leave customer #1's name unchanged), then sets the demo passwords
   (only salted PBKDF2 hashes are stored);
4. checks that `GET /health` answers and that `GET /transactions` requires sign-in (401).

Every handler now calls `PKG_SMARTBANK_API`. Only `GET /health` and `POST /auth/login` work
without a session token. The 12 core tables, triggers and fraud-engine code are not changed.

Start ORDS (keep this terminal open), or let `scripts\start-backend.ps1` do it:

```powershell
C:\ords\bin\ords.exe --config C:\ords-config serve
```

Check it:

```powershell
curl http://localhost:8080/ords/smartbank/sb/api/health
```

### Verified state of the laptop database (14 Oct 2026, before the security layer)

* The listener service runs on `localhost:1521` and `xepdb1` is registered.
* The ORDS `smartbank` pool is VALID (`ORDS_PUBLIC_USER` password stored in the pool wallet).
* `http://localhost:8080/ords/smartbank/sb/api/kpis` returns live data.
* The **previous, unauthenticated** module (13 handlers) is published, and customer #1 is
  Ashmita Mazumdar. **The new security layer has not been installed on the laptop yet.** Run
  `scripts\register-endpoints.ps1` once to install it. After that, the current frontend can sign in locally.
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

## 6. Public deployment

The public site uses Oracle Autonomous Database (Always Free) instead of the laptop. Steps,
security model and status: [DEPLOYMENT.md](DEPLOYMENT.md). The earlier read-only gateway and
Cloudflare quick tunnel (`gateway/server.mjs`, `scripts/start-public-demo.ps1`) were removed,
because they depended on the laptop and could not support sign-in or transfers.

### Tests

```powershell
cd frontend
npm run lint
npm test                    # 23 unit/component tests (Vitest, no backend needed)
npm run build
# Against a running API (passwords from environment variables, see DEPLOYMENT.md):
node ..\scripts\api-smoke-test.mjs           # 42 read-only API checks
node ..\scripts\api-smoke-test.mjs --write   # + documented low/high-risk transaction test
npm run test:e2e                              # real Chrome, needs E2E_BASE_URL
```

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Red **API offline** badge, "Cannot reach the SmartBank API" | ORDS not running, or the listener is down. Run `scripts\start-backend.ps1`. |
| Login says "The POST /auth/login endpoint is not published" | The security layer is not installed in this database yet. Run `scripts\register-endpoints.ps1`. |
| "Invalid email or password" for the demo logins | Demo passwords are set per database. Re-run `register-endpoints.ps1` and type new ones. |
| "Your session has ended" | Sessions last 8 hours, and end on sign-out or when the password is reset. Sign in again. |
| `PLS-00201: identifier 'DBMS_CRYPTO' must be declared` | The grant in §3 is missing. |
| `lsnrctl start`: `Unable to OpenSCManager: err=5` | Not an administrator terminal. See §2. |
| ORDS log: `The pool named: \|smartbank\|lo\| is invalid ... database password secret in the wallet ... is missing`; requests return HTTP 571 / ORA-01005 | The pool wallet has no password for `ORDS_PUBLIC_USER`. Close ORDS and run `scripts\repair-ords-pool.ps1` (hidden prompt), or add `-ResetPassword` if the password is unknown. `start-backend.ps1` checks for this before starting ORDS. |
| ORDS `DatabaseConnectionError` / ORA-12518 | Listener started as a normal user instead of as the Windows service. Stop it and start the service (§2). |
| ORA-12514 (service XEPDB1 not known) | Wait about 60 s after starting the listener, or check that `LOCAL_LISTENER` points at `localhost`. |
| Browser CORS error | Open the app via `localhost:5173` or `localhost:4173`, not a LAN IP. Allowed origins are listed at the top of `ords_endpoints.sql`. |
| "did not answer within 15 s" | ORDS accepted the connection but the database did not reply (listener or pool problem). Restart with `scripts\start-backend.ps1`. |
| "returned an unexpected response format" | Something other than ORDS JSON answered (wrong `VITE_API_BASE_URL`, proxy page or an old handler). Check the URL in System & Settings. |
