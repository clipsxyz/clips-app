# Build a debug APK you can copy to the phone when adb is not working (MTP/file transfer is enough).
$ErrorActionPreference = "Stop"

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
    $javaHome = "C:\Program Files\Android\Android Studio\jbr"
}
$env:ANDROID_HOME = $sdk
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$sdk\platform-tools;$env:Path"

$root = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $root "android")

Write-Host "Building debug APK (first run may take 10-20 min)..."
& .\gradlew.bat assembleDebug

$apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
    Write-Error "APK not found at $apk"
}

$dest = Join-Path $root "app-debug.apk"
Copy-Item $apk $dest -Force
Write-Host ""
Write-Host "Done. Copy this file to your Nokia (Downloads folder):"
Write-Host $dest
Write-Host ""
Write-Host "On phone: open Files -> Downloads -> app-debug.apk -> Install"
Write-Host "(Enable Install unknown apps for Files if prompted.)"
