<#
.SYNOPSIS
  Publishes a READ-ONLY view of the local SmartBank API over HTTPS.

.DESCRIPTION
  1. Checks that ORDS answers locally.
  2. Starts gateway\server.mjs on 127.0.0.1:8787. It forwards only the 10
     read-only GET endpoints and refuses every write.
  3. Starts a Cloudflare quick tunnel (cloudflared) to the gateway and prints
     its https://....trycloudflare.com address. Only the gateway is tunnelled,
     never ORDS (8080) or Oracle (1521).
  4. With -Deploy, runs the GitHub Pages workflow with that address so the
     hosted frontend uses it (needs `gh` signed in and Pages enabled).

  The public site works only while this window stays open and this computer,
  Oracle and ORDS are running. A quick-tunnel address changes on every start,
  so -Deploy must be repeated each time.

  Requires cloudflared (free, no account for quick tunnels):
    winget install --id Cloudflare.cloudflared

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-public-demo.ps1 -Deploy
#>
param(
  [switch]$Deploy,
  [int]$Port = 8787,
  [string]$PagesOrigin = "https://ashmita-dev.github.io"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

try {
  Invoke-WebRequest "http://127.0.0.1:8080/ords/smartbank/sb/api/kpis" -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
  Write-Host "ORDS is not answering on localhost:8080. Run scripts\start-backend.ps1 first." -ForegroundColor Red
  exit 1
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  Write-Host "cloudflared is not installed. Install it with:" -ForegroundColor Yellow
  Write-Host "  winget install --id Cloudflare.cloudflared"
  exit 1
}

$env:GATEWAY_PORT = "$Port"
$env:ALLOWED_ORIGINS = $PagesOrigin
$gateway = Start-Process -PassThru -NoNewWindow -FilePath node -ArgumentList "`"$root\gateway\server.mjs`""
Start-Sleep -Seconds 2
try {
  Invoke-WebRequest "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {
  Write-Host "The gateway did not start." -ForegroundColor Red
  Stop-Process -Id $gateway.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

$log = Join-Path $env:TEMP "smartbank-tunnel.log"
Remove-Item $log -ErrorAction SilentlyContinue
$tunnel = Start-Process -PassThru -WindowStyle Hidden -FilePath $cloudflared.Source `
  -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$Port" -RedirectStandardError $log

$publicUrl = $null
for ($i = 0; $i -lt 60 -and -not $publicUrl; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($m) { $publicUrl = $m.Matches[0].Value }
  }
}

if (-not $publicUrl) {
  Write-Host "The tunnel did not report an address. See $log" -ForegroundColor Red
  Stop-Process -Id $tunnel.Id, $gateway.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

$apiUrl = "$publicUrl/api"
Write-Host ""
Write-Host "Read-only API:  $apiUrl" -ForegroundColor Green
Write-Host "Check:          $apiUrl/kpis"

if ($Deploy) {
  gh workflow run deploy-frontend.yml --repo ashmita-dev/SmartBank -f api_base_url=$apiUrl -f read_only=true
  Write-Host "Deployment started. Watch it with: gh run watch --repo ashmita-dev/SmartBank"
  Write-Host "Site: $PagesOrigin/SmartBank/"
} else {
  Write-Host "To point the hosted site at it: gh workflow run deploy-frontend.yml -f api_base_url=$apiUrl"
}

Write-Host ""
Write-Host "Keep this window open. Press Ctrl+C to stop the public demo." -ForegroundColor Yellow
try {
  Wait-Process -Id $tunnel.Id
} finally {
  Stop-Process -Id $tunnel.Id, $gateway.Id -Force -ErrorAction SilentlyContinue
  Write-Host "Public demo stopped."
}
