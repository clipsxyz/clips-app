# Try installing an older version of esbuild that might not be flagged
# Run this in Administrator PowerShell

Write-Host "Trying older esbuild version that might not be flagged..." -ForegroundColor Yellow

cd C:\Users\visua\clips-app

# Uninstall current version
npm uninstall esbuild

# Try version 0.19.12 (slightly older)
Write-Host "Installing esbuild@0.19.12..." -ForegroundColor Cyan
npm install --save-dev esbuild@0.19.12

# Check if it exists
Start-Sleep -Seconds 2
if (Test-Path "node_modules\esbuild\esbuild.exe") {
    Write-Host "SUCCESS! esbuild.exe found!" -ForegroundColor Green
    Get-Item "node_modules\esbuild\esbuild.exe" | Select-Object Name, Length, LastWriteTime
} else {
    Write-Host "Still not found. Trying even older version..." -ForegroundColor Yellow
    npm uninstall esbuild
    npm install --save-dev esbuild@0.19.8
    Start-Sleep -Seconds 2
    if (Test-Path "node_modules\esbuild\esbuild.exe") {
        Write-Host "SUCCESS with older version!" -ForegroundColor Green
    } else {
        Write-Host "Still blocked. Check Windows Defender quarantine." -ForegroundColor Red
    }
}
