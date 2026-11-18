---
paths:
  - 'app/Http/**'
---

# Http

## Typed user and input in controllers
Inject the authenticated user with `#[CurrentUser] User $user` instead of `$request->user()`. Read validated input through typed accessor methods on the FormRequest (e.g. `organizationName()`, `role()`, `settings()`), not `validated(...)` mixed values. Larastan runs at level 9.
