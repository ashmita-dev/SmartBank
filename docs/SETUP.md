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

### Use `localhost`, not the Wi-Fi IP

On the development machine, `listener.ora` and the ORDS pool were configured with a
fixed LAN address (`10.168.41.144`). When the network assigns a different IP, the
listener cannot start and ORDS cannot connect, and the dashboard shows **API offline**.
Point both at `localhost`. This also keeps the database off the local network.

1. Edit `C:\app\<user>\product\21c\homes\OraDB21Home1\network\admin\listener.ora` (keep a backup):
   ```
   (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))
   ```
2. Edit `C:\ords-config\databases\smartbank\pool.xml`:
   ```xml
   <entry key="db.hostname">localhost</entry>
   ```
3. Restart the listener from an **administrator** terminal:
   ```powershell
   lsnrctl stop
   lsnrctl start
   lsnrctl status     # XEPDB1 should be listed
   ```

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
It publishes 12 handlers, including the `accounts`, `merchants` and `devices` endpoints
and the updated `PUT /alerts/:id`, used by the current frontend.

Start ORDS (keep this terminal open):

```powershell
C:\ords\bin\ords.exe --config C:\ords-config serve
```

Check it:

```powershell
curl http://localhost:8080/ords/smartbank/sb/api/kpis
```

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

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Red **API offline** badge, "Cannot reach the SmartBank API" | ORDS not running, or the listener is down. See §2 and §4. |
| `lsnrctl start` fails with TNS-12545 / 12560 | `listener.ora` still has an old IP. Use `localhost`. |
| My Accounts says balances are unavailable; transfer form disabled | `GET /accounts`, `/merchants`, `/devices` are not published yet. Re-run `ords_endpoints.sql`. |
| Alert action says "The API saved status INVESTIGATING instead of …" | The old `PUT /alerts/:id` handler is still deployed. Re-run `ords_endpoints.sql`. |
| Browser CORS error | Open the app via `localhost`, not a LAN IP, or adjust ORDS allowed origins. |
