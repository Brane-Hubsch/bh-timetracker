# Self-hosting BH Timetracker

This guide takes you from an empty server to a running BH Timetracker with HTTPS, email, nightly
backups and the MCP server for AI assistants. It covers two ways to run it:

- **[Your own server](#option-a-your-own-server)** with Docker Compose. FrankenPHP gets a Let's
  Encrypt certificate itself.
- **[Coolify](#option-b-coolify)**, which builds and deploys the same Compose file and handles domains
  and certificates for you.

## What you are running

The repository's [`Dockerfile`](../Dockerfile) builds one image ([serversideup/php](https://serversideup.net/open-source/docker-php/)
with FrankenPHP and PHP 8.5). [`compose.yaml`](../compose.yaml) runs it as four services:

| Service     | What it does                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `web`       | The app: Laravel Octane on FrankenPHP. On every start it runs the database migrations and caches the configuration. Health check: `/up`. |
| `queue`     | Sends email (sign-in links, invitations) and other background jobs.                                                                      |
| `scheduler` | Daily cleanup (expired links, invitations and OAuth tokens) and the nightly backups.                                                     |
| `postgres`  | PostgreSQL 17, reachable only inside the stack.                                                                                          |

Data lives in two named volumes: `postgres` (the database) and `storage` (uploaded profile pictures and
logos, and the OAuth keys if you generate them on the server). Logs go to the containers' output.

## Before you start

You need:

- **A Linux server** with Docker Engine and the Docker Compose plugin. The image is built on the
  server, and the frontend build is the heaviest step, so give it at least 2 GB of memory.
- **A domain name**, e.g. `tid.example.com`, with a DNS record pointing at the server.
- **An SMTP account** for outgoing email. Everyone signs in with passkeys, Google or an emailed link,
  and new users join through emailed invitations, so the app does not work without email. Any SMTP
  provider works (Postmark, Resend, Amazon SES, Mailgun, your own mail server, ...).
- **An S3-compatible bucket** for the nightly backups, e.g. Cloudflare R2, Amazon S3 or Backblaze B2.
  Strongly recommended: without it the backups fail every night and you get an email about it.
- **Optional:** a Google Cloud OAuth client if you want "Sign in with Google".

Good to know before you start:

- The user interface is in **Swedish** by default. Set `APP_LOCALE=en` for English.
- New organizations default to **SEK**, the **Europe/Stockholm** time zone and weeks that start on
  Monday. Each organization changes these in its settings, and each user picks their own time zone.
- The nightly backups run at 02:30 **Swedish time**.
- There is no open sign-up by default. You create the first owner from the command line, and everyone
  else is invited from the app.

## 1. Prepare the settings

All settings are environment variables. [`compose.yaml`](../compose.yaml) lists every variable the
containers receive (under `x-app-environment`) with its default, and
[`.env.production.example`](../.env.production.example) explains each one. A variable that is not
listed in `compose.yaml` does not reach the containers.

Required (the deploy stops with a message if one is empty):

| Variable            | Value                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_KEY`           | Encryption key for sessions and encrypted data. Generate it once with `echo "base64:$(openssl rand -base64 32)"` and **never change it**, or existing sessions and encrypted data stop working. |
| `APP_URL`           | The public HTTPS address, e.g. `https://tid.example.com`. Used in emailed links and in the OAuth metadata for AI assistants, so it must be exactly the address people use.                      |
| `DB_PASSWORD`       | A long random string, e.g. from `openssl rand -hex 32`. Also used to create the database on the first start.                                                                                    |
| `MAIL_FROM_ADDRESS` | The sender address for email, e.g. `tid@example.com`.                                                                                                                                           |

Also needed for a working installation:

| Variables                                                              | Purpose                                                                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`             | Your SMTP account. Keep `MAIL_MAILER=smtp`.                                                                                        |
| `BACKUP_AWS_*`, `BACKUP_ARCHIVE_PASSWORD`, `BACKUP_NOTIFICATION_EMAIL` | Nightly backups, see [Backups](#backups).                                                                                          |
| `APP_NAME`                                                             | The name shown in the app and in emails (default "BH Timetracker"). It is built into the frontend, so changing it needs a rebuild. |

Optional:

| Variables                                              | Purpose                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`             | "Sign in with Google", see [Sign-in options](#sign-in-options). The button only appears when both are set.         |
| `AUTH_OPEN_REGISTRATION`                               | `true` lets anyone who can reach the site create an account and an organization. Default `false`.                  |
| `PASSPORT_PRIVATE_KEY`, `PASSPORT_PUBLIC_KEY`          | OAuth keys for AI assistants, see [AI assistants](#ai-assistants-mcp). Leave empty to generate them on the server. |
| `TRUSTED_PROXIES`                                      | Needed behind Cloudflare or another proxy, see [Behind Cloudflare](#behind-cloudflare-or-another-proxy).           |
| `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID`, `UMAMI_DOMAIN` | Pageview analytics with [Umami](https://umami.is). Off unless all three are set.                                   |
| `APP_LOCALE`                                           | `sv` (default) or `en`.                                                                                            |

Keep `APP_KEY`, `DB_PASSWORD`, `BACKUP_ARCHIVE_PASSWORD` and the OAuth keys in a password manager as
well: they are not part of the backups, and you need them to restore.

## 2. Deploy

Pick one of the two ways to run the stack.

### Option A: your own server

[`compose.standalone.yaml`](../compose.standalone.yaml) adds what a server without Coolify needs:
FrankenPHP listens on ports 80 and 443 and gets a Let's Encrypt certificate for `APP_URL`'s host.

1. Point the DNS record for your domain at the server and open ports 80 and 443 in its firewall.
   Let's Encrypt must be able to reach port 80 to issue the certificate.
2. Clone the repository and create the settings file:

    ```bash
    git clone https://github.com/Brane-Hubsch/bh-timetracker.git
    cd bh-timetracker
    cp .env.production.example .env
    ```

3. Fill in `.env` as described in [Prepare the settings](#1-prepare-the-settings). It already sets
   `COMPOSE_FILE=compose.yaml:compose.standalone.yaml`, so plain `docker compose` uses both files.
4. Build and start the stack. The first build takes a few minutes.

    ```bash
    docker compose up -d --build
    docker compose ps
    ```

    Wait until `web` shows as healthy; `queue` and `scheduler` start after it.

5. Generate the OAuth keys for AI assistants (skip this if you set `PASSPORT_*_KEY` in `.env`). They
   are stored in the `storage` volume.

    ```bash
    docker compose exec web php artisan passport:keys
    ```

6. Create the first owner, see [First sign-in](#3-first-sign-in):

    ```bash
    docker compose exec web php artisan app:create-owner you@example.com "Your Name" "Your Organization"
    ```

To try the stack on a server without a public domain, set `CADDY_AUTO_HTTPS=off` in `.env`. FrankenPHP
then serves a self-signed certificate that browsers warn about.

### Option B: Coolify

[Coolify](https://coolify.io) deploys `compose.yaml` as it is and puts its own proxy (with
certificates) in front of the `web` service.

1. Create a new resource from your Git repository (via the GitHub app or a deploy key) with the build
   pack **Docker Compose**, branch `main` and Docker Compose location `/compose.yaml`.
2. **Domains:** give the `web` service your domain with the container port, e.g.
   `https://tid.example.com:8080`. Coolify routes the domain to port 8080 and handles the certificate.
   The other services get no domain.
3. **Environment Variables:** Coolify lists the variables from `compose.yaml`. Fill them in as described
   in [Prepare the settings](#1-prepare-the-settings), with `APP_URL` matching the domain. Multi-line
   values such as `PASSPORT_PRIVATE_KEY` are fine. Keep **Available during build** on for `APP_NAME`.
4. Deploy, and wait for the deployment to finish.
5. Open **Terminal**, choose the `web` container and run:

    ```bash
    php artisan passport:keys   # skip if PASSPORT_*_KEY are set
    php artisan app:create-owner you@example.com "Your Name" "Your Organization"
    ```

In the rest of this guide, run commands written as `docker compose exec <service> ...` in that
service's terminal in Coolify, without the `docker compose exec <service>` part.

## 3. First sign-in

`app:create-owner` creates the user and their organization, and emails a sign-in link (valid for
15 minutes). If the email does not arrive, see [Troubleshooting](#troubleshooting).

1. Open the link and sign in. The app then offers to set up a **passkey**. Do it, so you can sign in
   without waiting for an email next time.
2. Open the organization's settings (Organisationsinställningar, from the organization switcher) and
   check the name, currency, time zone, week start and default hourly rate.
3. Add your public holidays under **Helgdagar** (Holidays). They are kept per organization and are
   used for absence and working-day calculations.
4. Invite your colleagues under **Team** → **Bjud in medlem** (Invite member). They get an email, sign
   in with the link and set up their own passkey. Roles: owners and admins manage clients, projects,
   members and rates and see everyone's time; members report and see their own time.

Coming from Clockify? Owners and admins can import Clockify's CSV exports from the organization's
settings (**Import**), with a preview before anything is saved.

## Sign-in options

The app has no passwords in production. Users sign in with:

- **Passkeys** (Face ID, Touch ID, Windows Hello, a security key or a password manager). They need
  HTTPS, which both setups provide.
- **Email links** that are valid for 15 minutes. These always work, so email must be set up.
- **Google**, if you configure it:
    1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
       OAuth client of type **Web application**.
    2. Add the authorized redirect URI `https://tid.example.com/auth/google/callback` (your `APP_URL`
       followed by `/auth/google/callback`).
    3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and redeploy.

    Google sign-in matches users by email address, so people still need an invitation (or open
    registration) to get an account.

## AI assistants (MCP)

The app includes an MCP server at `{APP_URL}/mcp`, so assistants such as Claude can report time and
pull reports as the signed-in user, with the same permissions as in the app. Clients connect with
OAuth 2.1 and register themselves, so there is nothing to set up per client.

- The OAuth keys must exist: either run `php artisan passport:keys` once in the `web` container (the
  keys stay in the `storage` volume), or set `PASSPORT_PRIVATE_KEY` and `PASSPORT_PUBLIC_KEY`.
- `APP_URL` must be the public HTTPS address, since it is published in the OAuth metadata.
- Each user finds the address and the steps to connect under **Inställningar** → **AI-kopplingar**
  (Settings → AI connections), where they can also revoke connected clients.

## Backups

Every night at 02:30 (Swedish time) the scheduler dumps the database, zips it with the uploaded images
into an AES-256 encrypted archive and uploads it to the backup bucket. Old archives are removed at
03:15: every backup is kept for a week, then one a day for a month, one a week for two months and one
a month for a year. At 08:00 the scheduler checks that the newest backup is less than a day old and
not much smaller than the previous one. Failures and suspicious backups are emailed to
`BACKUP_NOTIFICATION_EMAIL`. Settings: [`config/backup.php`](../config/backup.php).

### Set up

1. Create a **private** bucket and an API token that can only read and write that bucket.
   Recommended: a lock or retention rule on the bucket, so that someone with access to the server
   cannot delete the backups.
2. Set the variables:
    - Cloudflare R2: `BACKUP_AWS_DEFAULT_REGION=auto` and
      `BACKUP_AWS_ENDPOINT=https://<account id>.r2.cloudflarestorage.com`.
    - Amazon S3: the bucket's region, e.g. `eu-north-1`, and no endpoint.
    - Plus `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`, `BACKUP_AWS_BUCKET`,
      `BACKUP_ARCHIVE_PASSWORD` (a long random string) and `BACKUP_NOTIFICATION_EMAIL`.
3. Redeploy, then run a backup by hand and check that it shows up in the bucket:

    ```bash
    docker compose exec scheduler php artisan backup:run
    docker compose exec scheduler php artisan backup:list
    ```

The image ships `pg_dump` 17 for the `postgres:17` service. If you upgrade PostgreSQL, upgrade the
client in the `Dockerfile` too: `pg_dump` must not be older than the server.

### Restore

Practise this on a test server now and then, so you know it works before you need it.

1. Download an archive from the bucket, e.g. `bh-timetracker/2026-11-19-02-30-00.zip`.
2. Unzip it with `BACKUP_ARCHIVE_PASSWORD`. The standard `unzip` on macOS and Linux cannot open AES
   archives; use 7-Zip:

    ```bash
    7z x 2026-11-19-02-30-00.zip -orestore
    ```

3. On a server with the same `.env` (including the same `APP_KEY`), start only the database, with an
   empty `postgres` volume, and load the dump:

    ```bash
    docker compose up -d postgres
    gunzip -c restore/db-dumps/postgresql-*.sql.gz \
      | docker compose exec -T postgres sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' > /dev/null
    ```

4. Start the app (it runs any newer migrations), then put the images back:

    ```bash
    docker compose up -d
    docker compose cp restore/images web:/var/www/html/storage/app/public/
    docker compose exec -u root web chown -R www-data:www-data storage/app/public/images
    ```

5. Restore the OAuth keys: set `PASSPORT_*_KEY` from your password manager, or run
   `php artisan passport:keys` and let AI assistants connect again.

## Upgrading

New versions arrive on the `main` branch. Before you upgrade:

1. Read what changed since your version, especially new files in `database/migrations/`, changes to
   `compose.yaml` and new variables in `.env.production.example`.
2. Take a fresh backup and check that it is in the bucket:

    ```bash
    docker compose exec scheduler php artisan backup:run
    docker compose exec scheduler php artisan backup:list
    ```

Then, on your own server:

```bash
git pull
docker compose up -d --build
```

In Coolify, click **Redeploy** (or let automatic deploys on push do it) and follow the deployment logs.

`web` is replaced first and runs the new migrations before it reports healthy; `queue` and `scheduler`
restart after it. Expect a few seconds of downtime. Afterwards, check `{APP_URL}/up` and open a report
you know.

Never run `docker compose down -v` or `php artisan migrate:fresh` on a server with real data: both
delete the database.

## Day-to-day operations

```bash
docker compose ps                                # status and health of the services
docker compose logs -f web queue scheduler       # follow the logs
docker compose exec web php artisan about        # versions and configuration overview
docker compose exec web php artisan octane:reload  # restart the app workers without recreating containers
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'   # database shell
```

The app is booted once per worker and kept in memory (Octane), so changed settings take effect only
when the containers are recreated: `docker compose up -d` on your own server, or a redeploy in Coolify.

Tuning, if needed: `OCTANE_WORKERS` (number of workers, default `auto` = one per CPU),
`OCTANE_MAX_REQUESTS` (requests before a worker is replaced, default 500) and
`OCTANE_MAX_EXECUTION_TIME` (seconds per request, default 120).

### Behind Cloudflare or another proxy

The app uses the visitor's IP address for rate limits, so it must know which proxies to trust:

- **Your own server behind Cloudflare:** keep the DNS record proxied with SSL/TLS mode
  **Full (strict)**, and set `TRUSTED_PROXIES` to [Cloudflare's IP ranges](https://www.cloudflare.com/ips/),
  comma separated.
- **Coolify:** the default trusts Coolify's proxy on private networks. Behind Cloudflare, add
  Cloudflare's ranges to that default: `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,<Cloudflare's ranges>`.

## Troubleshooting

### The deploy stops with "Set ..." or "Generate one with ..."

A required variable is empty. The message names it.

### Sign-in links and invitations do not arrive

Email is sent by the `queue` service. Check `docker compose logs queue` for errors, check the
`MAIL_*` settings and that your provider accepts `MAIL_FROM_ADDRESS` as sender, and look in the spam
folder. Changed settings need recreated containers.

### No certificate on your own server

Check that the DNS record points at the server and that ports 80 and 443 are open, then look at
`docker compose logs web`. Let's Encrypt limits how often it issues certificates for the same
domain, so fix the cause before retrying many times.

### Links in emails point to the wrong address, or AI assistants cannot connect

`APP_URL` must be the exact public HTTPS address. Recreate the containers after changing it.

### Passkeys cannot be created

Passkeys only work over HTTPS on the domain in `APP_URL`, not on an IP address or another host name.

### Everyone is signed out after a deploy, or encrypted data cannot be read

`APP_KEY` changed. Put the original key back.

### The nightly backup fails

Run `docker compose exec scheduler php artisan backup:run` to see the error. Usually the bucket
credentials, endpoint or region are wrong.
