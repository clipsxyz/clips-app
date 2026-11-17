FROM php:8.3-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        nginx \
        unzip \
        libonig-dev \
        libpng-dev \
        libsqlite3-dev \
        libzip-dev \
        zlib1g-dev \
    && docker-php-ext-install \
        bcmath \
        gd \
        pcntl \
        pdo_sqlite \
        zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY docker/php-uploads.ini /usr/local/etc/php/conf.d/uploads.ini
COPY docker/php-fpm-listen.conf /usr/local/etc/php-fpm.d/zz-listen.conf
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY . .
RUN composer install --no-dev --no-scripts --prefer-dist --no-interaction \
    && composer require laravel/reverb:^1.4 --no-dev --no-scripts --no-interaction --update-with-dependencies \
    && composer dump-autoload --optimize --no-dev --no-interaction \
    && mkdir -p \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["web"]
