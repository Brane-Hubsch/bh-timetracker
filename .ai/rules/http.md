---
paths:
  - 'app/Http/**'
---

# Http

## Typed user and input in controllers
Inject the authenticated user with `#[CurrentUser] User $user` instead of `$request->user()`. Read validated input through typed accessor methods on the FormRequest (e.g. `organizationName()`, `role()`, `settings()`), not `validated(...)` mixed values. Larastan runs at level 9.

## OAuth pages are full page loads
Passport's authorize page redirects to the MCP client's domain, which an Inertia XHR visit cannot follow. `LeaveInertiaForOAuth` turns Inertia visits to it into `Inertia::location`, and its approve/deny forms are plain HTML forms. Keep it that way when touching sign-in redirects (`url.intended`).
