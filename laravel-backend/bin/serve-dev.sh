#!/usr/bin/env bash
# Start Laravel with 256MB upload limits.
# Important: `artisan serve` spawns `php -S`, which does NOT inherit CLI `-d` flags.
# PHP_INI_SCAN_DIR is inherited by the child, so drop our 99-uploads.ini there.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UPLOAD_INI_DIR="$ROOT/php-dev.d"
# Trailing/empty segment keeps PHP's default scan dir where supported.
export PHP_INI_SCAN_DIR="${UPLOAD_INI_DIR}:${PHP_INI_SCAN_DIR:-}"

echo "[serve-dev] PHP_INI_SCAN_DIR=$PHP_INI_SCAN_DIR"
php -r 'echo "[serve-dev] upload_max_filesize=", ini_get("upload_max_filesize"), " post_max_size=", ini_get("post_max_size"), PHP_EOL;'

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}" "$@"
