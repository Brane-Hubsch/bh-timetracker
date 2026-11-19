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

Requirements: PHP 8.5, PostgreSQL 16, Node 22 (build only), HTTPS. Start from `.env.production.example`.

Deploy:

```bash
composer install --no-dev --optimize-autoloader
npm ci && npm run build
php artisan migrate --force
php artisan optimize
```

Run alongside the web server:

- a queue worker for emails (`php artisan queue:work --tries=3`), kept alive by the platform/Supervisor;
- the scheduler every minute (`php artisan schedule:run`): prunes expired invitations, magic links and
  OAuth tokens, and runs the nightly backups (see below);
- `/up` as health check.

First deploy: `php artisan passport:keys` (or set `PASSPORT_PRIVATE_KEY`/`PASSPORT_PUBLIC_KEY`) and create
the first owner with `php artisan app:create-owner`.

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
3. Install `pg_dump` in the database server's major version (or set `DB_DUMP_BINARY_PATH`) and run
   `php artisan backup:run` once, then `php artisan backup:list` to see it in the bucket.

Restore (try it against an empty database every quarter):

```bash
# 1. Download the archive, e.g. bh-timetracker/2026-11-19-02-30-00.zip, from the bucket.
# 2. Unzip it with the archive password. macOS/Linux unzip can't open AES archives; use 7-Zip:
7z x 2026-11-19-02-30-00.zip -orestore
# 3. Load the dump into an empty database, then run any newer migrations.
gunzip -c restore/db-dumps/postgresql-*.sql.gz | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
php artisan migrate --force
# 4. Put the images back and clear caches.
cp -R restore/images storage/app/public/
php artisan optimize:clear
```

## AI assistants (MCP)

The MCP server lives at `{APP_URL}/mcp` and uses OAuth 2.1 (Passport). `composer setup` creates the
Passport keys (`php artisan passport:keys`; the keys in `storage/` are not committed – in production set
`PASSPORT_PRIVATE_KEY` / `PASSPORT_PUBLIC_KEY` or run the command on deploy). `APP_URL` must be the public
URL, since it is used in the OAuth metadata.

Connect Claude: Settings → AI connections in the app shows the address and steps. To try it against
claude.ai locally, expose the app over HTTPS (e.g. `herd share` or `cloudflared tunnel --url
http://localhost:8000`), set `APP_URL` to the tunnel URL and add it as a custom connector. For debugging
use `php artisan mcp:inspector mcp`.

## Quality checks

```bash
composer ci:check     # vp check (lint/format), tsc, pint, larastan, pest
```
