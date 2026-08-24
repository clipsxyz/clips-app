#!/bin/sh
# php artisan serve ignores .user.ini — load php-dev.d so MP4 uploads are not capped at 2M.
ROOT="$(cd "$(dirname "$0")" && pwd)"
SCAN_DIR="$ROOT/php-dev.d"
if [ -n "${PHP_INI_SCAN_DIR:-}" ]; then
  export PHP_INI_SCAN_DIR="${PHP_INI_SCAN_DIR}:${SCAN_DIR}"
else
  DEFAULT_SCAN="$(php --ini 2>/dev/null | awk -F': ' '/Scan for additional/ {print $2}')"
  if [ -n "$DEFAULT_SCAN" ] && [ "$DEFAULT_SCAN" != "(none)" ]; then
    export PHP_INI_SCAN_DIR="${DEFAULT_SCAN}:${SCAN_DIR}"
  else
    export PHP_INI_SCAN_DIR="$SCAN_DIR"
  fi
fi
cd "$ROOT"
exec php artisan serve --host=0.0.0.0 --port=8000 "$@"
