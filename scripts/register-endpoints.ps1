<#
.SYNOPSIS
  Publishes the ORDS REST module and the demo customer profile as SMARTBANK_USER,
  then verifies the API.

.DESCRIPTION
  Runs, in one sqlplus session:
    1. database/ords_endpoints.sql         - redefines the smartbank.api module
       (13 handlers, incl. GET /accounts, /merchants, /devices, /customers/:id).
       Safe to re-run: the module is replaced, never duplicated.
    2. database/14_demo_customer_profile.sql - renames demo customer #1 to
       Ashmita Mazumdar (one guarded UPDATE; skip with -SkipProfile).

  Prompts for the SMARTBANK_USER password with a hidden prompt. The password is
  sent to sqlplus on standard input only: it is not echoed, not written to a
  file, and not placed on the command line.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1
#>
param(
    [string]$ConnectString = "localhost:1521/XEPDB1",
    [string]$ApiBase = "http://localhost:8080/ords/smartbank/sb/api",
    [switch]$SkipProfile
)

$ErrorActionPreference = "Stop"
$endpoints = Resolve-Path (Join-Path $PSScriptRoot "..\database\ords_endpoints.sql")
$profileSql = Resolve-Path (Join-Path $PSScriptRoot "..\database\14_demo_customer_profile.sql")
$runProfile = if ($SkipProfile) { "" } else { "@`"$profileSql`"" }

$secure = Read-Host "SMARTBANK_USER password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $sqlInput = @"
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF
CONNECT smartbank_user/"$plain"@$ConnectString
@"$endpoints"
$runProfile
EXIT
"@
    $output = $sqlInput | sqlplus -S -L /nolog
    $code = $LASTEXITCODE
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Variable plain, sqlInput -ErrorAction SilentlyContinue
}

$output | Where-Object { $_ -match "ORA-|SP2-|completed|ERROR|row" } | ForEach-Object { Write-Host $_ }

if ($code -ne 0) {
    Write-Host "Registration failed (sqlplus exit code $code). Nothing after the error was applied." -ForegroundColor Red
    exit $code
}

Write-Host "ords_endpoints.sql executed$(if (-not $SkipProfile) { ' and demo customer profile applied' })." -ForegroundColor Green

# Verify every read endpoint the frontend uses.
$checks = "kpis", "transactions", "alerts", "alerts/81", "risk-distribution", "daily-analytics",
          "analysts/workload", "accounts?customer_id=1", "merchants", "devices?customer_id=1", "customers/1"
$failed = 0

foreach ($path in $checks) {
    try {
        Invoke-RestMethod -Uri "$ApiBase/$path" -TimeoutSec 10 | Out-Null
        Write-Host ("  OK    GET /{0}" -f $path) -ForegroundColor Green
    } catch {
        $failed++
        Write-Host ("  FAIL  GET /{0}  {1}" -f $path, $_.Exception.Message) -ForegroundColor Red
    }
}

if ($failed) {
    Write-Host "$failed endpoint check(s) failed. Is ORDS running? (scripts\start-backend.ps1)" -ForegroundColor Yellow
    exit 1
}

Write-Host "All $($checks.Count) read endpoints respond." -ForegroundColor Green
