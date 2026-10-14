<#
.SYNOPSIS
  Publishes database/ords_endpoints.sql as SMARTBANK_USER and verifies the API.

.DESCRIPTION
  Prompts for the SMARTBANK_USER password with a hidden prompt. The password is
  sent to sqlplus on standard input only: it is not echoed, not written to a
  file, and not placed on the command line. The endpoint script redefines the
  whole smartbank.api module, so running it again is safe.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-endpoints.ps1
#>
param(
    [string]$ConnectString = "localhost:1521/XEPDB1",
    [string]$ApiBase = "http://localhost:8080/ords/smartbank/sb/api"
)

$ErrorActionPreference = "Stop"
$script = Resolve-Path (Join-Path $PSScriptRoot "..\database\ords_endpoints.sql")

$secure = Read-Host "SMARTBANK_USER password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $sqlInput = @"
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF
CONNECT smartbank_user/"$plain"@$ConnectString
@"$script"
EXIT
"@
    $output = $sqlInput | sqlplus -S -L /nolog
    $code = $LASTEXITCODE
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Variable plain, sqlInput -ErrorAction SilentlyContinue
}

$output | Where-Object { $_ -match "ORA-|SP2-|completed|ERROR" } | ForEach-Object { Write-Host $_ }

if ($code -ne 0) {
    Write-Host "Endpoint registration failed (sqlplus exit code $code)." -ForegroundColor Red
    exit $code
}

Write-Host "ords_endpoints.sql executed." -ForegroundColor Green

# Verify the endpoints that the current frontend needs.
$checks = "kpis", "transactions", "alerts", "risk-distribution", "daily-analytics",
          "analysts/workload", "accounts?customer_id=1", "merchants", "devices?customer_id=1"
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

Write-Host "All 9 endpoints respond." -ForegroundColor Green
