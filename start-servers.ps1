# Start Servers Script for Clips App
# This script starts both Laravel backend and Vite frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Clips App Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if ports are already in use
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port8000) {
    Write-Host "⚠️  Port 8000 is already in use. Stopping existing processes..." -ForegroundColor Yellow
    $processes = Get-Process | Where-Object {$_.Id -in $port8000.OwningProcess}
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

if ($port5173) {
    Write-Host "⚠️  Port 5173 is already in use. Stopping existing processes..." -ForegroundColor Yellow
    $processes = Get-Process | Where-Object {$_.Id -in $port5173.OwningProcess}
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Get local IP address
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}).IPAddress | Select-Object -First 1
if (-not $ipAddress) {
    $ipAddress = "localhost"
}

Write-Host "📍 Your local IP address: $ipAddress" -ForegroundColor Green
Write-Host ""

# Start Laravel backend
Write-Host "🚀 Starting Laravel Backend..." -ForegroundColor Yellow
$laravelJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location laravel-backend
    # artisan serve spawns php -S without -d flags; use scan dir so child loads 256M limits
    $env:PHP_INI_SCAN_DIR = (Join-Path (Get-Location) "php-dev.d") + [IO.Path]::PathSeparator + $env:PHP_INI_SCAN_DIR
    php artisan serve --host=0.0.0.0 --port=8000
}

Start-Sleep -Seconds 3

# Check if Laravel started successfully
$laravelCheck = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($laravelCheck) {
    Write-Host "✅ Laravel Backend is running on:" -ForegroundColor Green
    Write-Host "   - http://localhost:8000" -ForegroundColor White
    Write-Host "   - http://$ipAddress:8000" -ForegroundColor White
} else {
    Write-Host "❌ Laravel Backend failed to start" -ForegroundColor Red
}

Write-Host ""

# Try to fix esbuild issue first
Write-Host "🔧 Attempting to fix esbuild permission issue..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
if (Test-Path "node_modules\esbuild") {
    Write-Host "   Rebuilding esbuild..." -ForegroundColor Gray
    npm rebuild esbuild 2>&1 | Out-Null
}

# Start Vite frontend
Write-Host "🚀 Starting Vite Frontend..." -ForegroundColor Yellow
$viteJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    $env:NODE_OPTIONS = "--no-warnings"
    npm run dev
}

Start-Sleep -Seconds 5

# Check if Vite started successfully
$viteCheck = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($viteCheck) {
    Write-Host "✅ Vite Frontend is running on:" -ForegroundColor Green
    Write-Host "   - http://localhost:5173" -ForegroundColor White
    Write-Host "   - http://$ipAddress:5173" -ForegroundColor White
} else {
    Write-Host "❌ Vite Frontend failed to start (check esbuild permissions)" -ForegroundColor Red
    Write-Host "   Try running as Administrator or check Windows Defender" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server Status:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 To access from your phone (same WiFi network):" -ForegroundColor Green
Write-Host "   Frontend: http://$ipAddress:5173" -ForegroundColor White
Write-Host "   Backend API: http://$ipAddress:8000/api" -ForegroundColor White
Write-Host ""
Write-Host "💻 To access from this computer:" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend API: http://localhost:8000/api" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Yellow
Write-Host ""

# Keep script running and show job outputs
try {
    while ($true) {
        Start-Sleep -Seconds 5
        $laravelOutput = Receive-Job -Job $laravelJob -ErrorAction SilentlyContinue
        $viteOutput = Receive-Job -Job $viteJob -ErrorAction SilentlyContinue
        
        if ($laravelOutput) {
            Write-Host "[Laravel] $laravelOutput" -ForegroundColor Magenta
        }
        if ($viteOutput) {
            Write-Host "[Vite] $viteOutput" -ForegroundColor Blue
        }
    }
} finally {
    Write-Host ""
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $laravelJob, $viteJob -ErrorAction SilentlyContinue
    Remove-Job -Job $laravelJob, $viteJob -ErrorAction SilentlyContinue
}
