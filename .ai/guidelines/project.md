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
- `EnsureOrganizationMembership` runs before route model binding (middleware priority) and removes the
  `current_organization` route parameter, so tenant models in URLs are bound through
  `OrganizationScope` (other organizations' ids give 404) and controller signatures stay simple.
- Deactivated memberships (`organization_members.deactivated_at`) count as non-members everywhere.
- Permissions per role live in `OrganizationRole::permissions()` (`ManageClients`, `ManageProjects`,
  `ViewRates`, ...). Rates and amounts are only sent to the frontend when the viewer may see them.
- Hourly rates resolve via `App\Support\RateResolver` (project member → project → organization member
  → organization default) and are snapshotted on time entries.
- There are no personal organizations. An organization must always have at least one owner.

## Time entries

- Time entries are written only through `app/Actions/TimeEntries` (`CreateTimeEntry`, `UpdateTimeEntry`,
  `CreateTimeEntries`, `DeleteTimeEntry`, `RestoreTimeEntry`); the shared `ValidatesTimeEntries` rules
  (active member, accessible non-archived project, end after start, at most 24 h) apply to web and MCP.
- Members manage their own time; `ManageTeamTime` (owner/admin) may view and report for other members
  (`TimeEntryPolicy::manageFor`). Deletes are soft deletes so they can be undone.
- Users enter times in their own time zone; requests convert to UTC. The frontend receives local
  wall-clock strings (`YYYY-MM-DDTHH:mm`) from `App\Support\TimeEntryPresenter`, and FullCalendar runs
  with `timeZone="UTC"` so they display unchanged.
- Parse free-form durations ("1,5", "1:30", "90m") with `App\Support\DurationParser` (PHP) or
  `parseDuration` in `@/lib/time` (React).
- Tags (`App\Models\Tag`) belong to the organization and are attached to time entries by name: actions
  resolve names with `App\Actions\Tags\ResolveTags` (case-insensitive, creates missing ones; anyone may
  create tags while reporting). Renaming to an existing name merges (`RenameTag`); managing the list
  needs `ManageTags`. Eager load `tags` wherever entries are presented (`TimeEntry::tagNames()`).

## Reports

- Reports are built by `App\Services\Reports\ReportBuilder` from a `ReportFilters` DTO (period as local
  dates in the viewer's time zone, members, clients, projects, billable). The filters enforce
  visibility: without `ManageTeamTime` a viewer only ever gets their own time, and amounts are null
  without `ViewRates`. Reuse the builder (e.g. for MCP `get_report`) instead of querying entries.
- Entries count towards the local day they start on. Day/week/month bucketing happens in PHP.
- Amounts are billable seconds × the snapshotted rate, rounded per entry, in minor units.
- Report filters live in the URL (`ReportRequest`), so reports can be bookmarked.
- Exports go through `App\Services\Reports\ReportExporter` (CSV/XLSX via openspout, PDF via dompdf from
  the Blade views in `resources/views/reports/pdf`) with the same `ReportFilters` visibility rules.

## MCP (AI assistants)

- The MCP server is `App\Mcp\Servers\TimetrackerServer` on `/mcp` (`routes/ai.php`), protected by
  Passport OAuth (`auth:api`). Tools act as the signed-in user: resolve the organization with
  `App\Mcp\Support\McpContext::from($request)` (optional `organization` slug, else the user's current
  one) and authorize with the same policies as the web app.
- Tools stay thin: validate → resolve names with `App\Mcp\Support\Lookup` (id or name; ambiguous names
  error with the candidates) → authorize → call an Action / `ReportBuilder` → return
  `Response::structured()` with local times and decimal hours. Entries created via MCP use
  `TimeEntrySource::Mcp`.
- Tool descriptions and error messages are English (read by the AI). Mark read tools `#[IsReadOnly]`
  and destructive ones `#[IsDestructive]`.

## Authentication

- Passwordless: passkeys (Fortify / `laravel/passkeys`), Google (Socialite) and magic links
  (`app/Actions/Auth`, `routes/auth.php`). Accounts come from invitations; open registration is a
  config flag (`auth.open_registration`, off by default).
- Password login exists only for local development and tests (`App\Support\SignInOptions`); it is
  always off in production. Never build features that depend on users having a password.
- Sensitive actions use the `password.confirm` middleware; users confirm with a passkey or an emailed
  link. A fresh sign-in counts as confirmed.

## Time, money and data

- Store timestamps in UTC; display them in the user's timezone. Use `CarbonImmutable` (it is the app
  default via `Date::use()`).
- Durations are integers in seconds. Money is an integer in the smallest currency unit (öre);
  format it in the frontend with `Intl.NumberFormat`.
- Lazy loading is blocked outside production (`Model::preventLazyLoading`): eager load relations used in
  loops. Resolve permissions once per request/report, not per row.
- Keep SQL database-agnostic: the app runs on SQLite locally and Postgres in production, and the test
  suite runs against both in CI. No `strftime`, `date_trunc` or other engine-specific SQL; do date
  bucketing for reports in PHP.

## Frontend

- Inertia 3 + React 19 + TypeScript (strict) + Tailwind CSS 4.
- Typeface: Inter (400/500/600 from Bunny Fonts via `vite.config.ts`, `--font-sans` in `app.css`). PDFs
  embed the same family from `resources/fonts/inter` (Regular/Bold, OFL) with font subsetting.
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
- Content width: pages default to `max-w-7xl`; the calendar (week/day) and reports set the `wide` width
  (`Page.layout = { width: 'wide' }` or `setLayoutProps`), which uses the full available width; the
  calendar also fills the viewport height on desktop. Use responsive grids
  (e.g. `xl:` columns, auto-fit filter grids) rather than stretching single columns.
- Accessibility: one `h1` per page (`Heading` renders it), view switchers and filters use
  `SegmentedControl` (HeroUI ToggleButtonGroup), not `Tabs` without panels; icon-only buttons need an
  `aria-label`. Use the `muted`/`accent` tokens from `app.css`, which are tuned for WCAG AA.
- Errors render the `error` page in production (`AppServiceProvider::configureErrorPages`).
- Motion is subtle and functional: page visits use View Transitions (only the content area, see
  `app.tsx` and `.page-transition`), not filter/paging updates or form posts. Use the `animate-enter`,
  `animate-fade-in`, `animate-grow-x/y` tokens from `app.css` and `transition-colors` on interactive
  rows; everything respects `prefers-reduced-motion`.
- New pages and frequent actions get a command in the ⌘K palette (`components/command-palette.tsx`,
  respecting permissions). Pages open dialogs from the palette through `useOpenFromQuery` (`?new=1`).
- Time entries open in `ResponsiveDialog` (modal on desktop, bottom sheet on mobile). Create/edit forms
  for clients and projects open in `SideDrawer` (right-hand panel on desktop, bottom sheet on mobile) on
  the page they belong to, not on a separate page; the controller sends the form's options only to
  users who may use it (e.g. `projectForm` via `App\Support\ProjectFormOptions`).

## Code quality

- Pest for tests, Larastan (see `phpstan.neon` for the level), Pint, `vp check` (Oxlint + Oxfmt via
  Vite+) and `tsc --noEmit`. Run `composer ci:check` before committing.
- Identifiers and code comments in English; UI copy in Swedish via translation files.
- Small commits with clear messages on feature branches. Never push to `main` or open PRs without
  asking.
