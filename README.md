# BH Timetracker

Internal time tracking tool (projects, estimates, reports and an MCP server for AI assistants).

- Product and technical plan: [`docs/PLAN.md`](docs/PLAN.md) – the source of truth.
- Project conventions for humans and AI agents: [`.ai/guidelines/project.md`](.ai/guidelines/project.md).

## Stack

Laravel 13 · Inertia 3 · React 19 · TypeScript · Tailwind CSS 4 · HeroUI v3 · Pest · Laravel Boost.
PHP 8.5. SQLite locally, Postgres in production.

## Local setup (Laravel Herd)

```bash
composer setup        # install deps, .env, key, migrate, build assets
php artisan db:seed   # demo data
composer dev          # vite + queue + logs
```

Passkeys require a secure context: run `herd secure` for the `.test` domain.

Demo users (local only, password login is disabled in production): `owner@example.com`,
`admin@example.com`, `member@example.com`, password `password`. Emails (magic links, invitations) go
to the log with `MAIL_MAILER=log` and are sent by the queue worker that `composer dev` starts.

Google sign-in: create an OAuth client in Google Cloud Console with redirect URI
`{APP_URL}/auth/google/callback` and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. The Google
button only appears when both are set.

First owner in a new environment (registration is invite-only):

```bash
php artisan app:create-owner you@example.com "Your Name" "Organization"
```

## Production

Production runs with Docker Compose on a single server: [`compose.yaml`](compose.yaml) and the
[`Dockerfile`](Dockerfile), built on [serversideup/php](https://serversideup.net/open-source/docker-php/docs/image-variations/frankenphp)
with FrankenPHP (PHP 8.5, Caddy). The same image runs four services:

| Service     | What it does                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`       | FrankenPHP on ports 80/443 with automatic HTTPS (Let's Encrypt for `APP_URL`'s host). On start it links storage, runs migrations and caches config/routes/views. Health check: `/up`. |
| `queue`     | `php artisan queue:work` (emails such as sign-in links and invitations).                                                                                                              |
| `scheduler` | `php artisan schedule:work`: pruning and the nightly backups (see below).                                                                                                             |
| `postgres`  | PostgreSQL 17, reachable only inside the stack.                                                                                                                                       |

Data lives in named volumes: `postgres` (database), `storage` (uploaded images, Passport keys) and
`caddy_data`/`caddy_config` (certificates). Logs go to the containers' output.

Requirements: a Linux server with Docker Engine and the Compose plugin, a DNS record for the app's host
pointing at it, and ports 80 and 443 open.

First deploy:

```bash
git clone git@github.com:Brane-Hubsch/bh-timetracker.git && cd bh-timetracker
cp .env.production.example .env   # fill in APP_KEY, APP_URL, DB_PASSWORD, mail, backups, ...
docker compose up -d --build
docker compose exec web php artisan passport:keys   # unless PASSPORT_*_KEY are set in .env
docker compose exec web php artisan app:create-owner you@example.com "Your Name" "Organization"
```

Generate `APP_KEY` with `docker compose run --rm --no-deps -e AUTORUN_ENABLED=false web php artisan key:generate --show` after the
first build, or with `php artisan key:generate --show` anywhere.

Deploy a new version:

```bash
git pull
docker compose up -d --build
```

`web` restarts on the new image (a few seconds of downtime, since FrankenPHP binds the ports itself) and
runs the migrations before it reports healthy; `queue` and `scheduler` restart after it.

Useful commands:

```bash
docker compose ps                                # status and health
docker compose logs -f web queue                 # follow the logs
docker compose exec web php artisan tinker       # artisan in the running app
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

Behind Cloudflare: keep the DNS record proxied with SSL/TLS mode "Full (strict)". Caddy trusts
Cloudflare's addresses by default (`TRUSTED_PROXY=cloudflare`), so Laravel sees the visitor's IP.

### Backups

Every night (02:30 Swedish time, production only) the scheduler dumps the database and zips it with the
uploaded images (`storage/app/public/images`) into an AES-256 encrypted archive on the `backups` disk:
a private S3-compatible bucket such as Cloudflare R2. Old archives are pruned at 03:15, and at 08:00
`backup:monitor` mails `BACKUP_NOTIFICATION_EMAIL` if the newest backup is missing, older than a day or
much smaller than the previous one. Failures are mailed as well. Settings: `config/backup.php`.

Setup:

1. Create a private bucket (R2: in the EU jurisdiction) and an API token limited to it with read and
   write access. Recommended: a lock/retention rule so that backups can't be deleted from the server.
2. Set `BACKUP_AWS_*`, `BACKUP_ARCHIVE_PASSWORD` and `BACKUP_NOTIFICATION_EMAIL` (see
   `.env.production.example`). Store the archive password, `APP_KEY` and the Passport keys outside the
   server: they are not in the backups and are needed to restore.
3. Run `docker compose exec scheduler php artisan backup:run` once, then
   `docker compose exec scheduler php artisan backup:list` to see it in the bucket. The image ships
   `pg_dump` 17 for the `postgres:17` service; when you upgrade Postgres, upgrade the client in the
   `Dockerfile` too (pg_dump must not be older than the server).

Restore (try it against an empty database every quarter):

```bash
# 1. Download the archive, e.g. bh-timetracker/2026-11-19-02-30-00.zip, from the bucket.
# 2. Unzip it with the archive password. macOS/Linux unzip can't open AES archives; use 7-Zip:
7z x 2026-11-19-02-30-00.zip -orestore
# 3. Load the dump into an empty database (e.g. a fresh postgres volume, before web starts).
docker compose up -d postgres
gunzip -c restore/db-dumps/postgresql-*.sql.gz \
  | docker compose exec -T postgres sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' > /dev/null
# 4. Put the images back, then start the app (it runs any newer migrations).
docker compose up -d
docker compose cp restore/images web:/var/www/html/storage/app/public/
docker compose exec -u root web chown -R www-data:www-data storage/app/public/images
```

## AI assistants (MCP)

The MCP server lives at `{APP_URL}/mcp` and uses OAuth 2.1 (Passport). `composer setup` creates the
Passport keys (`php artisan passport:keys`; the keys in `storage/` are not committed – in production set
`PASSPORT_PRIVATE_KEY` / `PASSPORT_PUBLIC_KEY` or run the command once in the `web` container, which keeps
them in the storage volume). `APP_URL` must be the public
URL, since it is used in the OAuth metadata.

Connect Claude: Settings → AI connections in the app shows the address and steps. To try it against
claude.ai locally, expose the app over HTTPS (e.g. `herd share` or `cloudflared tunnel --url
http://localhost:8000`), set `APP_URL` to the tunnel URL and add it as a custom connector. For debugging
use `php artisan mcp:inspector mcp`.

## Quality checks

```bash
composer ci:check     # vp check (lint/format), tsc, pint, larastan, pest
```
