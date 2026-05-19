# Run Gazetteer on a connected Android device or emulator (Windows).
# Prerequisites: Android Studio SDK, USB debugging enabled, device listed in `adb devices`.

$ErrorActionPreference = "Stop"

$sdk = $env:ANDROID_HOME
if (-not $sdk) {
    $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
    $javaHome = "C:\Program Files\Android\Android Studio\jbr"
}

if (-not (Test-Path $sdk)) {
    Write-Error "Android SDK not found. Set ANDROID_HOME or install Android Studio."
}

$adb = Join-Path $sdk "platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    Write-Error "adb not found under $sdk\platform-tools"
}

$env:ANDROID_HOME = $sdk
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$sdk\platform-tools;$env:Path"

Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "JAVA_HOME=$env:JAVA_HOME"

& $adb devices
$devices = (& $adb devices | Select-String "device$" | Where-Object { $_ -notmatch "List of devices" })
if (-not $devices) {
    Write-Warning "No Android device detected. Plug in your phone, enable USB debugging, tap Allow, then run again."
}

Write-Host "Forwarding Metro (8081) to device..."
& $adb reverse tcp:8081 tcp:8081 2>$null

Set-Location (Split-Path $PSScriptRoot -Parent)
npm run dev:android
