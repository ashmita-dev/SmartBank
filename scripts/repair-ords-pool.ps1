<#
.SYNOPSIS
  Repairs the ORDS "smartbank" pool when its wallet has no database password.

.DESCRIPTION
  Symptom (ORDS log at startup):
    WARNING The pool named: |smartbank|lo| is invalid and will be ignored:
    ... The database password secret in the wallet associated with the pool ... is missing
  and requests fail with HTTP 571 / ORA-01005 "null password given".

  The pool connects as ORDS_PUBLIC_USER. This script stores that user's password
  in C:\ords-config\databases\smartbank\wallet using `ords config secret
  --password-stdin`, so the value never appears on screen, on a command line or
  in a file.

  Default mode: you type the existing ORDS_PUBLIC_USER password (hidden). It is
  verified with a test login before it is stored.

  -ResetPassword: use this if nobody knows the password. A random password is
  generated in memory, applied with ALTER USER ORDS_PUBLIC_USER (local OS
  authentication as SYSDBA, so your Windows account must be in ORA_DBA) and
  stored in the wallet. ORDS_PUBLIC_USER is the ORDS gateway account; nothing
  else in SmartBank logs in with it.

  Stop ORDS before running this; start it again afterwards (start-backend.ps1).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\repair-ords-pool.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\repair-ords-pool.ps1 -ResetPassword
#>
param(
    [switch]$ResetPassword,
    [string]$OrdsHome = "C:\ords",
    [string]$OrdsConfig = "C:\ords-config",
    [string]$Pool = "smartbank",
    [string]$ConnectString = "localhost:1521/XEPDB1",
    [string]$OracleSid = "XE",
    [string]$Pdb = "XEPDB1"
)

$ErrorActionPreference = "Stop"
$ords = Join-Path $OrdsHome "bin\ords.exe"
$dbUser = "ORDS_PUBLIC_USER"

if (Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue) {
    throw "Port 8080 is in use - close the ORDS window first, then re-run this script."
}

function Test-Login([string]$password) {
    $sql = @"
WHENEVER SQLERROR EXIT 1
CONNECT $dbUser/"$password"@$ConnectString
SELECT 'LOGIN_OK' FROM dual;
EXIT
"@
    $out = $sql | sqlplus -S -L /nolog
    return ($LASTEXITCODE -eq 0) -and ($out -match "LOGIN_OK")
}

function New-RandomPassword {
    # Starts with a letter; letters and digits only, so no quoting issues.
    $letters = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    $chars = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $result = $letters[$bytes[0] % $letters.Length]
    for ($i = 1; $i -lt $bytes.Length; $i++) { $result += $chars[$bytes[$i] % $chars.Length] }
    # Guarantee at least one digit.
    return $result + [string](2 + ($bytes[1] % 8))
}

$password = $null
try {
    if ($ResetPassword) {
        $password = New-RandomPassword
        $env:ORACLE_SID = $OracleSid
        $sql = @"
WHENEVER SQLERROR EXIT 1
ALTER SESSION SET CONTAINER = $Pdb;
ALTER USER $dbUser IDENTIFIED BY "$password" ACCOUNT UNLOCK;
EXIT
"@
        $null = $sql | sqlplus -S -L "/ as sysdba"
        if ($LASTEXITCODE -ne 0) { throw "ALTER USER failed (is your account in the ORA_DBA group?)." }
        Write-Host "New password set for $dbUser (not displayed)." -ForegroundColor Green
    } else {
        $secure = Read-Host "$dbUser password" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }

    if (-not (Test-Login $password)) {
        throw "Test login as $dbUser@$ConnectString failed - password not stored. (Wrong password? Try -ResetPassword.)"
    }
    Write-Host "Test login as $dbUser succeeded."

    $password | & $ords --config $OrdsConfig config --db-pool $Pool secret --password-stdin db.password | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "ords config secret failed (exit code $LASTEXITCODE)." }
} finally {
    Remove-Variable password, sql -ErrorAction SilentlyContinue
}

# Confirm ORDS now sees the secret (values are masked by ORDS).
$listing = & $ords --config $OrdsConfig config --db-pool $Pool list 2>&1 | Out-String
if ($listing -match "db\.password") {
    Write-Host "db.password is now stored in the '$Pool' pool wallet." -ForegroundColor Green
    Write-Host "Next: powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1"
} else {
    Write-Host "ORDS still does not list db.password for pool '$Pool'." -ForegroundColor Red
    exit 1
}
