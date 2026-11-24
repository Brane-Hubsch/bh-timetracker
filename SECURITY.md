# Security policy

## Supported versions

BH Timetracker has no versioned releases. Security fixes go into the `main` branch only, so run the
latest `main` and redeploy when it changes.

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues, discussions or pull requests.

Report them privately through GitHub instead: open the repository's **Security** tab and choose
**Report a vulnerability**. Include what you found, the steps to reproduce it, and the impact you
expect. We will acknowledge the report, keep you updated while we work on a fix, and credit you in
the advisory unless you prefer otherwise.

Areas we are especially interested in:

- Sign-in: passkeys, magic links, Google sign-in, invitations and access confirmation.
- The MCP server and its OAuth 2.1 flow (Passport).
- Isolation between organizations: reading or changing another organization's data.
- Roles and permissions within an organization, such as members seeing rates or other members' time.

## Running your own installation

You are responsible for the security of installations you run yourself: keep `APP_KEY`, the database
password, the Passport keys and the backup archive password secret, keep `APP_DEBUG=false` in
production, and redeploy when `main` receives security fixes.
