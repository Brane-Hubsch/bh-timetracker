---
paths:
  - 'routes/**'
---

# Routes

## Tenant routes live under the organization slug
Pages that show organization data are registered inside the `{current_organization}` prefix group with EnsureOrganizationMembership, which checks membership and sets CurrentOrganization. Never read users.current_organization_id directly to pick the tenant.

## Sensitive actions require password.confirm
Managing passkeys and deleting the account sit behind the `password.confirm` middleware. Users confirm with a passkey or an emailed link (auth/confirm-access); every fresh sign-in calls session()->passwordConfirmed().
