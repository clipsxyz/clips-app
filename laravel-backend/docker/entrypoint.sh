#!/bin/sh
set -eu

cd /var/www/html

mkdir -p \
    /data \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

if [ ! -f /data/database.sqlite ]; then
    touch /data/database.sqlite
fi

chown -R www-data:www-data /data storage bootstrap/cache
chmod 664 /data/database.sqlite || true

php artisan package:discover --ansi
php artisan storage:link --force

if [ "${1:-web}" = "reverb" ]; then
    exec php artisan reverb:start --host=0.0.0.0 --port=8080
fi

php artisan migrate --force
chown -R www-data:www-data /data storage bootstrap/cache
php-fpm -D
exec nginx -g "daemon off;"
