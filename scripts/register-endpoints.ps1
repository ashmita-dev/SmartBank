<#
.SYNOPSIS
  Installs the SmartBank API (security layer + REST module) into the LOCAL
  Oracle XE database and verifies it.

.DESCRIPTION
  1. As SYSDBA (operating-system authentication, no password): grants
     EXECUTE on SYS.DBMS_CRYPTO to SMARTBANK_USER in XEPDB1. Needed for
     password hashing and session tokens. Skip with -SkipGrant.
  2. As SMARTBANK_USER (hidden password prompt), in one sqlplus session:
       database/15_api_security.sql   - API_USER / API_SESSION / API_EVENT
                                        tables and PKG_SMARTBANK_API
       database/ords_endpoints.sql    - replaces the smartbank.api module
       database/14_demo_customer_profile.sql (skip with -SkipProfile)
  3. Optionally sets the two demo-login passwords (hidden prompts; press
     Enter to keep the current ones). Only salted hashes are stored.

  The 12 core tables, triggers and fraud-engine code are not modified.
  Passwords go to sqlplus on standard input only: never echoed, written to
  a file or placed on a command line. Safe to re-run.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1
#>
param(
    [string]$ConnectString = "localhost:1521/XEPDB1",
    [string]$ApiBase = "http://localhost:8080/ords/smartbank/sb/api",
    [switch]$SkipProfile,
    [switch]$SkipGrant
)

$ErrorActionPreference = "Stop"
$db = Resolve-Path (Join-Path $PSScriptRoot "..\database")
$security = Join-Path $db "15_api_security.sql"
$endpoints = Join-Path $db "ords_endpoints.sql"
$profileSql = Join-Path $db "14_demo_customer_profile.sql"
$runProfile = if ($SkipProfile) { "" } else { "@`"$profileSql`"" }

function Read-Secret([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# ---- 1. DBMS_CRYPTO grant ---------------------------------------------------
if (-not $SkipGrant) {
    $grant = @"
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CONTAINER = XEPDB1;
GRANT EXECUTE ON SYS.DBMS_CRYPTO TO smartbank_user;
EXIT
"@
    $out = $grant | sqlplus -S -L "/ as sysdba"
    if ($LASTEXITCODE -ne 0) {
        $out | Write-Host
        Write-Host "Could not grant DBMS_CRYPTO as SYSDBA. Run this from an account in the ORA_DBA group, or ask a DBA to run:" -ForegroundColor Red
        Write-Host "  GRANT EXECUTE ON SYS.DBMS_CRYPTO TO smartbank_user;   (in XEPDB1)"
        exit 1
    }
    Write-Host "Granted EXECUTE on DBMS_CRYPTO to SMARTBANK_USER." -ForegroundColor Green
}

# ---- 2 and 3. Install as SMARTBANK_USER ------------------------------------
$plain = Read-Secret "SMARTBANK_USER password"
Write-Host "Demo-login passwords (at least 8 characters, no single quotes). Press Enter to keep the current one."
$customerPw = Read-Secret "Password for user@smartbank.com (customer)"
$analystPw = Read-Secret "Password for admin@smartbank.com (analyst)"

$users = ""
if ($customerPw) {
    $users += "EXEC pkg_smartbank_api.upsert_user('user@smartbank.com', 'Demo customer', 'CUSTOMER', q'~$customerPw~', 1, NULL)`n"
}
if ($analystPw) {
    $users += "EXEC pkg_smartbank_api.upsert_user('admin@smartbank.com', 'Fraud Analyst', 'ANALYST', q'~$analystPw~', NULL, 1)`n"
}
if ($users) { $users += "COMMIT;`n" }

try {
    $sqlInput = @"
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF
SET VERIFY OFF
SET ECHO OFF
CONNECT smartbank_user/"$plain"@$ConnectString
@"$security"
@"$endpoints"
$runProfile
$users
EXIT
"@
    $output = $sqlInput | sqlplus -S -L /nolog
    $code = $LASTEXITCODE
} finally {
    Remove-Variable plain, customerPw, analystPw, users, sqlInput -ErrorAction SilentlyContinue
}

$output | Where-Object { $_ -match "ORA-|PLS-|SP2-|Warning|created|completed|Errors" } | ForEach-Object { Write-Host $_ }

if ($code -ne 0) {
    Write-Host "Installation failed (sqlplus exit code $code). Nothing after the error was applied." -ForegroundColor Red
    exit $code
}

Write-Host "API security layer and REST module installed." -ForegroundColor Green

# ---- Verify -----------------------------------------------------------------
$failed = 0
try {
    $health = Invoke-RestMethod -Uri "$ApiBase/health" -TimeoutSec 15
    Write-Host ("  OK    GET /health  status={0} fraud_engine={1}" -f $health.status, $health.fraud_engine) -ForegroundColor Green
} catch {
    $failed++
    Write-Host "  FAIL  GET /health  $($_.Exception.Message)" -ForegroundColor Red
}

try {
    Invoke-RestMethod -Uri "$ApiBase/transactions" -TimeoutSec 15 | Out-Null
    $failed++
    Write-Host "  FAIL  GET /transactions answered without a session" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "  OK    GET /transactions requires sign-in (401)" -ForegroundColor Green
    } else {
        $failed++
        Write-Host "  FAIL  GET /transactions  $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($failed) {
    Write-Host "Checks failed. Is ORDS running? (scripts\start-backend.ps1)" -ForegroundColor Yellow
    exit 1
}
Write-Host "Done. Sign in at http://localhost:5173 with the demo logins." -ForegroundColor Green
