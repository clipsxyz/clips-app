#!/usr/bin/env bash
# Start Laravel with upload limits that apply to the PHP built-in server.
# `php -d … artisan serve` does NOT forward -d/-c to the child `-S` process.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8000}"
HOST="${2:-0.0.0.0}"
INI="$ROOT/php-dev-upload.ini"
ROUTER="$ROOT/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"
if [[ -f "$ROOT/server.php" ]]; then
  ROUTER="$ROOT/server.php"
fi
cd "$ROOT/public"
exec php -c "$INI" -S "${HOST}:${PORT}" "$ROUTER"
