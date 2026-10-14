<#
.SYNOPSIS
  Starts the SmartBank backend: Oracle listener service + ORDS, then checks the API.

.DESCRIPTION
  - Starts the OracleServiceXE / listener Windows services if they are stopped.
    Starting a Windows service needs administrator rights, so the script
    re-launches itself elevated (UAC prompt) only when that is required.
  - Starts ORDS (C:\ords) with the configuration in C:\ords-config in a new window.
  - Waits for http://localhost:8080/ords/smartbank/sb/api/kpis to answer.

  No passwords are read or stored by this script.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1
#>
param(
    [string]$OrdsHome = "C:\ords",
    [string]$OrdsConfig = "C:\ords-config",
    [string]$ApiUrl = "http://localhost:8080/ords/smartbank/sb/api/kpis",
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
$services = @("OracleServiceXE", "OracleOraDB21Home1TNSListener")

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $identity).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 1. Oracle services ---------------------------------------------------------
$stopped = $services | Where-Object { (Get-Service $_).Status -ne "Running" }

if ($stopped) {
    if (-not (Test-Admin)) {
        Write-Host "Starting $($stopped -join ', ') requires administrator rights - requesting elevation..." -ForegroundColor Yellow
        $elevatedArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"Start-Service $($stopped -join ',')`""
        $p = Start-Process powershell.exe -Verb RunAs -ArgumentList $elevatedArgs -Wait -PassThru
        if ($p.ExitCode -ne 0) { throw "Could not start Oracle services (exit code $($p.ExitCode))." }
    } else {
        Start-Service $stopped
    }
}

foreach ($s in $services) {
    $status = (Get-Service $s).Status
    Write-Host ("{0,-32} {1}" -f $s, $status)
    if ($status -ne "Running") { throw "$s is not running." }
}

# The database re-registers with the listener within about 60 seconds;
# ORDS retries its connection, so no manual registration is required.

# 2. ORDS ------------------------------------------------------------------
$ordsListening = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue
if ($ordsListening) {
    Write-Host "Port 8080 is already in use - assuming ORDS is running." -ForegroundColor Yellow
} else {
    Write-Host "Starting ORDS in a new window (close that window to stop ORDS)..."
    Start-Process -FilePath (Join-Path $OrdsHome "bin\ords.exe") `
        -ArgumentList "--config", "`"$OrdsConfig`"", "serve" `
        -WorkingDirectory $OrdsHome
}

# 3. Wait for the API --------------------------------------------------------
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$lastError = $null
do {
    Start-Sleep -Seconds 3
    try {
        $kpis = Invoke-RestMethod -Uri $ApiUrl -TimeoutSec 5
        Write-Host ""
        Write-Host "API is up: $ApiUrl" -ForegroundColor Green
        $kpis | Format-List
        Write-Host "Next: cd frontend; npm run dev   ->  http://localhost:5173"
        exit 0
    } catch {
        $lastError = $_.Exception.Message
    }
} while ((Get-Date) -lt $deadline)

Write-Host "API did not respond within $TimeoutSeconds s. Last error: $lastError" -ForegroundColor Red
Write-Host "Check the ORDS window for errors and run: lsnrctl status (service xepdb1 should be listed)."
exit 1
