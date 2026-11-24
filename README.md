# BH Timetracker

Time tracking for small teams: report time in a week calendar, keep track of clients, projects and
estimates, and get reports with hours and amounts. An MCP server lets AI assistants such as Claude
report time and pull reports on your behalf.

## Features

- **Time reporting** in a week/day calendar (drag to create, resize and move), with tags, billable
  time and absence. Mobile friendly.
- **Clients and projects** with estimates, hourly rates (per organization, member, project and project
  member), colors and public or private visibility.
- **Reports** grouped by client, project, member or period, with charts and export to CSV, XLSX and
  PDF. Filters live in the URL, so reports can be bookmarked.
- **Organizations** with owner, admin and member roles; a user can belong to several.
- **Passwordless sign-in** with passkeys, Google or email links. Accounts come from invitations.
- **MCP server** (OAuth 2.1) for AI assistants, acting with the signed-in user's permissions.
- **Clockify import** from CSV exports, with a preview before anything is saved.
- Swedish user interface (English prepared), self-hosted with Docker Compose.

## Documentation

- Product and technical plan: [`docs/PLAN.md`](docs/PLAN.md) (in Swedish) – the source of truth.
- Running your own installation: [`docs/self-hosting.md`](docs/self-hosting.md).
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

## Self-hosting

BH Timetracker runs anywhere Docker Compose does: on a server of your own, where FrankenPHP gets a
Let's Encrypt certificate itself, or in [Coolify](https://coolify.io). One image runs the app (Laravel
Octane on FrankenPHP), a queue worker and the scheduler next to PostgreSQL 17, with nightly encrypted
backups to an S3-compatible bucket.

The [self-hosting guide](docs/self-hosting.md) covers requirements, settings, the first sign-in, Google
sign-in, AI assistants, backups and restores, upgrades and troubleshooting.

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

## Contributing

Issues and pull requests are welcome. Work on a branch, keep commits small, and run
`composer ci:check` before opening a pull request. Business logic lives in `app/Actions` and is
covered by Pest tests; see the project conventions above.

## Security

Please report vulnerabilities privately, not in public issues. See [`SECURITY.md`](SECURITY.md).

## License

BH Timetracker is open-source software licensed under the [MIT license](LICENSE).
