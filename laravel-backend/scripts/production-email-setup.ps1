# Run on the server from laravel-backend\ (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Migrating database..."
php artisan migrate --force

Write-Host ""
Write-Host "==> Production readiness check..."
php artisan engagement:production-check

Write-Host ""
Write-Host "==> Scheduled tasks..."
php artisan schedule:list

Write-Host ""
Write-Host "Done. For daily digests at 09:00, schedule Task Scheduler or cron:"
Write-Host "  php artisan schedule:run"
Write-Host ""
Write-Host "Test one digest:"
Write-Host "  php artisan engagement:send-inactive-digests --email=you@example.com --force"
