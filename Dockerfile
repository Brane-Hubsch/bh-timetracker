# syntax=docker/dockerfile:1

# Production image: serversideup/php with FrankenPHP (Caddy). The web service runs Laravel Octane in
# FrankenPHP's worker mode with the image's frankenphp binary and Caddyfile; the same image runs the
# queue worker and the scheduler (see compose.yaml). Secrets are never baked in: they come from the
# environment at runtime.

ARG PHP_IMAGE=serversideup/php:8.5-frankenphp-trixie
ARG NODE_IMAGE=node:22-trixie-slim

########################################################
# Base: PHP extensions and tools the app needs
########################################################
FROM ${PHP_IMAGE} AS base

USER root

# gd + exif: image uploads (intervention/image). intl: number and currency formatting in exports.
# postgresql-client: pg_dump for the nightly backups; Debian trixie ships version 17, matching the
# postgres:17 service in compose.yaml (pg_dump must not be older than the server).
RUN install-php-extensions gd exif intl \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

USER www-data

########################################################
# Composer dependencies
########################################################
FROM base AS vendor

COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-autoloader --no-scripts --prefer-dist

########################################################
# Frontend build: needs Node and PHP (the Wayfinder Vite plugin runs php artisan)
########################################################
FROM ${NODE_IMAGE} AS node

FROM vendor AS assets

USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
USER www-data

ENV npm_config_cache=/tmp/.npm

COPY --chown=www-data:www-data package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY --chown=www-data:www-data . .

# Public values only: everything prefixed VITE_ ends up in the browser bundle.
ARG VITE_APP_NAME="BH Timetracker"
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN composer dump-autoload --no-dev --optimize \
    && npm run build

########################################################
# Production image
########################################################
FROM base AS production

ENV PHP_OPCACHE_ENABLE=1 \
    LOG_CHANNEL=stderr

COPY --chown=www-data:www-data --from=vendor /var/www/html/vendor ./vendor
COPY --chown=www-data:www-data . .
COPY --chown=www-data:www-data --from=assets /var/www/html/public/build ./public/build

RUN composer dump-autoload --no-dev --optimize
