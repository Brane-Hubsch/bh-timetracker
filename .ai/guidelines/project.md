# BH Timetracker – project conventions

The product and technical plan lives in `docs/PLAN.md` and is the source of truth. If something in the
plan looks wrong or contradictory, raise it instead of silently deviating. Build only what the plan
describes; propose additions instead of building them.

## Domain layer

- All write/business logic lives in `app/Actions` (one class per operation, e.g. `CreateTimeEntry`,
  `ArchiveProject`) with a single public `handle()` method. Controllers and MCP tools stay thin:
  validate → authorize → call an Action → respond. No business logic in controllers, MCP tools,
  models' event hooks or Form Requests.
- Every Action, policy and MCP tool has Pest tests, including authorization tests and tests that prove
  data from another organization cannot be read or changed.

## Multi-tenancy (organizations)

- The tenant is `App\Models\Organization`. A user belongs to many organizations through
  `organization_members` (`App\Models\Membership`) with a role from `App\Enums\OrganizationRole`
  (`owner`, `admin`, `member`).
- Tenant routes are prefixed with the organization slug: `/{current_organization}/...`. The
  `EnsureOrganizationMembership` middleware resolves it, checks membership and makes it the user's
  current organization. `users.current_organization_id` remembers the last used organization (for
  redirects after login and as the default for MCP tools).
- Resolve the active organization through `App\Support\CurrentOrganization`, never by reading
  `current_organization_id` ad hoc.
- Models with an `organization_id` column use the `App\Models\Concerns\BelongsToOrganization` trait.
  Never query tenant data without an organization scope, and test it.
- Policies always verify membership in the resource's organization before checking the role.
- There are no personal organizations. An organization must always have at least one owner.

## Time, money and data

- Store timestamps in UTC; display them in the user's timezone. Use `CarbonImmutable` (it is the app
  default via `Date::use()`).
- Durations are integers in seconds. Money is an integer in the smallest currency unit (öre);
  format it in the frontend with `Intl.NumberFormat`.
- Keep SQL database-agnostic: the app runs on SQLite locally and Postgres in production, and the test
  suite runs against both in CI. No `strftime`, `date_trunc` or other engine-specific SQL; do date
  bucketing for reports in PHP.

## Frontend

- Inertia 3 + React 19 + TypeScript (strict) + Tailwind CSS 4.
- UI components come from HeroUI v3 (`@heroui/react`). Use the HeroUI MCP server / docs for current
  APIs instead of guessing — v3 is compound-component based (e.g. `Card.Header`, `Modal.Dialog`) and
  uses `onPress`, not `onClick`. Our own reusable components live in `resources/js/components` and are
  built on HeroUI. The remaining shadcn/ui components in `resources/js/components/ui` are legacy and
  must not be used in new code; they are removed as screens are migrated.
- Use Wayfinder (`@/actions/...`, `@/routes/...`) for typed routes, never hard-coded URLs.
- Shared Inertia prop types live in `resources/js/types`.
- i18n: no hard-coded UI strings. Translations live in Laravel's `lang/{locale}.json` (Swedish `sv` is
  the default, English `en` is prepared). Use the `useTranslation()` hook / `t()` from
  `@/lib/i18n` in React and `__()` in PHP. Keys are the English source strings.
- Mobile first for data entry, desktop first for reports and administration. No hover-only features.

## Code quality

- Pest for tests, Larastan (see `phpstan.neon` for the level), Pint, `vp check` (Oxlint + Oxfmt via
  Vite+) and `tsc --noEmit`. Run `composer ci:check` before committing.
- Identifiers and code comments in English; UI copy in Swedish via translation files.
- Small commits with clear messages on feature branches. Never push to `main` or open PRs without
  asking.
