#!/usr/bin/env bash
# Run on the production server from laravel-backend/
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Migrating database..."
php artisan migrate --force

echo ""
echo "==> Production readiness check..."
php artisan engagement:production-check

echo ""
echo "==> Scheduled tasks (requires cron for schedule:run)..."
php artisan schedule:list

echo ""
echo "Done. Add cron if missing:"
echo "  * * * * * cd $(pwd) && php artisan schedule:run >> /dev/null 2>&1"
echo ""
echo "Test one digest (replace email):"
echo "  php artisan engagement:send-inactive-digests --email=you@example.com --force"
