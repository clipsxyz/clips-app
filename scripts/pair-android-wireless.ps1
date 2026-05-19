# Pair Oppo/Android wireless debugging — run while "Pair with device" is OPEN on the phone.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\pair-android-wireless.ps1

$ErrorActionPreference = "Stop"
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$adb = Join-Path $sdk "platform-tools\adb.exe"
if (-not (Test-Path $adb)) { Write-Error "adb not found at $adb" }

Write-Host ""
Write-Host "=== Wireless ADB pair (phone dialog must stay open) ===" -ForegroundColor Cyan
Write-Host "PC IP is probably 192.168.1.x — phone is NOT the same IP as the laptop." -ForegroundColor DarkGray
Write-Host ""

$pairLine = Read-Host "Paste IP:port from PAIRING screen (e.g. 192.168.1.3:39379)"
$code = Read-Host "Paste 6-digit pairing code"

if ($pairLine -notmatch '^(\d+\.\d+\.\d+\.\d+):(\d+)$') {
    Write-Error "Expected format like 192.168.1.3:39379"
}
$ip = $Matches[1]
$pairPort = $Matches[2]

Write-Host "Pairing now..." -ForegroundColor Yellow
& $adb kill-server 2>$null | Out-Null
Start-Sleep -Seconds 1
& $adb start-server | Out-Null

$pairOut = & $adb pair "${ip}:${pairPort}" $code 2>&1
Write-Host $pairOut

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Pair failed. Common fixes:" -ForegroundColor Red
    Write-Host "  - Keep pairing dialog open; run again within 30 seconds"
    Write-Host "  - Windows: allow adb through firewall (Private network)"
    Write-Host "  - Turn off VPN on phone and PC"
    Write-Host "  - Try USB cable + USB debugging instead (often easier on Oppo)"
    exit 1
}

Write-Host ""
Write-Host "Paired OK. On phone: back to Wireless debugging (main screen)." -ForegroundColor Green
$connectLine = Read-Host "Paste IP:port from MAIN Wireless debugging screen (often different port)"
if ($connectLine -notmatch '^(\d+\.\d+\.\d+\.\d+):(\d+)$') {
    Write-Error "Expected format like 192.168.1.3:5555"
}
$connectOut = & $adb connect $connectLine 2>&1
Write-Host $connectOut
& $adb devices -l
