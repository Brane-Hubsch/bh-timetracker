<laravel-boost-guidelines>
=== .ai/project rules ===

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

## Reports

- Reports are built by `App\Services\Reports\ReportBuilder` from a `ReportFilters` DTO (period as local
  dates in the viewer's time zone, members, clients, projects, billable). The filters enforce
  visibility: without `ManageTeamTime` a viewer only ever gets their own time, and amounts are null
  without `ViewRates`. Reuse the builder (e.g. for MCP `get_report`) instead of querying entries.
- Entries count towards the local day they start on. Day/week/month bucketing happens in PHP.
- Amounts are billable seconds × the snapshotted rate, rounded per entry, in minor units.
- Report filters live in the URL (`ReportRequest`), so reports can be bookmarked.

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
- Small forms open in `ResponsiveDialog` (modal on desktop, bottom sheet on mobile). Larger create/edit
  forms open in `SideDrawer` (right-hand panel on desktop, bottom sheet on mobile) on the page they
  belong to, not on a separate page; the controller sends the form's options only to users who may
  use it (e.g. `projectForm` via `App\Support\ProjectFormOptions`).

## Code quality

- Pest for tests, Larastan (see `phpstan.neon` for the level), Pint, `vp check` (Oxlint + Oxfmt via
  Vite+) and `tsc --noEmit`. Run `composer ci:check` before committing.
- Identifiers and code comments in English; UI copy in Swedish via translation files.
- Small commits with clear messages on feature branches. Never push to `main` or open PRs without
  asking.

=== foundation rules ===

# Laravel Boost Guidelines

## Foundational Context

This application is a Laravel application running on PHP 8.5. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If a frontend change doesn't show in the UI or you get a "Unable to locate file in Vite manifest" error, run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Use `search-docs` before changes that depend on Laravel ecosystem APIs, behavior, configuration, or version-specific syntax. Skip it for copy-only edits and other changes where package documentation is irrelevant. Reuse sufficient results already in context instead of searching again.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists, including path-scoped framework guidelines under `.ai/rules/boost`. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.
- Activate the `deploying-to-cloud` skill whenever deploying to Laravel Cloud, configuring Cloud environments or resources, using the Cloud CLI, or troubleshooting Cloud deployments.

=== tests rules ===

# Test Enforcement

- Add or update tests for behavior and logic changes when a test provides meaningful regression coverage.
- Pure copy, styling, and layout-only changes do not require new or updated tests.
- When test coverage applies, run the affected tests and ensure they pass.
- Test the changed behavior and its important failure modes, but do not add tests beyond them.
- Read the `testing-best-practices` skill before writing tests.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-react-development` when working with Inertia client-side patterns.

# Inertia v3

- Use all Inertia features from v1, v2, and v3. Check the documentation before making changes to ensure the correct approach.
- New v3 features: standalone HTTP requests (`useHttp` hook), optimistic updates with automatic rollback, layout props (`useLayoutProps` hook), instant visits, simplified SSR via `@inertiajs/vite` plugin, custom exception handling for error pages.
- Carried over from v2: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.
- Axios has been removed. Use the built-in XHR client with interceptors, or install Axios separately if needed.
- `Inertia::lazy()` / `LazyProp` has been removed. Use `Inertia::optional()` instead.
- Prop types (`Inertia::optional()`, `Inertia::defer()`, `Inertia::merge()`) work inside nested arrays with dot-notation paths.
- SSR works automatically in Vite dev mode with `@inertiajs/vite` - no separate Node.js server needed during development.
- Event renames: `invalid` is now `httpException`, `exception` is now `networkError`.
- `router.cancel()` replaced by `router.cancelAll()`.
- The `future` configuration namespace has been removed - all v2 future options are now always enabled.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

=== wayfinder/core rules ===

# Laravel Wayfinder

Use Wayfinder to generate TypeScript functions for Laravel routes. Import from `@/actions/` (controllers) or `@/routes/` (named routes).

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

# Pest

- This project uses Pest. Create tests with `php artisan make:test --pest {name}`.
- Do not include the test suite directory in `{name}`. Use `SomeFeatureTest`, not `Feature/SomeFeatureTest`.
- Read the `testing-best-practices` skill for guidance on coverage, naming, structure, dependency isolation, and review.
- Do not delete tests or test files without approval. They are part of the application.

## Running Tests

- Run the narrowest set of tests that covers the change. Pass a file path or `--filter=testName` to `php artisan test --compact`.
- Rerun a test after each change to it.
- Run `vendor/bin/pest` to call the test runner directly. It accepts the same file path and `--filter=testName` arguments.

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.

</laravel-boost-guidelines>
