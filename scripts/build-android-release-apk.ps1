# Release APK with JS bundled — runs on phone without Metro (best for Nokia sideload when adb is off).
$ErrorActionPreference = "Stop"

$env:GRADLE_USER_HOME = "C:\gcache"
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = "arm64-v8a"

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

Write-Host "Building release APK (JS bundled inside; no dev server needed)..."
Write-Host "Gradle cache: $env:GRADLE_USER_HOME | ABI: arm64-v8a"
& .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a

$apk = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) {
    Write-Error "APK not found at $apk"
}

$dest = Join-Path $root "app-release.apk"
Copy-Item $apk $dest -Force
Write-Host ""
Write-Host "Copy to Nokia Downloads:"
Write-Host $dest
